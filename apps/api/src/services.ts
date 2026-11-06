import {
  Body, Controller, Get, Injectable, NotFoundException, Param, Patch, Post, UseGuards,
} from "@nestjs/common";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard } from "./auth";
import { TenantRoleGuard, TenantRoles } from "./tenant-role.guard";

export class CreateServiceDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsInt() @Min(5) @Max(480) durationMinutes!: number;
  @IsInt() @Min(0) @Max(100000000) priceCents!: number;
}
export class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() @Min(5) @Max(480) durationMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000000) priceCents?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Injectable()
export class ServiceCatalogService {
  constructor(private readonly db: PrismaService) {}

  async list(tenantId: string) {
    return this.db.service.findMany({
      where: { tenantId, isActive: true, tenant: { status: "ACTIVE" } },
      select: { id: true, name: true, description: true, durationMinutes: true, priceCents: true },
      orderBy: { name: "asc" },
    });
  }

  async listManaged(tenantId: string) {
    return this.db.service.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(tenantId: string, dto: CreateServiceDto) {
    return this.db.service.create({
      data: {
        tenantId, name: dto.name.trim(), description: dto.description?.trim(),
        durationMinutes: dto.durationMinutes, priceCents: dto.priceCents,
      },
    });
  }

  async update(tenantId: string, serviceId: string, dto: UpdateServiceDto) {
    const exists = await this.db.service.findFirst({ where: { id: serviceId, tenantId }, select: { id: true } });
    if (!exists) throw new NotFoundException("Serviço não encontrado");
    // Atualiza pela chave composta: nunca pode escrever em outro estabelecimento.
    return this.db.service.update({
      where: { id_tenantId: { id: serviceId, tenantId } },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description.trim() }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
        ...(dto.priceCents !== undefined && { priceCents: dto.priceCents }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
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
  @Post()
  create(@Param("tenantId") tenantId: string, @Body() dto: CreateServiceDto) { return this.catalog.create(tenantId, dto); }

  @UseGuards(JwtAuthGuard, TenantRoleGuard) @TenantRoles("ADMIN")
  @Patch(":serviceId")
  update(@Param("tenantId") tenantId: string, @Param("serviceId") serviceId: string, @Body() dto: UpdateServiceDto) {
    return this.catalog.update(tenantId, serviceId, dto);
  }
}
