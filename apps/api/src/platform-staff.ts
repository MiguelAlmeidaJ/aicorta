import {
  BadRequestException, Body, ConflictException, Controller, Get, Injectable, Param,
  Patch, Post, Query, Req, UseGuards,
} from "@nestjs/common";
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { hash } from "bcryptjs";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard, SystemGuard } from "./auth";
import { normalizeBrazilianWhatsapp, whatsappVariants } from "./phone";
import { Throttle } from "@nestjs/throttler";

export class CreateManagerDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsString() @Matches(/^[a-z0-9]{3,30}$/) username!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() whatsapp!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
export class ManagerStatusDto {
  @IsString() @Matches(/^(true|false)$/) active!: string;
}

@Injectable()
export class PlatformAuditService {
  constructor(private readonly db: PrismaService) {}
  record(actorUserId: string | null, action: string, targetType: string, targetId?: string, details?: Record<string, string | number | boolean | null>) {
    return this.db.platformAudit.create({
      data: { actorUserId, action, targetType, targetId, ...(details && { details }) },
    });
  }
  async list(take: number) {
    const [platform, billing] = await Promise.all([
      this.db.platformAudit.findMany({
        take, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true, action: true, targetType: true, targetId: true, details: true, createdAt: true,
          actor: { select: { id: true, name: true, username: true, globalRole: true } },
        },
      }),
      this.db.billingAudit.findMany({
        take, orderBy: { createdAt: "desc" },
        select: { id: true, tenantId: true, action: true, payload: true, createdAt: true,
          actor: { select: { id: true, name: true, username: true, globalRole: true } } },
      }),
    ]);
    return [
      ...platform.map(event => ({ ...event, source: "PLATFORM", details: event.details })),
      ...billing.map(event => ({
        id: event.id, action: event.action, targetType: "BILLING",
        targetId: event.tenantId, source: "BILLING", details: event.payload,
        createdAt: event.createdAt, actor: event.actor,
      })),
    ].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, take);
  }
}

@Injectable()
export class PlatformStaffService {
  constructor(private readonly db: PrismaService) {}
  list() {
    return this.db.user.findMany({
      where: { globalRole: "MANAGER" },
      select: { id: true, name: true, username: true, email: true, whatsapp: true,
        isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  async create(actorUserId: string, dto: CreateManagerDto) {
    const name = dto.name.trim();
    const username = dto.username.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    const whatsapp = normalizeBrazilianWhatsapp(dto.whatsapp);
    if (!whatsapp) throw new BadRequestException("WhatsApp inválido; informe DDD e celular.");
    if (name.length < 2 || !/^[a-z0-9]{3,30}$/.test(username)) {
      throw new BadRequestException("Nome ou nome de usuário inválido.");
    }
    const passwordHash = await hash(dto.password, 12);
    try {
      return await this.db.$transaction(async tx => {
        if (await tx.user.findFirst({ where: {
          OR: [{ username }, { email }, { whatsapp: { in: whatsappVariants(whatsapp) } }],
        }, select: { id: true } })) throw new ConflictException("Usuário, e-mail ou WhatsApp já cadastrado.");
        const user = await tx.user.create({
          data: { name, username, email, whatsapp, passwordHash, globalRole: "MANAGER" },
          select: { id: true, name: true, username: true, email: true, whatsapp: true,
            isActive: true, createdAt: true },
        });
        await tx.platformAudit.create({ data: {
          actorUserId, action: "MANAGER_CREATED", targetType: "USER", targetId: user.id,
          details: { username: user.username },
        } });
        return user;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ConflictException("Usuário, e-mail ou WhatsApp já cadastrado.");
      }
      throw error;
    }
  }
  async changeStatus(actorUserId: string, managerId: string, active: boolean) {
    return this.db.$transaction(async tx => {
      const manager = await tx.user.findFirst({
        where: { id: managerId, globalRole: "MANAGER" },
        select: { id: true, isActive: true, username: true },
      });
      if (!manager) throw new BadRequestException("Manager não encontrado.");
      if (manager.isActive !== active) {
        await tx.user.update({ where: { id: managerId }, data: { isActive: active } });
        if (!active) await tx.authSession.updateMany({
          where: { userId: managerId, revokedAt: null }, data: { revokedAt: new Date() },
        });
        await tx.platformAudit.create({ data: {
          actorUserId, action: active ? "MANAGER_ACTIVATED" : "MANAGER_DEACTIVATED",
          targetType: "USER", targetId: managerId, details: { username: manager.username },
        } });
      }
      return { ok: true, isActive: active };
    });
  }
}

@Controller("system")
export class PlatformStaffController {
  constructor(private readonly staff: PlatformStaffService, private readonly audits: PlatformAuditService) {}
  @UseGuards(JwtAuthGuard, SystemGuard) @Get("managers")
  listManagers() { return this.staff.list(); }
  @UseGuards(JwtAuthGuard, SystemGuard) @Post("managers")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  createManager(@Req() req: { user: { id: string } }, @Body() dto: CreateManagerDto) {
    return this.staff.create(req.user.id, dto);
  }
  @UseGuards(JwtAuthGuard, SystemGuard) @Patch("managers/:id/status")
  updateManager(@Req() req: { user: { id: string } }, @Param("id") id: string, @Body() dto: ManagerStatusDto) {
    return this.staff.changeStatus(req.user.id, id, dto.active === "true");
  }
  @UseGuards(JwtAuthGuard, SystemGuard) @Get("audit")
  audit(@Query("take") take?: string) {
    const parsed = Number(take ?? "50");
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new BadRequestException("Limite deve estar entre 1 e 100.");
    }
    return this.audits.list(parsed);
  }
}
