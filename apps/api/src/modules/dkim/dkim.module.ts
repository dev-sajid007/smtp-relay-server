import { Module } from "@nestjs/common";
import { DkimController } from "./dkim.controller";
import { DkimService } from "./dkim.service";

@Module({
  controllers: [DkimController],
  providers: [DkimService],
})
export class DkimModule {}
