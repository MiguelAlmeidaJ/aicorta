import { Body, ConflictException, Controller, Get, Injectable, Param, Patch, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard } from "./auth";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";

export class UpdateTenantSettingsDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MinLength(3) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(50) slug?: string;
}

@Injectable()
export class TenantSettingsService {
  constructor(private readonly db: PrismaService) {}
  details(tenantId: string) {
    return this.db.tenant.findUniqueOrThrow({ where: { id: tenantId },
      select: { id: true, name: true, slug: true, timezone: true, status: true, billingDueDay: true } });
  }
  async update(tenantId: string, dto: UpdateTenantSettingsDto) {
    if (dto.name === undefined && dto.slug === undefined) return this.details(tenantId);
    try {
      return await this.db.tenant.update({ where: { id: tenantId },
        data: { ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.slug !== undefined && { slug: dto.slug }) },
        select: { id: true, name: true, slug: true, timezone: true, status: true, billingDueDay: true } });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ConflictException("Este endereço de acesso já está em uso");
      }
      throw error;
    }
  }
}

@Controller("tenants/:tenantId/settings")
@UseGuards(JwtAuthGuard, TenantRoleGuard)
@TenantRoles("ADMIN")
export class TenantSettingsController {
  constructor(private readonly settings: TenantSettingsService) {}
  @Get()
  details(@Param("tenantId") tenantId: string) { return this.settings.details(tenantId); }
  @Patch()
  update(@Param("tenantId") tenantId: string, @Body() dto: UpdateTenantSettingsDto) {
    return this.settings.update(tenantId, dto);
  }
}
