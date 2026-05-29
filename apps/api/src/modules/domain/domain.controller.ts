import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { DomainService } from "./domain.service";

@Controller("domains")
@UseGuards(JwtAuthGuard)
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  @Get()
  findAll() {
    return this.domainService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.domainService.findOne(id);
  }

  @Post()
  create(@Body() body: { name: string }) {
    return this.domainService.create(body.name);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.domainService.delete(id);
  }

  @Post(":id/dkim/generate")
  generateDkimKeys(@Param("id") id: string) {
    return this.domainService.generateDkimKeys(id);
  }

  @Get(":id/dns")
  getDnsRecords(@Param("id") id: string) {
    return this.domainService.getDnsRecords(id);
  }
}
