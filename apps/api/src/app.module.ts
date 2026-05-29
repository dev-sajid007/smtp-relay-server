import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DomainModule } from "./modules/domain/domain.module";
import { SmtpModule } from "./modules/smtp/smtp.module";
import { EmailModule } from "./modules/email/email.module";
import { QueueModule } from "./modules/queue/queue.module";
import { LogModule } from "./modules/log/log.module";
import { DkimModule } from "./modules/dkim/dkim.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    DomainModule,
    SmtpModule,
    EmailModule,
    QueueModule,
    LogModule,
    DkimModule,
  ],
})
export class AppModule {}
