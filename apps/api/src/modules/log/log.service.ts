import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@email-relay/database";

@Injectable()
export class LogService {
  constructor(@Inject("PrismaClient") private readonly prisma: PrismaClient) {}

  async findAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.emailEvent.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { email: true },
      }),
      this.prisma.emailEvent.count(),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    return this.prisma.emailEvent.findUnique({
      where: { id },
      include: { email: true },
    });
  }
}
