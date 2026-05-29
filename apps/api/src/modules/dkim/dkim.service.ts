import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@email-relay/database";

@Injectable()
export class DkimService {
  constructor(@Inject("PrismaClient") private readonly prisma: PrismaClient) {}

  async getDomainDkim(id: string) {
    const domain = await this.prisma.domain.findUnique({ where: { id } });
    if (!domain) throw new NotFoundException("Domain not found");
    return {
      selector: domain.dkimSelector,
      publicKey: domain.dkimPublicKey,
      hasKeys: !!(domain.dkimSelector && domain.dkimPublicKey),
    };
  }
}
