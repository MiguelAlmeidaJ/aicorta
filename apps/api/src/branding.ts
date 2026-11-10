import {
  BadRequestException, Body, Controller, Delete, Get, Injectable, NotFoundException,
  Param, Patch, Put, Res, UseGuards,
} from "@nestjs/common";
import { IsHexColor, IsOptional, IsString, MaxLength } from "class-validator";
import type { Response } from "express";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard, SystemGuard } from "./auth";
import { Throttle } from "@nestjs/throttler";

const DEFAULTS = {
  name: "AICorta",
  black: "#000000",
  navy: "#050A30",
  gold: "#F2C225",
  silver: "#D9D9D9",
};
const MAX_IMAGE_BYTES = 500 * 1024;
const assetFields = {
  logo: { bytes: "logo", mime: "logoMime" },
  dark: { bytes: "darkLogo", mime: "darkLogoMime" },
  favicon: { bytes: "favicon", mime: "faviconMime" },
  establishment: { bytes: "defaultTenantCover", mime: "defaultTenantCoverMime" },
  service: { bytes: "defaultServiceImage", mime: "defaultServiceImageMime" },
  avatar: { bytes: "defaultProfileImage", mime: "defaultProfileImageMime" },
} as const;
type Slot = keyof typeof assetFields;
function slotOf(value: string): Slot {
  if (!(value in assetFields)) throw new BadRequestException("Tipo de imagem inválido");
  return value as Slot;
}
function parseImage(dataUrl: string): { mime: string; bytes: Uint8Array } {
  if (typeof dataUrl !== "string" || dataUrl.length > Math.ceil(MAX_IMAGE_BYTES * 1.5) + 100) {
    throw new BadRequestException("Imagem muito grande (máximo 500 KB)");
  }
  const matched = /^data:(image\/(?:png|jpeg|webp|x-icon));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!matched) throw new BadRequestException("Use PNG, JPG, WEBP ou ICO em base64");
  const mime = matched[1];
  const bytes = Buffer.from(matched[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new BadRequestException("Imagem inválida ou acima de 500 KB");
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const isIco = bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0;
  if (!((mime === "image/png" && isPng) || (mime === "image/jpeg" && isJpeg) ||
    (mime === "image/webp" && isWebp) || (mime === "image/x-icon" && isIco))) {
    throw new BadRequestException("O conteúdo da imagem não corresponde ao formato informado");
  }
  return { mime, bytes };
}
export class UpdateBrandingDto {
  @IsOptional() @IsString() @MaxLength(50) name?: string;
  @IsOptional() @IsHexColor() black?: string;
  @IsOptional() @IsHexColor() navy?: string;
  @IsOptional() @IsHexColor() gold?: string;
  @IsOptional() @IsHexColor() silver?: string;
}
export class UploadBrandingDto {
  @IsString() dataUrl!: string;
}
@Injectable()
export class BrandingService {
  constructor(private readonly db: PrismaService) {}
  async publicSettings() {
    const settings = await this.db.platformBrand.findUnique({
      where: { id: "platform" },
      select: { name: true, black: true, navy: true, gold: true, silver: true,
        logoMime: true, darkLogoMime: true, faviconMime: true, defaultTenantCoverMime: true,
        defaultServiceImageMime: true, defaultProfileImageMime: true, updatedAt: true },
    });
    const version = settings?.updatedAt.getTime() ?? 0;
    const path = (slot: Slot, exists: boolean) => exists ? `/branding/assets/${slot}?v=${version}` : null;
    return {
      ...DEFAULTS,
      ...settings,
      assets: {
        logo: path("logo", !!settings?.logoMime),
        dark: path("dark", !!settings?.darkLogoMime),
        favicon: path("favicon", !!settings?.faviconMime),
      },
      defaultImages: {
        establishment: path("establishment", !!settings?.defaultTenantCoverMime),
        service: path("service", !!settings?.defaultServiceImageMime),
        avatar: path("avatar", !!settings?.defaultProfileImageMime),
      },
      updatedAt: settings?.updatedAt ?? null,
    };
  }
  async save(dto: UpdateBrandingDto) {
    const data = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.black !== undefined && { black: dto.black.toUpperCase() }),
      ...(dto.navy !== undefined && { navy: dto.navy.toUpperCase() }),
      ...(dto.gold !== undefined && { gold: dto.gold.toUpperCase() }),
      ...(dto.silver !== undefined && { silver: dto.silver.toUpperCase() }),
    };
    if (dto.name !== undefined && !dto.name.trim()) throw new BadRequestException("Nome da marca obrigatório");
    await this.db.platformBrand.upsert({ where: { id: "platform" },
      create: { id: "platform", ...DEFAULTS, ...data }, update: data });
    return this.publicSettings();
  }
  async upload(slotName: string, dataUrl: string) {
    const slot = slotOf(slotName);
    const image = parseImage(dataUrl);
    const field = assetFields[slot];
    await this.db.platformBrand.upsert({
      where: { id: "platform" },
      create: { id: "platform", ...DEFAULTS, [field.bytes]: image.bytes, [field.mime]: image.mime },
      update: { [field.bytes]: image.bytes, [field.mime]: image.mime },
    });
    return this.publicSettings();
  }
  async remove(slotName: string) {
    const slot = slotOf(slotName);
    const field = assetFields[slot];
    await this.db.platformBrand.upsert({
      where: { id: "platform" },
      create: { id: "platform", ...DEFAULTS },
      update: { [field.bytes]: null, [field.mime]: null },
    });
    return this.publicSettings();
  }
  async image(slotName: string, res: Response) {
    const slot = slotOf(slotName);
    const field = assetFields[slot];
    const row = await this.db.platformBrand.findUnique({ where: { id: "platform" },
      select: { logo: true, logoMime: true, darkLogo: true, darkLogoMime: true, favicon: true, faviconMime: true,
        defaultTenantCover: true, defaultTenantCoverMime: true, defaultServiceImage: true,
        defaultServiceImageMime: true, defaultProfileImage: true, defaultProfileImageMime: true } });
    const image = row?.[field.bytes];
    const mime = row?.[field.mime];
    if (!image || !mime) throw new NotFoundException("Imagem ainda não configurada");
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    return res.send(Buffer.from(image));
  }
}

@Controller("branding")
export class BrandingController {
  constructor(private readonly service: BrandingService) {}
  @Get() settings() { return this.service.publicSettings(); }
  @Get("assets/:slot")
  image(@Param("slot") slot: string, @Res() res: Response) { return this.service.image(slot, res); }
  @UseGuards(JwtAuthGuard, SystemGuard)
  @Patch() save(@Body() dto: UpdateBrandingDto) { return this.service.save(dto); }
  @UseGuards(JwtAuthGuard, SystemGuard)
  @Put("assets/:slot")
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  upload(@Param("slot") slot: string, @Body() dto: UploadBrandingDto) {
    return this.service.upload(slot, dto.dataUrl);
  }
  @UseGuards(JwtAuthGuard, SystemGuard)
  @Delete("assets/:slot") remove(@Param("slot") slot: string) { return this.service.remove(slot); }
}
