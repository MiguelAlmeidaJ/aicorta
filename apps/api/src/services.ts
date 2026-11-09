import {
  BadRequestException, Body, Controller, Get, Injectable, NotFoundException,
  Param, Patch, Post, Res, UseGuards,
} from "@nestjs/common";
import {
  ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min, MinLength,
} from "class-validator";
import type { Response } from "express";
import { PrismaService } from "./prisma.service";
import type { Prisma } from "./generated/prisma/client";
import { JwtAuthGuard } from "./auth";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";

const MAX_IMAGE_BYTES = 500 * 1024;
const managedSelect = {
  id: true, name: true, description: true, durationMinutes: true, priceCents: true,
  isActive: true, createdAt: true, updatedAt: true, imageMime: true,
  employees: { select: { membership: { select: { id: true, user: { select: { name: true } } } } } },
} as const;

export function imageDimensions(bytes: Buffer, mime: string): { width: number; height: number } | null {
  if (mime === "image/png" && bytes.length >= 33 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      bytes.toString("ascii", 12, 16) === "IHDR") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (mime === "image/jpeg" && bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
      }
      offset += length;
    }
  }
  if (mime === "image/webp" && bytes.length >= 30 &&
      bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { width, height };
    }
    if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
      return {
        width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
        height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
      };
    }
  }
  return null;
}

export function parseServiceImage(dataUrl: string): { mime: string; bytes: Uint8Array<ArrayBuffer> } {
  if (typeof dataUrl !== "string" || dataUrl.length > Math.ceil(MAX_IMAGE_BYTES * 1.5) + 100) {
    throw new BadRequestException("A foto deve ter no máximo 500 KB");
  }
  const matched = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!matched) throw new BadRequestException("A foto deve estar em PNG, JPG ou WEBP");
  const decoded = Buffer.from(matched[2], "base64");
  if (!decoded.length || decoded.length > MAX_IMAGE_BYTES) {
    throw new BadRequestException("A foto deve ter no máximo 500 KB");
  }
  const dimensions = imageDimensions(decoded, matched[1]);
  if (!dimensions) throw new BadRequestException("O conteúdo da foto é inválido");
  if (dimensions.width !== 1080 || dimensions.height !== 1080) {
    throw new BadRequestException("A foto final precisa ter exatamente 1080 × 1080 pixels");
  }
  const bytes = new Uint8Array(decoded.length);
  bytes.set(decoded);
  return { mime: matched[1], bytes };
}

export class CreateServiceDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsInt() @Min(5) @Max(480) durationMinutes!: number;
  @IsInt() @Min(0) @Max(100000000) priceCents!: number;
  @IsOptional() @IsString() imageDataUrl?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID("4", { each: true }) professionalIds?: string[];
}
export class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() @Min(5) @Max(480) durationMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000000) priceCents?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() imageDataUrl?: string | null;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID("4", { each: true }) professionalIds?: string[];
}

@Injectable()
export class ServiceCatalogService {
  constructor(private readonly db: PrismaService) {}

  private async defaultImageUrl() {
    const branding = await this.db.platformBrand.findUnique({ where: { id: "platform" },
      select: { defaultServiceImageMime: true, updatedAt: true } });
    return branding?.defaultServiceImageMime ? `/branding/assets/service?v=${branding.updatedAt.getTime()}` : null;
  }

  async list(tenantId: string) {
    const [services, defaultImageUrl] = await Promise.all([this.db.service.findMany({
      where: { tenantId, isActive: true, tenant: { status: "ACTIVE" } },
      select: {
        id: true, name: true, description: true, durationMinutes: true, priceCents: true,
        updatedAt: true, imageMime: true,
      },
      orderBy: { name: "asc" },
    }), this.defaultImageUrl()]);
    const fallbackImage = services.find(service => service.imageMime);
    return services.map(service => ({ ...service,
      imageUrl: service.imageMime ? `/tenants/${tenantId}/services/${service.id}/image?v=${service.updatedAt.getTime()}` :
        defaultImageUrl ?? (fallbackImage ? `/tenants/${tenantId}/services/${fallbackImage.id}/image?v=${fallbackImage.updatedAt.getTime()}` : null) }));
  }

  async listManaged(tenantId: string) {
    const [services, defaultImageUrl] = await Promise.all([this.db.service.findMany({
      where: { tenantId }, select: managedSelect, orderBy: { createdAt: "desc" },
    }), this.defaultImageUrl()]);
    const fallbackImage = services.find(service => service.imageMime);
    return services.map(service => ({ ...service,
      professionals: service.employees.map(item => item.membership), employees: undefined,
      imageUrl: service.imageMime ? `/tenants/${tenantId}/services/${service.id}/image?v=${service.updatedAt.getTime()}` :
        defaultImageUrl ?? (fallbackImage ? `/tenants/${tenantId}/services/${fallbackImage.id}/image?v=${fallbackImage.updatedAt.getTime()}` : null) }));
  }

  async managedDetails(tenantId: string, serviceId: string) {
    const service = await this.db.service.findFirst({
      where: { id: serviceId, tenantId }, select: managedSelect,
    });
    if (!service) throw new NotFoundException("Serviço não encontrado");
    const defaultImageUrl = service.imageMime ? null : await this.defaultImageUrl();
    const fallbackImage = service.imageMime || defaultImageUrl ? null : await this.db.service.findFirst({
      where: { tenantId, imageMime: { not: null } }, select: { id: true, updatedAt: true }, orderBy: { createdAt: "asc" },
    });
    return { ...service,
      professionalIds: service.employees.map(item => item.membership.id), employees: undefined,
      imageUrl: service.imageMime ? `/tenants/${tenantId}/services/${service.id}/image?v=${service.updatedAt.getTime()}` :
        defaultImageUrl ?? (fallbackImage ? `/tenants/${tenantId}/services/${fallbackImage.id}/image?v=${fallbackImage.updatedAt.getTime()}` : null) };
  }

  async professionals(tenantId: string) {
    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        ownerId: true,
        memberships: {
          where: { isActive: true, role: { in: ["ADMIN", "EMPLOYEE"] } },
          select: { id: true, role: true, userId: true, user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!tenant) throw new NotFoundException("Barbearia não encontrada");
    return tenant.memberships.map(member => ({ ...member, isOwner: member.userId === tenant.ownerId }));
  }

  private async resolveProfessionals(tx: Prisma.TransactionClient,
      tenantId: string, requested: string[] | undefined) {
    let ids = [...new Set(requested ?? [])];
    if (!ids.length) {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { ownerId: true } });
      if (!tenant) throw new NotFoundException("Barbearia não encontrada");
      const owner = await tx.membership.findUnique({
        where: { userId_tenantId: { userId: tenant.ownerId, tenantId } }, select: { id: true, isActive: true },
      });
      if (!owner?.isActive) throw new BadRequestException("O proprietário precisa ter um vínculo ativo");
      ids = [owner.id];
    }
    const professionals = await tx.membership.findMany({
      where: { id: { in: ids }, tenantId, isActive: true, role: { in: ["ADMIN", "EMPLOYEE"] } },
      select: { id: true },
    });
    if (professionals.length !== ids.length) {
      throw new BadRequestException("Um ou mais profissionais não pertencem a esta barbearia");
    }
    return ids;
  }

  async create(tenantId: string, dto: CreateServiceDto) {
    const image = dto.imageDataUrl ? parseServiceImage(dto.imageDataUrl) : null;
    return this.db.$transaction(async tx => {
      const professionalIds = await this.resolveProfessionals(tx, tenantId, dto.professionalIds);
      const service = await tx.service.create({
        data: {
          tenantId, name: dto.name.trim(), description: dto.description?.trim(),
          durationMinutes: dto.durationMinutes, priceCents: dto.priceCents,
          ...(image && { image: image.bytes, imageMime: image.mime }),
        },
      });
      await tx.employeeService.createMany({
        data: professionalIds.map(membershipId => ({ membershipId, serviceId: service.id })),
      });
      return tx.service.findUniqueOrThrow({ where: { id: service.id }, select: managedSelect });
    });
  }

  async update(tenantId: string, serviceId: string, dto: UpdateServiceDto) {
    const exists = await this.db.service.findFirst({ where: { id: serviceId, tenantId }, select: { id: true } });
    if (!exists) throw new NotFoundException("Serviço não encontrado");
    const image = typeof dto.imageDataUrl === "string" ? parseServiceImage(dto.imageDataUrl) : dto.imageDataUrl;
    const data = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.description !== undefined && { description: dto.description.trim() }),
      ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
      ...(dto.priceCents !== undefined && { priceCents: dto.priceCents }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(image !== undefined && (image === null ? { image: null, imageMime: null } :
        { image: image.bytes, imageMime: image.mime })),
    };
    if (dto.professionalIds === undefined) {
      return this.db.service.update({
        where: { id_tenantId: { id: serviceId, tenantId } }, data,
      });
    }
    return this.db.$transaction(async tx => {
      const professionalIds = await this.resolveProfessionals(tx, tenantId, dto.professionalIds);
      const service = await tx.service.update({
        where: { id_tenantId: { id: serviceId, tenantId } }, data,
      });
      await tx.employeeService.deleteMany({ where: { serviceId } });
      await tx.employeeService.createMany({
        data: professionalIds.map(membershipId => ({ membershipId, serviceId })),
      });
      return service;
    });
  }

  async image(tenantId: string, serviceId: string, res: Response) {
    const service = await this.db.service.findFirst({
      where: { id: serviceId, tenantId }, select: { image: true, imageMime: true },
    });
    if (!service?.image || !service.imageMime) throw new NotFoundException("Foto do serviço não encontrada");
    res.setHeader("Content-Type", service.imageMime);
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    return res.send(Buffer.from(service.image));
  }
}

@Controller("tenants/:tenantId/services")
export class ServiceCatalogController {
  constructor(private readonly catalog: ServiceCatalogService) {}

  @Get() list(@Param("tenantId") tenantId: string) { return this.catalog.list(tenantId); }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Get("manage")
  manage(@Param("tenantId") tenantId: string) { return this.catalog.listManaged(tenantId); }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Get("manage/:serviceId")
  managedDetails(@Param("tenantId") tenantId: string, @Param("serviceId") serviceId: string) {
    return this.catalog.managedDetails(tenantId, serviceId);
  }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Get("professionals")
  professionals(@Param("tenantId") tenantId: string) { return this.catalog.professionals(tenantId); }

  @Get(":serviceId/image")
  image(@Param("tenantId") tenantId: string, @Param("serviceId") serviceId: string, @Res() res: Response) {
    return this.catalog.image(tenantId, serviceId, res);
  }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Post()
  create(@Param("tenantId") tenantId: string, @Body() dto: CreateServiceDto) { return this.catalog.create(tenantId, dto); }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Patch(":serviceId")
  update(@Param("tenantId") tenantId: string, @Param("serviceId") serviceId: string, @Body() dto: UpdateServiceDto) {
    return this.catalog.update(tenantId, serviceId, dto);
  }
}
