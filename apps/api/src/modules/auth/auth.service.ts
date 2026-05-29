import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@email-relay/database";
import * as bcrypt from "bcryptjs";

@Injectable()
export class AuthService {
  constructor(
    @Inject("PrismaClient") private readonly prisma: PrismaClient,
    private readonly jwtService: JwtService
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    if (!admin) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const token = this.jwtService.sign({ sub: admin.id, email: admin.email });

    return { access_token: token };
  }
}
