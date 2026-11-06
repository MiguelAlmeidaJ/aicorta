import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get,
  GoneException, Injectable, NotFoundException, Param, Patch, Post, Req, UseGuards,
} from "@nestjs/common";
import { IsEmail, IsIn, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard } from "./auth";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";
import { Throttle } from "@nestjs/throttler";

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

  async invite(tenantId: string, issuedById: string, dto: InvitePersonDto) {
    const email = dto.email.trim().toLowerCase();
    const target = await this.db.user.findUnique({ where: { email }, select: { id: true, isActive: true, globalRole: true } });
    // Não cria perfis usando dados de terceiros; a conta deve existir e aceitar o vínculo.
    if (!target?.isActive || target.globalRole === "SYSTEM") {
      throw new BadRequestException("O convidado deve possuir uma conta ativa no AICorta");
    }
    const membership = await this.db.membership.findUnique({
      where: { userId_tenantId: { userId: target.id, tenantId } },
    });
    if (membership) throw new ConflictException("O usuário já possui vínculo com este estabelecimento");
    const token = randomBytes(32).toString("base64url");
    const invitation = await this.db.tenantInvitation.create({
      data: {
        tenantId, issuedById, email, role: dto.role, tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    // Token é retornado uma única vez, sem persistência em claro. Não compartilhar em logs.
    return { ...invitation, token };
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
