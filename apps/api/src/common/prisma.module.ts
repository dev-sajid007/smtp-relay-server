import { Global, Module } from "@nestjs/common";
import { prisma } from "@email-relay/database";

@Global()
@Module({
  providers: [
    {
      provide: "PrismaClient",
      useValue: prisma,
    },
  ],
  exports: ["PrismaClient"],
})
export class PrismaModule {}
