import {
  BadRequestException, Body, Controller, Get, Injectable, Param, Patch, Post, Query, Req, UseGuards,
} from "@nestjs/common";
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { randomBytes, createHash } from "node:crypto";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard, PlatformStaffGuard } from "./auth";
import { Throttle } from "@nestjs/throttler";

const digest = (input: string) => createHash("sha256").update(input).digest("hex");

export class CreateOwnerInviteDto {
  @IsString() @MinLength(2) @MaxLength(100) referenceName!: string;
  @IsInt() @Min(1) @Max(31) billingDueDay!: number;
}

@Injectable()
export class OwnerInviteService {
  constructor(private readonly db: PrismaService) {}
  async create(issuedById: string, dto: CreateOwnerInviteDto) {
    const token = randomBytes(32).toString("base64url");
    const invite = await this.db.ownerInvite.create({
      data: {
        issuedById, referenceName: dto.referenceName.trim(), billingDueDay: dto.billingDueDay,
        tokenHash: digest(token), expiresAt: new Date(Date.now() + 7 * 86400000),
      },
      select: { id: true, referenceName: true, billingDueDay: true, expiresAt: true },
    });
    const url = new URL("/cadastro", process.env.WEB_ORIGIN ?? "http://localhost:3000");
    url.searchParams.set("token", token);
    // Envio manual pelo SYSTEM; token não é salvo em texto aberto.
    return { ...invite, registrationUrl: url.toString() };
  }

  list() {
    return this.db.ownerInvite.findMany({
      orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, referenceName: true, billingDueDay: true,
        expiresAt: true, consumedAt: true, revokedAt: true, createdAt: true },
    });
  }

  async verify(token: string) {
    if (typeof token !== "string" || token.length < 32 || token.length > 256) {
      throw new BadRequestException("Convite inválido");
    }
    const invite = await this.db.ownerInvite.findUnique({
      where: { tokenHash: digest(token) },
      select: { expiresAt: true, consumedAt: true, revokedAt: true },
    });
    if (!invite || invite.consumedAt || invite.revokedAt || invite.expiresAt <= new Date()) {
      throw new BadRequestException("Convite inválido, expirado ou já utilizado");
    }
    return { valid: true, expiresAt: invite.expiresAt };
  }

  async revoke(id: string) {
    const result = await this.db.ownerInvite.updateMany({
      where: { id, consumedAt: null, revokedAt: null }, data: { revokedAt: new Date() },
    });
    if (result.count !== 1) throw new BadRequestException("Convite já utilizado ou revogado");
    return { ok: true };
  }
}

@Controller("auth/owner-invites")
export class OwnerInviteController {
  constructor(private readonly invites: OwnerInviteService) {}

  @UseGuards(JwtAuthGuard, PlatformStaffGuard)
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateOwnerInviteDto) {
    return this.invites.create(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, PlatformStaffGuard)
  @Get()
  list() { return this.invites.list(); }

  @UseGuards(JwtAuthGuard, PlatformStaffGuard)
  @Patch(":id/revoke")
  revoke(@Param("id") id: string) { return this.invites.revoke(id); }

  @Get("verify")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  verify(@Query("token") token: string) { return this.invites.verify(token); }
}
