import { BadRequestException, Body, Controller, Get, Injectable, NotFoundException, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsUUID } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard } from "./auth";
import { AgendaService } from "./agenda";
import { BookingService } from "./booking";
import { validDate } from "./scheduling-time";
import { BillingService } from "./billing";

export class PublicBookingDto {
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUUID("all", { each: true }) serviceIds?: string[];
  @IsUUID() employeeMembershipId!: string;
  @IsDateString() startsAt!: string;
}
export class RescheduleDto {
  @IsDateString() startsAt!: string;
}
@Injectable()
export class PublicBookingService {
  constructor(private readonly db: PrismaService, private readonly agenda: AgendaService,
    private readonly bookings: BookingService, private readonly billing: BillingService) {}
  async tenant(slug: string) {
    const tenant = await this.db.tenant.findFirst({ where: { slug, status: "ACTIVE" },
      select: { id: true, name: true, slug: true, timezone: true, bookingAdvanceDays: true, city: true, state: true,
        neighborhood: true, postalCode: true, street: true, streetNumber: true, complement: true,
        latitude: true, longitude: true, coverMime: true, updatedAt: true } });
    if (!tenant) throw new BadRequestException("Barbearia não encontrada");
    const financial = await this.billing.refreshTenantState(tenant.id);
    if (!financial.operational) throw new BadRequestException("Barbearia temporariamente indisponível");
    return tenant;
  }
  async discover(query = "") {
    const term = query.trim().slice(0, 80);
    const [tenants, branding] = await Promise.all([this.db.tenant.findMany({
      where: { status: "ACTIVE", ...(term && { OR: [
        { name: { contains: term, mode: "insensitive" } },
        { city: { contains: term, mode: "insensitive" } },
        { neighborhood: { contains: term, mode: "insensitive" } },
        { state: { contains: term, mode: "insensitive" } },
      ] }) },
      select: {
        id: true, name: true, slug: true, city: true, state: true, neighborhood: true,
        postalCode: true, street: true, streetNumber: true, complement: true, latitude: true, longitude: true,
        coverMime: true, updatedAt: true,

      },
      orderBy: { name: "asc" }, take: 24,
    }), this.db.platformBrand.findUnique({ where: { id: "platform" },
      select: { defaultTenantCoverMime: true, updatedAt: true } })]);
    const defaultCover = branding?.defaultTenantCoverMime ?
      `/branding/assets/establishment?v=${branding.updatedAt.getTime()}` : null;
    return tenants.map(tenant => {
      return {
        id: tenant.id, name: tenant.name, slug: tenant.slug,
        city: tenant.city, state: tenant.state, neighborhood: tenant.neighborhood,
        postalCode: tenant.postalCode, street: tenant.street, streetNumber: tenant.streetNumber,
        complement: tenant.complement, latitude: tenant.latitude, longitude: tenant.longitude,
        hasCustomCover: Boolean(tenant.coverMime),
        coverUrl: tenant.coverMime ? `/b/${tenant.slug}/cover?v=${tenant.updatedAt.getTime()}` : defaultCover,
      };
    });
  }
  async catalog(slug: string) {
    const tenant = await this.tenant(slug);
    const [services, professionals, branding] = await Promise.all([
      this.db.service.findMany({ where: { tenantId: tenant.id, isActive: true },
        select: { id: true, name: true, description: true, durationMinutes: true, priceCents: true,
          imageMime: true, updatedAt: true },
        orderBy: { name: "asc" } }),
      this.db.membership.findMany({ where: { tenantId: tenant.id, isActive: true,
        role: { in: ["ADMIN", "EMPLOYEE"] }, appearsInAgenda: true, services: { some: { service: { isActive: true } } } },
        select: { id: true, user: { select: { name: true, avatarMime: true, updatedAt: true } },
          services: { where: { service: { isActive: true } }, select: { serviceId: true } } },
      }),
      this.db.platformBrand.findUnique({ where: { id: "platform" }, select: {
        defaultTenantCoverMime: true, defaultServiceImageMime: true, defaultProfileImageMime: true, updatedAt: true,
      } }),
    ]);
    const defaultImageUrl = branding?.defaultServiceImageMime ?
      `/branding/assets/service?v=${branding.updatedAt.getTime()}` : null;
    const fallbackService = services.find(service => service.imageMime);
    const tenantView = { ...tenant,
      coverUrl: tenant.coverMime ? `/b/${tenant.slug}/cover?v=${tenant.updatedAt.getTime()}` :
        branding?.defaultTenantCoverMime ? `/branding/assets/establishment?v=${branding.updatedAt.getTime()}` : null };
    return { tenant: tenantView, services: services.map(service => ({ ...service,
      imageUrl: service.imageMime ? `/tenants/${tenant.id}/services/${service.id}/image?v=${service.updatedAt.getTime()}` :
        defaultImageUrl ?? (fallbackService ? `/tenants/${tenant.id}/services/${fallbackService.id}/image?v=${fallbackService.updatedAt.getTime()}` : null) })),
      professionals: professionals.map(p => ({
      id: p.id, name: p.user.name, serviceIds: p.services.map(s => s.serviceId),
      avatarUrl: p.user.avatarMime ? `/b/${tenant.slug}/professionals/${p.id}/avatar?v=${p.user.updatedAt.getTime()}`
        : branding?.defaultProfileImageMime ? `/branding/assets/avatar?v=${branding.updatedAt.getTime()}` : null,
    })) };
  }
  async professionalAvatar(slug: string, memberId: string, res: import("express").Response) {
    const tenant = await this.tenant(slug);
    const professional = await this.db.membership.findFirst({
      where: { id: memberId, tenantId: tenant.id, isActive: true, appearsInAgenda: true,
        role: { in: ["ADMIN", "EMPLOYEE"] } },
      select: { user: { select: { avatar: true, avatarMime: true } } },
    });
    if (!professional?.user.avatar || !professional.user.avatarMime) {
      throw new NotFoundException("Foto do profissional não encontrada");
    }
    res.setHeader("Content-Type", professional.user.avatarMime);
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.send(Buffer.from(professional.user.avatar));
  }

  async slots(slug: string, serviceIds: string[], memberId: string, date: string) {
    if (!validDate(date) || !serviceIds.length || !memberId) throw new BadRequestException("Data, serviço ou profissional inválido");
    const tenant = await this.tenant(slug);
    return this.agenda.availabilityForServices(tenant.id, serviceIds, memberId, date);
  }
  async create(slug: string, userId: string, dto: PublicBookingDto) {
    const tenant = await this.tenant(slug);
    const serviceIds = dto.serviceIds?.length ? dto.serviceIds : dto.serviceId ? [dto.serviceId] : [];
    if (!serviceIds.length) throw new BadRequestException("Selecione ao menos um serviço");
    return this.bookings.create(tenant.id, userId, { ...dto, serviceIds, serviceId: serviceIds[0], clientId: userId }, true);
  }
  async reschedule(slug: string, userId: string, id: string, dto: RescheduleDto) {
    const tenant = await this.tenant(slug);
    return this.bookings.reschedule(tenant.id, id, userId, dto.startsAt);
  }
  async cancel(slug: string, userId: string, id: string) {
    const tenant = await this.tenant(slug);
    return this.bookings.cancel(tenant.id, id, userId);
  }
}
@Controller()
export class PublicBookingController {
  constructor(private readonly publicBooking: PublicBookingService, private readonly bookings: BookingService) {}
  @Get("public/tenants")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  discover(@Query("q") query?: string) { return this.publicBooking.discover(query); }

  @Get("b/:slug")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  catalog(@Param("slug") slug: string) { return this.publicBooking.catalog(slug); }

  @Get("b/:slug/professionals/:memberId/avatar")
  avatar(@Param("slug") slug: string, @Param("memberId") memberId: string,
    @Res() res: import("express").Response) {
    return this.publicBooking.professionalAvatar(slug, memberId, res);
  }

  @Get("b/:slug/slots")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  slots(@Param("slug") slug: string, @Query("serviceIds") serviceIds: string, @Query("serviceId") serviceId: string,
    @Query("membershipId") memberId: string, @Query("date") date: string) {
    const ids = serviceIds?.split(",").filter(Boolean) ?? (serviceId ? [serviceId] : []);
    return this.publicBooking.slots(slug, ids, memberId, date);
  }

  @UseGuards(JwtAuthGuard) @Post("b/:slug/bookings")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Param("slug") slug: string, @Req() req: { user: { id: string } }, @Body() dto: PublicBookingDto) {
    return this.publicBooking.create(slug, req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard) @Get("my/bookings")
  mine(@Req() req: { user: { id: string } }) { return this.bookings.mine(req.user.id); }

  @UseGuards(JwtAuthGuard) @Patch("b/:slug/bookings/:id/cancel")
  cancel(@Param("slug") slug: string, @Param("id") id: string, @Req() req: { user: { id: string } }) {
    return this.publicBooking.cancel(slug, req.user.id, id);
  }

  @UseGuards(JwtAuthGuard) @Patch("b/:slug/bookings/:id/reschedule")
  reschedule(@Param("slug") slug: string, @Param("id") id: string,
    @Req() req: { user: { id: string } }, @Body() dto: RescheduleDto) {
    return this.publicBooking.reschedule(slug, req.user.id, id, dto);
  }
}
