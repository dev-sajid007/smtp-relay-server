import { SMTPServer } from "smtp-server";
import { prisma } from "@email-relay/database";
import * as bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { Queue } from "bullmq";
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

const emailQueue = new Queue("email", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  },
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = parseInt(process.env.SMTP_RATE_LIMIT_MAX || "100", 10);
const RATE_LIMIT_WINDOW = parseInt(
  process.env.SMTP_RATE_LIMIT_WINDOW || "3600",
  10
);

function checkRateLimit(username: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(username);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(username, { count: 1, resetAt: now + RATE_LIMIT_WINDOW * 1000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const server = new SMTPServer({
  authOptional: false,
  banner: "Email Relay Service",
  disabledCommands: ["STARTTLS"],

  onAuth: async (auth, session, callback) => {
    try {
      if (!auth.username || !auth.password) {
        logger.warn("SMTP auth missing credentials");
        return callback(new Error("Invalid credentials"));
      }

      const cred = await prisma.smtpCredential.findUnique({
        where: { username: auth.username },
        include: { domain: true },
      });

      if (!cred || !cred.active) {
        logger.warn({ username: auth.username }, "SMTP auth failed: invalid/disabled");
        return callback(new Error("Invalid credentials"));
      }

      if (!checkRateLimit(auth.username)) {
        logger.warn({ username: auth.username }, "SMTP rate limit exceeded");
        return callback(new Error("Rate limit exceeded"));
      }

      const valid = await bcrypt.compare(auth.password, cred.passwordHash);
      if (!valid) {
        logger.warn({ username: auth.username }, "SMTP auth failed: wrong password");
        return callback(new Error("Invalid credentials"));
      }

      (session as any).domainId = cred.domainId;
      logger.info(
        { username: auth.username, domain: cred.domain.name },
        "SMTP authenticated"
      );
      callback(null, { user: cred.username });
    } catch (err) {
      logger.error({ err }, "SMTP auth error");
      callback(err as Error);
    }
  },

  onData: async (stream, session, callback) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString();

      const messageId = `<${uuidv4()}@${session.hostNameAppearsAs}>`;
      const mailFrom =
        session.envelope.mailFrom || ({ address: "" } as any);
      const fromEmail = mailFrom.address;
      const toEmail = session.envelope.rcptTo.map((r) => r.address).join(",");
      const subject = extractHeader(raw, "subject") || "(no subject)";
      const domainId = (session as any).domainId;

      const email = await prisma.email.create({
        data: {
          messageId,
          fromEmail,
          toEmail,
          subject,
          body: raw,
          status: "queued",
          domainId,
        },
      });

      await emailQueue.add(
        "send",
        {
          emailId: email.id,
          messageId,
          fromEmail,
          toEmail,
          body: raw,
          domainId,
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 60000 },
        }
      );

      await prisma.emailEvent.create({
        data: {
          emailId: email.id,
          event: "queued",
          metadata: { rawSize: raw.length },
        },
      });

      logger.info(
        { messageId, fromEmail, toEmail, size: raw.length },
        "Email queued"
      );

      callback();
    } catch (err) {
      logger.error({ err }, "SMTP onData error");
      callback(err as Error);
    }
  },
});

function extractHeader(raw: string, name: string): string | null {
  const re = new RegExp(`^${name}:\\s*(.+)\\r?$`, "im");
  const match = raw.match(re);
  return match ? match[1].trim() : null;
}

const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 2525;

server.listen(port, () => {
  logger.info({ port }, "SMTP server started");
});

const shutdown = async () => {
  logger.info("Shutting down SMTP server...");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await emailQueue.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
