import { Global, Module } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

@Global()
@Module({
  providers: [
    {
      provide: "PrismaClient",
      useFactory: getPrismaClient,
    },
  ],
  exports: ["PrismaClient"],
})
export class PrismaModule {}
