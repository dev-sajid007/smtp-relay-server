import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@email-relay/database";

@Injectable()
export class EmailService {
  constructor(@Inject("PrismaClient") private readonly prisma: PrismaClient) {}

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
}
