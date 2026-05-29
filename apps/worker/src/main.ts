import { Worker } from "bullmq";
import { prisma } from "@email-relay/database";
import * as nodemailer from "nodemailer";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
};

const transporter = nodemailer.createTransport({
  host: process.env.POSTFIX_HOST || "127.0.0.1",
  port: process.env.POSTFIX_PORT ? parseInt(process.env.POSTFIX_PORT) : 25,
  secure: false,
});

const worker = new Worker(
  "email",
  async (job) => {
    const { emailId, fromEmail, toEmail, body, domainId } = job.data;

    await prisma.email.update({
      where: { id: emailId },
      data: { status: "processing" },
    });

    await prisma.emailEvent.create({
      data: {
        emailId,
        event: "processing",
        metadata: { jobId: job.id },
      },
    });

    try {
      const domain = domainId
        ? await prisma.domain.findUnique({ where: { id: domainId } })
        : null;

      let signedBody = body;

      if (domain?.dkimSelector && domain?.dkimPrivateKey) {
        signedBody = await dkimSign(
          body,
          domain.name,
          domain.dkimSelector,
          domain.dkimPrivateKey
        );
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";

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
  { connection }
);

async function dkimSign(
  body: string,
  domain: string,
  selector: string,
  privateKey: string
): Promise<string> {
  const crypto = await import("crypto");

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

  const signatureHeader = signatureHeaders.join("; ");
  const signature = crypto.sign(
    "sha256",
    Buffer.from(signatureHeader),
    privateKey
  );
  const sigB64 = signature.toString("base64");

  const dkimHeader = `DKIM-Signature: ${signatureHeaders.join("; ")};
 b=${sigB64}`;

  return `${dkimHeader}\r\n${body}`;
}

function computeBodyHash(body: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(body).digest("base64");
}

console.log("Worker started, waiting for jobs...");
