import { BadRequestException, Body, Controller, Get, Injectable, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { IsDateString, IsUUID } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard } from "./auth";
import { AgendaService } from "./agenda";
import { BookingService, CreateAppointmentDto } from "./booking";
import { validDate } from "./scheduling-time";

export class PublicBookingDto {
  @IsUUID() serviceId!: string;
  @IsUUID() employeeMembershipId!: string;
  @IsDateString() startsAt!: string;
}
export class RescheduleDto {
  @IsDateString() startsAt!: string;
}
@Injectable()
export class PublicBookingService {
  constructor(private readonly db: PrismaService, private readonly agenda: AgendaService, private readonly bookings: BookingService) {}
  async tenant(slug: string) {
    const tenant = await this.db.tenant.findFirst({ where: { slug, status: "ACTIVE" },
      select: { id: true, name: true, slug: true, timezone: true } });
    if (!tenant) throw new BadRequestException("Barbearia não encontrada");
    return tenant;
  }
  async catalog(slug: string) {
    const tenant = await this.tenant(slug);
    const [services, professionals] = await Promise.all([
      this.db.service.findMany({ where: { tenantId: tenant.id, isActive: true },
        select: { id: true, name: true, description: true, durationMinutes: true, priceCents: true },
        orderBy: { name: "asc" } }),
      this.db.membership.findMany({ where: { tenantId: tenant.id, isActive: true,
        role: { in: ["ADMIN", "EMPLOYEE"] }, services: { some: { service: { isActive: true } } } },
        select: { id: true, user: { select: { name: true } },
          services: { where: { service: { isActive: true } }, select: { serviceId: true } } },
      }),
    ]);
    return { tenant, services, professionals: professionals.map(p => ({
      id: p.id, name: p.user.name, serviceIds: p.services.map(s => s.serviceId),
    })) };
  }
  async slots(slug: string, serviceId: string, memberId: string, date: string) {
    if (!validDate(date) || !serviceId || !memberId) throw new BadRequestException("Data, serviço ou profissional inválido");
    const tenant = await this.tenant(slug);
    return this.agenda.availability(tenant.id, serviceId, memberId, date);
  }
  async create(slug: string, userId: string, dto: PublicBookingDto) {
    const tenant = await this.tenant(slug);
    return this.bookings.create(tenant.id, userId, { ...dto, clientId: userId }, true);
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
  @Get("b/:slug")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  catalog(@Param("slug") slug: string) { return this.publicBooking.catalog(slug); }

  @Get("b/:slug/slots")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  slots(@Param("slug") slug: string, @Query("serviceId") serviceId: string,
    @Query("membershipId") memberId: string, @Query("date") date: string) {
    return this.publicBooking.slots(slug, serviceId, memberId, date);
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
