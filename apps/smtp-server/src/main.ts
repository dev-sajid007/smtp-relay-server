import { SMTPServer } from "smtp-server";
import { prisma } from "@email-relay/database";
import * as bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { Queue } from "bullmq";

const emailQueue = new Queue("email", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  },
});

const server = new SMTPServer({
  authOptional: false,
  banner: "Email Relay Service",

  onAuth: async (auth, session, callback) => {
    try {
      const cred = await prisma.smtpCredential.findUnique({
        where: { username: auth.username },
        include: { domain: true },
      });

      if (!cred || !cred.active || !auth.password) {
        return callback(new Error("Invalid credentials"));
      }

      const valid = await bcrypt.compare(auth.password, cred.passwordHash);
      if (!valid) {
        return callback(new Error("Invalid credentials"));
      }

      (session as any).domainId = cred.domainId;
      callback(null, { user: cred.username });
    } catch (err) {
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
        session.envelope.mailFrom || { address: "" };
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

      await emailQueue.add("send", {
        emailId: email.id,
        messageId,
        fromEmail,
        toEmail,
        body: raw,
        domainId,
      });

      await prisma.emailEvent.create({
        data: {
          emailId: email.id,
          event: "queued",
          metadata: { rawSize: raw.length },
        },
      });

      callback();
    } catch (err) {
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
  console.log(`SMTP server listening on port ${port}`);
});
