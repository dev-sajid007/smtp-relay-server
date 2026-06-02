import { Worker, QueueEvents } from "bullmq";
import { PrismaClient } from "@email-relay/database";
import * as nodemailer from "nodemailer";

const prisma = new PrismaClient();
import * as crypto from "crypto";
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
};

const transporter = nodemailer.createTransport({
  host: process.env.POSTFIX_HOST || "127.0.0.1",
  port: process.env.POSTFIX_PORT ? parseInt(process.env.POSTFIX_PORT) : 25,
  secure: false,
  tls: { rejectUnauthorized: false },
});

const worker = new Worker(
  "email",
  async (job) => {
    const { emailId, fromEmail, toEmail, body, domainId } = job.data;

    logger.info({ emailId, jobId: job.id }, "Processing email");

    await prisma.email.update({
      where: { id: emailId },
      data: { status: "processing" },
    });

    await prisma.emailEvent.create({
      data: {
        emailId,
        event: "processing",
        metadata: { jobId: job.id, attempt: job.attemptsMade },
      },
    });

    try {
      const domain = domainId
        ? await prisma.domain.findUnique({ where: { id: domainId } })
        : null;

      let signedBody = body;

      if (domain?.dkimSelector && domain?.dkimPrivateKey) {
        signedBody = dkimSign(
          body,
          domain.name,
          domain.dkimSelector,
          domain.dkimPrivateKey
        );
        logger.info({ emailId, domain: domain.name }, "DKIM signed");
      }

      await transporter.sendMail({
        envelope: {
          from: fromEmail,
          to: toEmail.split(","),
        },
        raw: signedBody,
      });

      await prisma.email.update({
        where: { id: emailId },
        data: { status: "sent" },
      });

      await prisma.emailEvent.create({
        data: {
          emailId,
          event: "sent",
          metadata: { deliveredAt: new Date().toISOString() },
        },
      });

      logger.info({ emailId, toEmail }, "Email sent successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";

      logger.error({ emailId, err }, "Email delivery failed");

      await prisma.email.update({
        where: { id: emailId },
        data: { status: "failed", failureReason: message },
      });

      await prisma.emailEvent.create({
        data: {
          emailId,
          event: "failed",
          metadata: { error: message },
        },
      });

      throw err;
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5", 10),
    limiter: {
      max: parseInt(process.env.WORKER_RATE_LIMIT || "10", 10),
      duration: 1000,
    },
  }
);

function dkimSign(
  body: string,
  domain: string,
  selector: string,
  privateKey: string
): string {
  const headers = body.split(/\r?\n\r?\n/)[0] || "";
  const bodyPart = body.substring(headers.length).trim();

  const signatureHeaders = [
    `v=1`,
    `a=rsa-sha256`,
    `c=relaxed/relaxed`,
    `d=${domain}`,
    `s=${selector}`,
    `bh=${computeBodyHash(bodyPart)}`,
    `h=from:to:subject:date:mime-version:content-type`,
  ];

  const signer = crypto.createSign("sha256");
  signer.update(signatureHeaders.join("; "));
  signer.end();
  const sigB64 = signer.sign(privateKey, "base64");

  const dkimHeader = `DKIM-Signature: ${signatureHeaders.join(";\n  ")};
  b=${sigB64}`;

  return `${dkimHeader}\r\n${body}`;
}

function computeBodyHash(body: string): string {
  return crypto.createHash("sha256").update(body).digest("base64");
}

logger.info("Worker started, waiting for jobs...");

const shutdown = async () => {
  logger.info("Shutting down worker...");
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
