import { BadRequestException, Controller, Get, Injectable, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PrismaService } from "./prisma.service";
import { AgendaService } from "./agenda";
import { BillingService } from "./billing";
import { insideBookingHorizon, localParts, localToUtc, validDate } from "./scheduling-time";

const PAGE_SIZE = 9;
const MAX_CANDIDATES = 45;
const MAX_PROFESSIONALS = 3;
const CLOSEST_DAYS = 7;

export function parseDirectoryPage(input?: string) {
  const value = Number(input ?? "1");
  if (!Number.isSafeInteger(value) || value < 1 || value > 10000) {
    throw new BadRequestException("Página inválida.");
  }
  return value;
}
export function parseRequestedTime(time: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new BadRequestException("Informe o horário no formato HH:mm.");
  }
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}
function nextDate(date: string, days: number) {
  const result = new Date(date + "T12:00:00.000Z");
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function closestSlot(slots: string[], desired: Date) {
  return slots.map(startsAt => ({ startsAt, distance: Math.abs(new Date(startsAt).getTime() - desired.getTime()) }))
    .filter(entry => Number.isFinite(entry.distance))
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

@Injectable()
export class PublicDirectoryService {
  constructor(private readonly db: PrismaService, private readonly agenda: AgendaService,
    private readonly billing: BillingService) {}

  async list(query = "", pageInput?: string) {
    const page = parseDirectoryPage(pageInput);
    const term = query.trim().slice(0, 80);
    const where = { status: "ACTIVE" as const, ...(term && { OR: [
      { name: { contains: term, mode: "insensitive" as const } },
      { city: { contains: term, mode: "insensitive" as const } },
      { neighborhood: { contains: term, mode: "insensitive" as const } },
      { state: { contains: term, mode: "insensitive" as const } },
    ] }) };
    const [total, shops, branding] = await Promise.all([
      this.db.tenant.count({ where }),
      this.db.tenant.findMany({ where, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
        select: { id: true, name: true, slug: true, city: true, state: true, neighborhood: true,
          street: true, streetNumber: true, latitude: true, longitude: true, coverMime: true, updatedAt: true },
        orderBy: [{ name: "asc" }, { id: "asc" }] }),
      this.db.platformBrand.findUnique({ where: { id: "platform" },
        select: { defaultTenantCoverMime: true, updatedAt: true } }),
    ]);
    const coverFallback = branding?.defaultTenantCoverMime ?
      `/branding/assets/establishment?v=${branding.updatedAt.getTime()}` : null;
    return {
      items: shops.map(shop => ({
        id: shop.id, name: shop.name, slug: shop.slug, city: shop.city, state: shop.state,
        neighborhood: shop.neighborhood, street: shop.street, streetNumber: shop.streetNumber,
        latitude: shop.latitude, longitude: shop.longitude,
        hasCustomCover: !!shop.coverMime,
        coverUrl: shop.coverMime ? `/b/${shop.slug}/cover?v=${shop.updatedAt.getTime()}` : coverFallback,
      })),
      page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE),
    };
  }

  async quickBooking(serviceTerm: string, date: string, time: string) {
    const term = serviceTerm.trim();
    if (term.length < 2 || term.length > 80) {
      throw new BadRequestException("Informe um serviço com pelo menos 2 caracteres.");
    }
    if (!validDate(date)) throw new BadRequestException("Informe uma data válida.");
    const minute = parseRequestedTime(time);
    // Consulta apenas serviços ativos, profissionais que realizam o serviço
    // e estabelecimentos ativos. Limites evitam buscas indiscriminadas no banco.
    const [services, brand] = await Promise.all([
      this.db.service.findMany({
        where: { isActive: true, name: { contains: term, mode: "insensitive" },
          tenant: { status: "ACTIVE" },
          employees: { some: { membership: { isActive: true, appearsInAgenda: true,
            role: { in: ["ADMIN", "EMPLOYEE"] } } } } },
        select: {
          id: true, name: true, durationMinutes: true, priceCents: true,
          tenant: { select: { id: true, name: true, slug: true, timezone: true,
            bookingAdvanceDays: true, city: true, state: true, neighborhood: true,
            coverMime: true, updatedAt: true } },
          employees: { where: { membership: { isActive: true, appearsInAgenda: true,
            role: { in: ["ADMIN", "EMPLOYEE"] } } },
            take: MAX_PROFESSIONALS, select: { membershipId: true } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }], take: MAX_CANDIDATES,
      }),
      this.db.platformBrand.findUnique({ where: { id: "platform" },
        select: { defaultTenantCoverMime: true, updatedAt: true } }),
    ]);
    const fallbackCover = brand?.defaultTenantCoverMime ?
      `/branding/assets/establishment?v=${brand.updatedAt.getTime()}` : null;
    // No máximo dois serviços por barbearia; um mesmo estabelecimento não
    // aparece repetido, mesmo que vários nomes correspondam à busca.
    const grouped = new Map<string, typeof services>();
    for (const service of services) {
      if (!grouped.has(service.tenant.id)) grouped.set(service.tenant.id, []);
      if (grouped.get(service.tenant.id)!.length < 2) grouped.get(service.tenant.id)!.push(service);
    }

    const candidates = [...grouped.values()].slice(0, 24);
    const found: Array<{
      id: string; name: string; slug: string; city: string | null; state: string | null;
      neighborhood: string | null; coverUrl: string | null; hasCustomCover: boolean;
      serviceId: string; serviceName: string; durationMinutes: number; priceCents: number;
      membershipId: string; startsAt: string; exact: boolean; offsetMinutes: number; dayOffset: number;
    }> = [];
    // Execução em pequenos lotes reduz pressão sobre PostgreSQL e evita
    // disparar centenas de consultas simultaneamente.
    for (let index = 0; index < candidates.length; index += 4) {
      const batch = candidates.slice(index, index + 4);
      const matches = await Promise.all(batch.map(async group => {
        const tenant = group[0].tenant;
        if (!insideBookingHorizon(date, tenant.timezone, tenant.bookingAdvanceDays ?? 21)) return null;
        const target = localToUtc(date, minute, tenant.timezone);
        if (!target) return null;
        const billing = await this.billing.refreshTenantState(tenant.id);
        if (!billing.operational) return null;
        let winner: { startsAt: string; service: typeof group[number]; membershipId: string;
          distance: number; dayOffset: number } | null = null;
        // Primeiro tenta o dia solicitado; caso não exista horário, busca até 7 dias seguintes.
        for (let dayOffset = 0; dayOffset <= CLOSEST_DAYS; dayOffset++) {
          const candidateDate = nextDate(date, dayOffset);
          if (!insideBookingHorizon(candidateDate, tenant.timezone, tenant.bookingAdvanceDays ?? 21)) break;
          const checks = group.flatMap(service => service.employees.map(employee => ({
            service, membershipId: employee.membershipId,
          })));
          const results = await Promise.all(checks.map(async check => {
            try {
              const availability = await this.agenda.availabilityForServices(
                tenant.id, [check.service.id], check.membershipId, candidateDate);
              const closest = closestSlot(availability.slots, target);
              return closest ? { ...check, ...closest, dayOffset } : null;
            } catch { return null; } // Profissional desativado/expediente alterado durante a consulta.
          }));
          const choices = results.filter((result): result is NonNullable<typeof result> => result !== null);
          choices.sort((a, b) => a.distance - b.distance);
          if (choices[0]) {
            winner = choices[0];
            break;
          }
        }
        if (!winner) return null;
        const actual = localParts(new Date(winner.startsAt), tenant.timezone);
        return {
          id: tenant.id, name: tenant.name, slug: tenant.slug,
          city: tenant.city, state: tenant.state, neighborhood: tenant.neighborhood,
          coverUrl: tenant.coverMime ? `/b/${tenant.slug}/cover?v=${tenant.updatedAt.getTime()}` : fallbackCover,
          hasCustomCover: !!tenant.coverMime,
          serviceId: winner.service.id, serviceName: winner.service.name,
          durationMinutes: winner.service.durationMinutes, priceCents: winner.service.priceCents,
          membershipId: winner.membershipId, startsAt: winner.startsAt,
          exact: actual.date === date && actual.minute === minute,
          offsetMinutes: Math.round(winner.distance / 60000), dayOffset: winner.dayOffset,
        };
      }));
      found.push(...matches.filter((match): match is NonNullable<typeof match> => match !== null));
    }
    found.sort((a, b) => Number(b.exact) - Number(a.exact) ||
      a.dayOffset - b.dayOffset || a.offsetMinutes - b.offsetMinutes ||
      a.name.localeCompare(b.name, "pt-BR"));
    return { items: found.slice(0, 12), matchedServices: services.length, searchedDate: date,
      searchedTime: time, notice: "Horários sujeitos à confirmação no momento do agendamento." };
  }
}

@Controller("public")
export class PublicDirectoryController {
  constructor(private readonly directory: PublicDirectoryService) {}

  @Get("barbershops")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  list(@Query("q") query?: string, @Query("page") page?: string) {
    return this.directory.list(query ?? "", page);
  }

  @Get("quick-booking")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  quick(@Query("service") service: string, @Query("date") date: string,
    @Query("time") time: string) {
    return this.directory.quickBooking(service ?? "", date ?? "", time ?? "");
  }
}
