import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@email-relay/database";
import * as crypto from "crypto";

@Injectable()
export class DomainService {
  constructor(@Inject("PrismaClient") private readonly prisma: PrismaClient) {}

  async findAll() {
    return this.prisma.domain.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findOne(id: string) {
    const domain = await this.prisma.domain.findUnique({ where: { id } });
    if (!domain) throw new NotFoundException("Domain not found");
    return domain;
  }

  async create(name: string) {
    return this.prisma.domain.create({ data: { name } });
  }

  async delete(id: string) {
    const domain = await this.findOne(id);
    await this.prisma.domain.delete({ where: { id } });
    return domain;
  }

  async generateDkimKeys(id: string) {
    const domain = await this.findOne(id);
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const selector = `dkim${domain.name.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;

    await this.prisma.domain.update({
      where: { id },
      data: {
        dkimSelector: selector,
        dkimPrivateKey: privateKey,
        dkimPublicKey: publicKey,
      },
    });

    return { selector, publicKey, privateKey };
  }

  async getDnsRecords(id: string) {
    const domain = await this.findOne(id);
    const records = [];

    if (domain.dkimSelector && domain.dkimPublicKey) {
      const pubKey = domain.dkimPublicKey
        .replace(/-----BEGIN PUBLIC KEY-----/, "")
        .replace(/-----END PUBLIC KEY-----/, "")
        .replace(/\n/g, "")
        .trim();
      records.push({
        type: "TXT",
        name: `${domain.dkimSelector}._domainkey.${domain.name}`,
        value: `v=DKIM1; k=rsa; p=${pubKey}`,
      });
    }

    records.push({
      type: "TXT",
      name: domain.name,
      value: `v=spf1 mx ~all`,
    });

    records.push({
      type: "TXT",
      name: `_dmarc.${domain.name}`,
      value: `v=DMARC1; p=none;`,
    });

    return records;
  }
}
