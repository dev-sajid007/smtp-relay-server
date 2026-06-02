import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailService } from "./email.service";

@Controller("emails")
@UseGuards(JwtAuthGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get()
  findAll(@Query("page") page?: string, @Query("limit") limit?: string): any {
    return this.emailService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50
    );
  }

  @Get(":id")
  findOne(@Param("id") id: string): any {
    return this.emailService.findOne(id);
  }

  @Post("send")
  send(@Body() body: { from: string; to: string; subject: string; body: string }) {
    return this.emailService.send(body.from, body.to, body.subject, body.body);
  }
}
