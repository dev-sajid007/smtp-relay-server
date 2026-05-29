import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SmtpService } from "./smtp.service";

@Controller("smtp-credentials")
@UseGuards(JwtAuthGuard)
export class SmtpController {
  constructor(private readonly smtpService: SmtpService) {}

  @Get()
  findAll() {
    return this.smtpService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.smtpService.findOne(id);
  }

  @Post("domain/:domainId")
  create(@Param("domainId") domainId: string) {
    return this.smtpService.create(domainId);
  }

  @Post(":id/rotate")
  rotatePassword(@Param("id") id: string) {
    return this.smtpService.rotatePassword(id);
  }

  @Post(":id/toggle")
  toggle(@Param("id") id: string) {
    return this.smtpService.toggle(id);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.smtpService.delete(id);
  }
}
