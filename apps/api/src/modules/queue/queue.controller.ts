import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { QueueService } from "./queue.service";

@Controller("queue")
@UseGuards(JwtAuthGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get("status")
  getStatus() {
    return this.queueService.getStatus();
  }
}
