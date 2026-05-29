import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DkimService } from "./dkim.service";

@Controller("dkim")
@UseGuards(JwtAuthGuard)
export class DkimController {
  constructor(private readonly dkimService: DkimService) {}

  @Get("domain/:id")
  getDomainDkim(@Param("id") id: string) {
    return this.dkimService.getDomainDkim(id);
  }
}
