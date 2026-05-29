import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@email-relay/database";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

@Injectable()
export class SmtpService {
  constructor(@Inject("PrismaClient") private readonly prisma: PrismaClient) {}

  async findAll() {
    return this.prisma.smtpCredential.findMany({
      include: { domain: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const cred = await this.prisma.smtpCredential.findUnique({
      where: { id },
      include: { domain: true },
    });
    if (!cred) throw new NotFoundException("SMTP credential not found");
    return cred;
  }

  async create(domainId: string) {
    const domain = await this.prisma.domain.findUnique({
      where: { id: domainId },
    });
    if (!domain) throw new NotFoundException("Domain not found");

    const username = `smtp_${crypto.randomBytes(8).toString("hex")}`;
    const rawPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const credential = await this.prisma.smtpCredential.create({
      data: { username, passwordHash, domainId },
    });

    const { passwordHash: _, ...rest } = credential;
    return { ...rest, rawPassword };
  }

  async rotatePassword(id: string) {
    const cred = await this.findOne(id);
    const rawPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    await this.prisma.smtpCredential.update({
      where: { id },
      data: { passwordHash },
    });

    return { id: cred.id, username: cred.username, rawPassword };
  }

  async toggle(id: string) {
    const cred = await this.findOne(id);
    const updated = await this.prisma.smtpCredential.update({
      where: { id },
      data: { active: !cred.active },
    });
    return updated;
  }

  async delete(id: string) {
    const cred = await this.findOne(id);
    await this.prisma.smtpCredential.delete({ where: { id } });
    return cred;
  }
}
