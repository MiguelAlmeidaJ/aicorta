import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, Patch, Put, Res, UseGuards } from "@nestjs/common";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import type { Response } from "express";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard } from "./auth";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";
import { imageDimensions } from "./services";

const MAX_COVER_BYTES = 500 * 1024;
export function parseTenantCover(dataUrl: string) {
  const matched = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!matched) throw new BadRequestException("A capa deve estar em PNG, JPG ou WEBP");
  const decoded = Buffer.from(matched[2], "base64");
  if (!decoded.length || decoded.length > MAX_COVER_BYTES) throw new BadRequestException("A capa deve ter no máximo 500 KB");
  const dimensions = imageDimensions(decoded, matched[1]);
  if (!dimensions || dimensions.width !== 1280 || dimensions.height !== 520) {
    throw new BadRequestException("A capa final precisa ter exatamente 1280 × 520 pixels");
  }
  const bytes = new Uint8Array(decoded.length); bytes.set(decoded);
  return { mime: matched[1], bytes };
}

export class UpdateTenantSettingsDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MinLength(3) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(50) slug?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z]{2}$/) state?: string;
  @IsOptional() @IsString() @MaxLength(100) neighborhood?: string;
}

export class UpdateTenantCoverDto { @IsString() imageDataUrl!: string; }

const settingsSelect = {
  id: true, name: true, slug: true, timezone: true, status: true, billingDueDay: true,
  city: true, state: true, neighborhood: true, coverMime: true, updatedAt: true,
} as const;

@Injectable()
export class TenantSettingsService {
  constructor(private readonly db: PrismaService) {}
  async details(tenantId: string) {
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: settingsSelect });
    return { ...tenant, coverUrl: tenant.coverMime ? `/b/${tenant.slug}/cover?v=${tenant.updatedAt.getTime()}` : null };
  }
  async update(tenantId: string, dto: UpdateTenantSettingsDto) {
    if (dto.name === undefined && dto.slug === undefined && dto.city === undefined &&
        dto.state === undefined && dto.neighborhood === undefined) return this.details(tenantId);
    try {
      await this.db.tenant.update({ where: { id: tenantId },
        data: { ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.city !== undefined && { city: dto.city.trim() || null }),
          ...(dto.state !== undefined && { state: dto.state.trim().toUpperCase() || null }),
          ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood.trim() || null }),
        } });
      return this.details(tenantId);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ConflictException("Este endereço de acesso já está em uso");
      }
      throw error;
    }
  }
  async updateCover(tenantId: string, dataUrl: string) {
    const image = parseTenantCover(dataUrl);
    await this.db.tenant.update({ where: { id: tenantId }, data: { cover: image.bytes, coverMime: image.mime } });
    return this.details(tenantId);
  }
  async removeCover(tenantId: string) {
    await this.db.tenant.update({ where: { id: tenantId }, data: { cover: null, coverMime: null } });
    return this.details(tenantId);
  }
  async cover(slug: string, res: Response) {
    const tenant = await this.db.tenant.findFirst({ where: { slug, status: "ACTIVE" }, select: { cover: true, coverMime: true } });
    if (!tenant?.cover || !tenant.coverMime) throw new NotFoundException("Capa não encontrada");
    res.setHeader("Content-Type", tenant.coverMime);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    return res.send(Buffer.from(tenant.cover));
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
  @Put("cover")
  updateCover(@Param("tenantId") tenantId: string, @Body() dto: UpdateTenantCoverDto) {
    return this.settings.updateCover(tenantId, dto.imageDataUrl);
  }
  @Delete("cover")
  removeCover(@Param("tenantId") tenantId: string) { return this.settings.removeCover(tenantId); }
}

@Controller("b")
export class TenantCoverController {
  constructor(private readonly settings: TenantSettingsService) {}
  @Get(":slug/cover")
  cover(@Param("slug") slug: string, @Res() res: Response) { return this.settings.cover(slug, res); }
}
