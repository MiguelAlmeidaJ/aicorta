import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, Patch, Post, Put, Res, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
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
  @IsOptional() @IsString() @Matches(/^(?:[A-Za-z]{2})?$/, { message: "Informe uma UF válida com duas letras, como MG." }) state?: string;
  @IsOptional() @IsString() @MaxLength(100) neighborhood?: string;
  @IsOptional() @IsString() @Matches(/^(?:[0-9]{8})?$/, { message: "Informe um CEP com oito dígitos." }) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(180) street?: string;
  @IsOptional() @IsString() @MaxLength(20) streetNumber?: string;
  @IsOptional() @IsString() @MaxLength(120) complement?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number | null;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number | null;
}

export class UpdateTenantCoverDto { @IsString() imageDataUrl!: string; }
export class LocateTenantDto {
  @IsString() @MinLength(3) @MaxLength(180) street!: string;
  @IsString() @MinLength(1) @MaxLength(20) streetNumber!: string;
  @IsString() @MinLength(2) @MaxLength(100) city!: string;
  @IsString() @Matches(/^[A-Z]{2}$/, { message: "Informe a UF com duas letras." }) state!: string;
  @IsOptional() @IsString() @MaxLength(100) neighborhood?: string;
  @IsOptional() @IsString() @Matches(/^[0-9]{8}$/) postalCode?: string;
}

const settingsSelect = {
  id: true, name: true, slug: true, timezone: true, status: true, billingDueDay: true,
  city: true, state: true, neighborhood: true, postalCode: true, street: true,
  streetNumber: true, complement: true, latitude: true, longitude: true, coverMime: true, updatedAt: true,
} as const;

@Injectable()
export class TenantSettingsService {
  constructor(private readonly db: PrismaService) {}
  async details(tenantId: string) {
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: settingsSelect });
    return { ...tenant, coverUrl: tenant.coverMime ? `/b/${tenant.slug}/cover?v=${tenant.updatedAt.getTime()}` : null };
  }
  async update(tenantId: string, dto: UpdateTenantSettingsDto) {
    if (Object.keys(dto).length === 0) return this.details(tenantId);
    const hasLatitude = dto.latitude !== undefined;
    const hasLongitude = dto.longitude !== undefined;
    if (hasLatitude !== hasLongitude || (hasLatitude && ((dto.latitude === null) !== (dto.longitude === null)))) {
      throw new BadRequestException("Informe latitude e longitude juntas ou limpe ambas.");
    }
    const addressChanged = ["city", "state", "neighborhood", "postalCode", "street", "streetNumber", "complement"]
      .some(key => Object.prototype.hasOwnProperty.call(dto, key));
    try {
      await this.db.tenant.update({ where: { id: tenantId },
        data: { ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.city !== undefined && { city: dto.city.trim() || null }),
          ...(dto.state !== undefined && { state: dto.state.trim().toUpperCase() || null }),
          ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood.trim() || null }),
          ...(dto.postalCode !== undefined && { postalCode: dto.postalCode.trim() || null }),
          ...(dto.street !== undefined && { street: dto.street.trim() || null }),
          ...(dto.streetNumber !== undefined && { streetNumber: dto.streetNumber.trim() || null }),
          ...(dto.complement !== undefined && { complement: dto.complement.trim() || null }),
          ...((hasLatitude && hasLongitude) && { latitude: dto.latitude, longitude: dto.longitude }),
          ...(addressChanged && !hasLatitude && { latitude: null, longitude: null }),
        } });
      return this.details(tenantId);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ConflictException("Este endereço de acesso já está em uso");
      }
      throw error;
    }
  }
  async geocode(dto: LocateTenantDto) {
    // Provedor comercial configurável: não depende de geocodificação pública sem limite.
    const key = process.env.GOOGLE_GEOCODING_API_KEY;
    if (!key) throw new ServiceUnavailableException(
      "Busca automática indisponível. Confirme a localização clicando no mapa ou configure o serviço de geocodificação.");
    const address = [dto.street + ", " + dto.streetNumber, dto.neighborhood, dto.city, dto.state,
      dto.postalCode, "Brasil"].filter(Boolean).join(", ");
    const params = new URLSearchParams({ address, key, region: "br", language: "pt-BR" });
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error("Geocoder HTTP");
      const result = await response.json() as {
        status: string; results?: Array<{
          formatted_address: string;
          geometry: { location: { lat: number; lng: number }; location_type: string };
          address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
        }>;
      };
      const point = result.results?.find(item => item.address_components.some(part =>
        part.types.includes("country") && part.short_name === "BR"));
      if (!point || !Number.isFinite(point.geometry.location.lat) ||
          !Number.isFinite(point.geometry.location.lng)) {
        throw new BadRequestException("O endereço não foi localizado. Confira os dados ou posicione o pin manualmente.");
      }
      return { latitude: point.geometry.location.lat, longitude: point.geometry.location.lng,
        formattedAddress: point.formatted_address, precision: point.geometry.location_type };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException("Não foi possível consultar o endereço. Ajuste o pin diretamente no mapa.");
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
  @Post("geocode")
  geocode(@Body() dto: LocateTenantDto) { return this.settings.geocode(dto); }
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
