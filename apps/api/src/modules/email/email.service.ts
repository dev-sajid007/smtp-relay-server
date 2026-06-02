import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@email-relay/database";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import * as crypto from "crypto";

@Injectable()
export class EmailService {
  constructor(
    @Inject("PrismaClient") private readonly prisma: PrismaClient,
    @InjectQueue("email") private readonly emailQueue: Queue
  ) {}

  async findAll(page = 1, limit = 50): Promise<any> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.email.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { events: { orderBy: { createdAt: "desc" } } },
      }),
      this.prisma.email.count(),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<any> {
    return this.prisma.email.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: "desc" } } },
    });
  }

  async send(from: string, to: string, subject: string, body: string) {
    const messageId = `<${crypto.randomUUID()}@relay>`;
    const rawEmail = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Message-ID: ${messageId}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      body,
    ].join("\r\n");

    const email = await this.prisma.email.create({
      data: {
        messageId,
        fromEmail: from,
        toEmail: to,
        subject,
        body: rawEmail,
        status: "queued",
      },
    });

    await this.prisma.emailEvent.create({
      data: {
        emailId: email.id,
        event: "queued",
        metadata: { source: "admin-ui" },
      },
    });

    await this.emailQueue.add(
      "send",
      {
        emailId: email.id,
        messageId,
        fromEmail: from,
        toEmail: to,
        body: rawEmail,
      },
      { attempts: 3, backoff: { type: "exponential", delay: 60000 } }
    );

    return email;
  }
}
