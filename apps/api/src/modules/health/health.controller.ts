import { Controller, Get, Inject } from "@nestjs/common";
import { PrismaClient } from "@email-relay/database";
import { createClient } from "redis";

@Controller("health")
export class HealthController {
  private redis: ReturnType<typeof createClient>;

  constructor(@Inject("PrismaClient") private readonly prisma: PrismaClient) {
    this.redis = createClient({
      url: `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`,
    });
  }

  @Get()
  async check() {
    const checks: Record<string, string> = {};

    checks.server = "ok";

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }

    try {
      await this.redis.connect();
      await this.redis.ping();
      checks.redis = "ok";
      await this.redis.disconnect();
    } catch {
      checks.redis = "error";
    }

    const allOk = Object.values(checks).every((v) => v === "ok");

    return {
      status: allOk ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
