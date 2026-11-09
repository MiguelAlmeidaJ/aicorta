import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get,
  GoneException, Injectable, NotFoundException, Param, Patch, Post, Query, Req, UseGuards,
} from "@nestjs/common";
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard } from "./auth";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";
import { Throttle } from "@nestjs/throttler";
import { normalizeBrazilianWhatsapp, whatsappVariants } from "./phone";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
type InviteRole = "EMPLOYEE" | "CLIENT";
type AuthRequest = { user: { id: string } };

export class InvitePersonDto {
  @IsEmail() email!: string;
  @IsIn(["EMPLOYEE", "CLIENT"]) role!: InviteRole;
}
export class AcceptInvitationDto {
  @IsString() @MinLength(32) @MaxLength(256) token!: string;
}
export class LookupEmployeeDto {
  @IsEmail() email!: string;
}
export class CreateEmployeeDto {
  @IsEmail() email!: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]{3,30}$/) username?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() @MinLength(10) @MaxLength(128) password?: string;
}

@Injectable()
export class PeopleService {
  constructor(private readonly db: PrismaService) {}

  list(tenantId: string, role: InviteRole) {
    return this.db.membership.findMany({
      where: { tenantId, role },
      select: {
        id: true, role: true, isActive: true, createdAt: true,
        user: { select: { id: true, name: true, username: true, email: true, whatsapp: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  listInvitations(tenantId: string) {
    return this.db.tenantInvitation.findMany({
      where: { tenantId },
      select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async lookupEmployee(tenantId: string, emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.db.user.findUnique({
      where: { email },
      select: {
        id: true, name: true, username: true, email: true, isActive: true, globalRole: true,
        memberships: { where: { tenantId }, select: { role: true, isActive: true }, take: 1 },
      },
    });
    if (!user) return { exists: false, email };
    const membership = user.memberships[0] ?? null;
    const unavailable = !user.isActive || user.globalRole === "SYSTEM" || membership?.role === "ADMIN" ||
      (membership?.role === "EMPLOYEE" && membership.isActive);
    return {
      exists: true, email, canLink: !unavailable,
      user: { name: user.name, username: user.username, email: user.email },
      membership,
      reason: !user.isActive || user.globalRole === "SYSTEM" ? "Esta conta não pode ser vinculada" :
        membership?.role === "ADMIN" ? "Esta pessoa já é administradora" :
        membership?.role === "EMPLOYEE" && membership.isActive ? "Esta pessoa já está na equipe" : null,
    };
  }

  async addEmployee(tenantId: string, dto: CreateEmployeeDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.db.user.findUnique({
      where: { email }, select: { id: true, name: true, isActive: true, globalRole: true },
    });
    if (existing) {
      if (!existing.isActive || existing.globalRole === "SYSTEM") {
        throw new BadRequestException("Esta conta não pode ser vinculada à equipe");
      }
      return this.db.$transaction(async tx => {
        const membership = await tx.membership.findUnique({
          where: { userId_tenantId: { userId: existing.id, tenantId } },
        });
        if (membership?.role === "ADMIN") throw new ConflictException("Esta pessoa já é administradora");
        if (membership?.role === "EMPLOYEE" && membership.isActive) {
          throw new ConflictException("Esta pessoa já está na equipe");
        }
        const linked = membership ? await tx.membership.update({
          where: { id: membership.id }, data: { role: "EMPLOYEE", isActive: true },
          select: { id: true, role: true, isActive: true, createdAt: true,
            user: { select: { id: true, name: true, username: true, email: true, whatsapp: true } } },
        }) : await tx.membership.create({
          data: { userId: existing.id, tenantId, role: "EMPLOYEE" },
          select: { id: true, role: true, isActive: true, createdAt: true,
            user: { select: { id: true, name: true, username: true, email: true, whatsapp: true } } },
        });
        await tx.tenantInvitation.updateMany({
          where: { tenantId, email, role: "EMPLOYEE", acceptedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return linked;
      });
    }

    if (!dto.name?.trim() || !dto.username || !dto.whatsapp || !dto.password) {
      throw new BadRequestException("Preencha nome, usuário, WhatsApp e senha para criar a nova conta");
    }
    const whatsapp = normalizeBrazilianWhatsapp(dto.whatsapp);
    if (!whatsapp) throw new BadRequestException("WhatsApp inválido: informe DDD + celular (11 dígitos).");
    if (await this.db.user.findFirst({
      where: { whatsapp: { in: whatsappVariants(whatsapp) } }, select: { id: true },
    })) throw new ConflictException("WhatsApp já cadastrado");
    const passwordHash = await hash(dto.password, 12);
    try {
      return await this.db.$transaction(async tx => {
        const user = await tx.user.create({
          data: {
            name: dto.name!.trim(), username: dto.username!.trim().toLowerCase(),
            email, whatsapp, passwordHash,
          },
        });
        const linked = await tx.membership.create({
          data: { userId: user.id, tenantId, role: "EMPLOYEE" },
          select: { id: true, role: true, isActive: true, createdAt: true,
            user: { select: { id: true, name: true, username: true, email: true, whatsapp: true } } },
        });
        await tx.tenantInvitation.updateMany({
          where: { tenantId, email, role: "EMPLOYEE", acceptedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return linked;
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ConflictException("Usuário, e-mail ou WhatsApp já cadastrado");
      }
      throw error;
    }
  }

  async invite(tenantId: string, issuedById: string, dto: InvitePersonDto) {
    const email = dto.email.trim().toLowerCase();
    const target = await this.db.user.findUnique({ where: { email }, select: { id: true, isActive: true, globalRole: true } });
    if (target && (!target.isActive || target.globalRole === "SYSTEM")) {
      throw new BadRequestException("Esta conta não pode receber convites");
    }
    if (target) {
      const membership = await this.db.membership.findUnique({
        where: { userId_tenantId: { userId: target.id, tenantId } },
      });
      if (membership) throw new ConflictException("O usuário já possui vínculo com este estabelecimento");
    }
    const token = randomBytes(32).toString("base64url");
    const invitation = await this.db.tenantInvitation.create({
      data: {
        tenantId, issuedById, email, role: dto.role, tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    // Token é retornado uma única vez, sem persistência em claro. Não compartilhar em logs.
    const acceptanceUrl = new URL("/aceitar-convite", process.env.WEB_ORIGIN ?? "http://localhost:3000");
    acceptanceUrl.searchParams.set("token", token);
    return { ...invitation, token, acceptanceUrl: acceptanceUrl.toString() };
  }

  async accept(userId: string, token: string) {
    const hashed = digest(token);
    return this.db.$transaction(async tx => {
      const invitation = await tx.tenantInvitation.findUnique({
        where: { tokenHash: hashed },
        include: { tenant: { select: { status: true } } },
      });
      if (!invitation || invitation.acceptedAt || invitation.revokedAt ||
          invitation.expiresAt <= new Date() || invitation.tenant.status !== "ACTIVE") {
        throw new GoneException("Convite inválido ou expirado");
      }
      const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true, globalRole: true } });
      if (!user?.isActive || user.globalRole === "SYSTEM" || user.email.toLowerCase() !== invitation.email) {
        throw new ForbiddenException("Este convite pertence a outro usuário");
      }
      // Consumo condicional serializa tentativas simultâneas do mesmo convite.
      const used = await tx.tenantInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date() },
      });
      if (used.count !== 1) throw new GoneException("Convite já utilizado");
      const existing = await tx.membership.findUnique({
        where: { userId_tenantId: { userId, tenantId: invitation.tenantId } },
      });
      if (existing) throw new ConflictException("Já existe um vínculo com este estabelecimento");
      const membership = await tx.membership.create({
        data: { userId, tenantId: invitation.tenantId, role: invitation.role },
        select: { id: true, tenantId: true, role: true },
      });
      return { message: "Convite aceito", membership };
    });
  }

  async revokeInvitation(tenantId: string, invitationId: string) {
    const result = await this.db.tenantInvitation.updateMany({
      where: { id: invitationId, tenantId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException("Convite ativo não encontrado");
    return { ok: true };
  }

  async deactivate(tenantId: string, membershipId: string, role: InviteRole) {
    const result = await this.db.membership.updateMany({
      where: { id: membershipId, tenantId, role, isActive: true },
      data: { isActive: false },
    });
    if (!result.count) throw new NotFoundException("Vínculo ativo não encontrado");
    return { ok: true };
  }
}

@Controller()
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Get("tenants/:tenantId/employees")
  employees(@Param("tenantId") tenantId: string) { return this.people.list(tenantId, "EMPLOYEE"); }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Get("tenants/:tenantId/employees/lookup")
  lookupEmployee(@Param("tenantId") tenantId: string, @Query() dto: LookupEmployeeDto) {
    return this.people.lookupEmployee(tenantId, dto.email);
  }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Post("tenants/:tenantId/employees")
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  addEmployee(@Param("tenantId") tenantId: string, @Body() dto: CreateEmployeeDto) {
    return this.people.addEmployee(tenantId, dto);
  }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN", "EMPLOYEE")
  @Get("tenants/:tenantId/clients")
  clients(@Param("tenantId") tenantId: string) { return this.people.list(tenantId, "CLIENT"); }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Post("tenants/:tenantId/invitations")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  invite(@Param("tenantId") tenantId: string, @Req() req: AuthRequest, @Body() dto: InvitePersonDto) {
    return this.people.invite(tenantId, req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Get("tenants/:tenantId/invitations")
  invitations(@Param("tenantId") tenantId: string) { return this.people.listInvitations(tenantId); }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Patch("tenants/:tenantId/invitations/:invitationId/revoke")
  revoke(@Param("tenantId") tenantId: string, @Param("invitationId") invitationId: string) {
    return this.people.revokeInvitation(tenantId, invitationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("invitations/accept")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  accept(@Req() req: AuthRequest, @Body() dto: AcceptInvitationDto) {
    return this.people.accept(req.user.id, dto.token);
  }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Patch("tenants/:tenantId/employees/:membershipId/deactivate")
  deactivateEmployee(@Param("tenantId") tenantId: string, @Param("membershipId") membershipId: string) {
    return this.people.deactivate(tenantId, membershipId, "EMPLOYEE");
  }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Patch("tenants/:tenantId/clients/:membershipId/deactivate")
  deactivateClient(@Param("tenantId") tenantId: string, @Param("membershipId") membershipId: string) {
    return this.people.deactivate(tenantId, membershipId, "CLIENT");
  }
}
