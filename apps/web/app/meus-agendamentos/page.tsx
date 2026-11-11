"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, CalendarCheck2, CalendarClock, CalendarDays, Check, ChevronDown,
  Clock3, ChevronLeft, ChevronRight, RefreshCw, Scissors, UserRound, X,
} from "lucide-react";
import { BrandLogo } from "../../components/brand/brand-provider";
import { UserMenu } from "../../components/auth/user-menu";
import { apiFetch, apiJson } from "../../lib/api";
import { money, StatusPill } from "../../components/dashboard/ui";

type Booking = {
  id: string; tenantId: string; serviceId: string; employeeMembershipId: string;
  status: string; startsAt: string; endsAt: string; priceCents: number;
  tenant: { name: string; slug: string; timezone: string; bookingAdvanceDays: number };
  service: { name: string }; services: { service: { id: string; name: string } }[]; employee: { user: { name: string } };
};
type SlotsResponse = { slots: string[] };
type AvailableWeek = { timezone: string; days: { date: string; slots: string[] }[] };
type Filter = "UPCOMING" | "HISTORY" | "ALL";

function localToday(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (key: string) => parts.find(item => item.type === key)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function plusDays(ymd: string, amount: number) {
  const date = new Date(ymd + "T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone, dateStyle: "full", timeStyle: "short",
  }).format(new Date(value));
}
function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}
const active = (status: string) => status === "PENDING" || status === "CONFIRMED";

export default function MyBookingsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>("UPCOMING");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<Record<string, number>>({});
  const [availableWeeks, setAvailableWeeks] = useState<Record<string, AvailableWeek>>({});
  const [loadingWeek, setLoadingWeek] = useState<string | null>(null);
  const slotRequestIds = useRef<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [referenceNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/my/bookings");
      if (response.status === 401) {
        router.replace("/login?next=" + encodeURIComponent("/meus-agendamentos"));
        return;
      }
      if (!response.ok) throw new Error("Não foi possível carregar os agendamentos.");
      const data = (await response.json()) as Booking[];
      setItems(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao consultar agendamentos.");
    } finally { setLoading(false); }
  }, [router]);

  // A carga é reutilizada também após cancelar/remarcar; o callback mantém uma única regra de tratamento.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reservado") === "1") {
      setMessage("Agendamento realizado! Sua reserva foi recebida e está aguardando confirmação da barbearia.");
      window.history.replaceState(window.history.state, "", "/meus-agendamentos");
    }
  }, []);

  const upcoming = useMemo(() => items.filter(item =>
    active(item.status) && new Date(item.endsAt).getTime() >= referenceNow), [items, referenceNow]);
  const history = useMemo(() => items.filter(item =>
    !active(item.status) || new Date(item.endsAt).getTime() < referenceNow), [items, referenceNow]);
  const shown = filter === "UPCOMING" ? upcoming : filter === "HISTORY" ? history : items;
  const sorted = [...shown].sort((a, b) => filter === "UPCOMING"
    ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    : new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  async function cancel(item: Booking) {
    if (!window.confirm("Deseja cancelar esta reserva? Essa ação não pode ser desfeita.")) return;
    setBusy(item.id); setError(""); setMessage("");
    try {
      const response = await apiFetch(`/b/${encodeURIComponent(item.tenant.slug)}/bookings/${item.id}/cancel`, { method: "PATCH" });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(typeof problem.message === "string" ? problem.message : "Cancelamento não autorizado ou fora do prazo.");
      }
      setMessage("Agendamento cancelado com sucesso.");
      setOpen(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível cancelar.");
    } finally { setBusy(null); }
  }

  async function loadAvailableWeek(item: Booking, offset: number) {
    const id = (slotRequestIds.current[item.id] ?? 0) + 1;
    slotRequestIds.current[item.id] = id;
    const today = localToday(item.tenant.timezone);
    const horizon = Math.max(1, Math.min(90, item.tenant.bookingAdvanceDays ?? 21));
    const startDate = plusDays(today, offset * 7);
    if (offset < 0 || startDate > plusDays(today, horizon)) return;
    setWeeks(current => ({ ...current, [item.id]: offset }));
    setAvailableWeeks(current => {
      const copy = { ...current }; delete copy[item.id]; return copy;
    });
    setDates(current => ({ ...current, [item.id]: "" }));
    setSlots(current => ({ ...current, [item.id]: [] }));
    setLoadingWeek(item.id); setError("");
    try {
      const query = new URLSearchParams({
        from: startDate, membershipId: item.employeeMembershipId,
        serviceIds: (item.services.length
          ? item.services.map(row => row.service.id) : [item.serviceId]).join(","),
      });
      const result = await apiJson<AvailableWeek>(
        `/b/${encodeURIComponent(item.tenant.slug)}/available-days?${query}`);
      if (slotRequestIds.current[item.id] !== id) return;
      setAvailableWeeks(current => ({ ...current, [item.id]: result }));
    } catch (reason) {
      if (slotRequestIds.current[item.id] !== id) return;
      setError(reason instanceof Error ? reason.message : "Não foi possível consultar a agenda da barbearia.");
    } finally {
      if (slotRequestIds.current[item.id] === id) setLoadingWeek(null);
    }
  }

  function pickAvailableDate(item: Booking, date: string) {
    const found = availableWeeks[item.id]?.days.find(row => row.date === date);
    if (!found?.slots.length) return;
    setDates(current => ({ ...current, [item.id]: date }));
    setSlots(current => ({ ...current, [item.id]: found.slots }));
  }

  async function getSlots(item: Booking, date: string) {
    const id = (slotRequestIds.current[item.id] ?? 0) + 1;
    slotRequestIds.current[item.id] = id;
    setDates(current => ({ ...current, [item.id]: date }));
    setSlots(current => ({ ...current, [item.id]: [] }));
    if (!date) return;
    const today = localToday(item.tenant.timezone);
    const last = plusDays(today, item.tenant.bookingAdvanceDays ?? 21);
    if (date < today || date > last) {
      setError("Escolha uma data dentro do prazo de agendamento definido pela barbearia.");
      return;
    }
    setError(""); setLoadingSlots(item.id);
    try {
      const q = new URLSearchParams({
        date, serviceIds: (item.services.length ? item.services.map(row => row.service.id) : [item.serviceId]).join(","), membershipId: item.employeeMembershipId,
      });
      const response = await apiJson<SlotsResponse>(`/b/${encodeURIComponent(item.tenant.slug)}/slots?${q}`);
      if (slotRequestIds.current[item.id] === id) {
        setSlots(current => ({ ...current, [item.id]: response.slots }));
      }
    } catch (reason) {
      if (slotRequestIds.current[item.id] === id) {
        setError(reason instanceof Error ? reason.message : "Não foi possível consultar horários.");
      }
    } finally { if (slotRequestIds.current[item.id] === id) setLoadingSlots(null); }
  }

  async function reschedule(item: Booking, startsAt: string) {
    if (!window.confirm("Confirmar a remarcação para este horário?")) return;
    setBusy(item.id); setError(""); setMessage("");
    try {
      const response = await apiFetch(`/b/${encodeURIComponent(item.tenant.slug)}/bookings/${item.id}/reschedule`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt }),
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(typeof problem.message === "string" ? problem.message : "Esse horário não está disponível.");
      }
      setMessage("Reserva remarcada! Aguardando confirmação da barbearia.");
      setOpen(null);
      setSlots(current => ({ ...current, [item.id]: [] }));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível remarcar.");
      const date = dates[item.id];
      if (date) await getSlots(item, date);
    } finally { setBusy(null); }
  }

  return <main className="min-h-screen bg-[#f7f8f5] text-[#191b17]">
    <header className="border-b border-[#e7e9e2] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" aria-label="Página inicial"><BrandLogo className="h-12 max-w-[205px]"/></Link>
        <UserMenu/>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#979c91]">Minha conta / Reservas</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-.055em] sm:text-4xl">Meus agendamentos</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[#878d83]">
            Organize seus próximos horários, consulte atendimentos anteriores e solicite uma remarcação.
          </p>
        </div>
        <button type="button" onClick={() => { setLoading(true); void load(); }}
          className="inline-flex items-center gap-2 rounded-xl border border-[#e3e5de] bg-white px-4 py-3 text-xs font-bold hover:bg-[#f1f2ee]">
          <RefreshCw size={16}/> Atualizar
        </button>
      </div>

      {message && <div role="status" className="mb-5 flex items-center gap-3 rounded-xl border border-[#e2e8dd] bg-[#eef3ea] px-5 py-4 text-sm font-medium text-[#40563d]">
        <Check size={17}/>{message}
        <button type="button" aria-label="Fechar aviso" className="ml-auto" onClick={() => setMessage("")}><X size={16}/></button>
      </div>}
      {error && <div role="alert" className="mb-5 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
        {error}
        <button type="button" aria-label="Fechar erro" className="ml-auto" onClick={() => setError("")}><X size={16}/></button>
      </div>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Próximos horários", value: upcoming.length, icon: CalendarClock },
          { label: "Atendimentos confirmados", value: upcoming.filter(item => item.status === "CONFIRMED").length, icon: CalendarCheck2 },
          { label: "Histórico", value: history.length, icon: Clock3 },
        ].map(item => <div key={item.label} className="rounded-[20px] border border-[#e7e9e2] bg-white p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f3ef] text-[#676d63]"><item.icon size={19}/></span>
          <p className="mt-5 text-xs text-[#888e84]">{item.label}</p>
          <p className="mt-1 text-3xl font-bold tracking-[-.05em] tabular-nums">{loading ? "—" : item.value}</p>
        </div>)}
      </div>

      <section className="overflow-hidden rounded-[24px] border border-[#e7e9e2] bg-white">
        <div className="flex flex-col justify-between gap-4 border-b border-[#eff0ea] px-5 py-5 sm:flex-row sm:items-center sm:px-7">
          <div><h2 className="text-base font-bold">Suas reservas</h2>
            <p className="mt-1 text-xs text-[#91968c]">{loading ? "Carregando..." : `${sorted.length} agendamento(s) nesta visão`}</p></div>
          <div className="flex flex-wrap gap-1.5 rounded-xl bg-[#f5f6f2] p-1">
            {([
              { id: "UPCOMING", label: "Próximos" }, { id: "HISTORY", label: "Histórico" },
              { id: "ALL", label: "Todos" },
            ] as { id: Filter; label: string }[]).map(option =>
              <button key={option.id} type="button" aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition
                  ${filter === option.id ? "bg-[#191b17] text-white" : "text-[#7d8379] hover:text-[#252923]"}`}>
                {option.label}
              </button>)}
          </div>
        </div>

        {loading ? <div aria-live="polite" className="space-y-3 px-6 py-8">
          {[0, 1, 2].map(key => <div key={key} className="h-32 animate-pulse rounded-xl bg-[#f2f3ee]"/>)}
        </div> : sorted.length === 0 ? <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="rounded-2xl bg-[#f1f2ee] p-4 text-[#8c9287]"><CalendarDays size={27}/></span>
          <h3 className="mt-5 text-base font-bold">{filter === "UPCOMING" ? "Nenhuma reserva futura" : "Nenhuma reserva nesta categoria"}</h3>
          <p className="mt-2 max-w-sm text-xs leading-6 text-[#8e9489]">
            {filter === "UPCOMING" ? "Quando você reservar um novo horário, ele aparecerá aqui."
              : "Altere os filtros ou escolha uma barbearia para fazer uma nova reserva."}
          </p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1b1d18] px-5 py-3 text-xs font-bold text-white">
            Explorar barbearias <ArrowRight size={15}/>
          </Link>
        </div> :
        <div className="divide-y divide-[#eff0eb]">
          {sorted.map(item => {
            const isOpen = open === item.id;
            const canManage = active(item.status) && new Date(item.startsAt).getTime() - referenceNow >= 2 * 60 * 60 * 1000;
            const zone = item.tenant.timezone || "America/Sao_Paulo";
            return <article key={item.id} className="p-5 sm:p-7">
              <div className="flex flex-wrap items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f1f2ee] text-[#6d7469]"><Scissors size={21}/></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-bold sm:text-base">{item.services.length ? item.services.map(row => row.service.name).join(" + ") : item.service.name}</h3>
                    <StatusPill status={item.status}/>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#7b8176]">{item.tenant.name}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#858b80]">
                    <span className="flex items-center gap-1.5"><CalendarDays size={14}/>{formatDate(item.startsAt, zone)}</span>
                    <span className="flex items-center gap-1.5"><UserRound size={14}/>{item.employee.user.name}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="text-sm font-bold">{money(item.priceCents)}</p>
                  <Link href={`/b/${encodeURIComponent(item.tenant.slug)}`}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#62695e] hover:underline">
                    Nova reserva <ArrowRight size={13}/>
                  </Link>
                </div>
              </div>
              {canManage && <div className="mt-5 flex flex-wrap gap-2 border-t border-[#f0f1ec] pt-4">
                <button type="button" disabled={busy === item.id}
                  onClick={() => {
                    setOpen(isOpen ? null : item.id); setError("");
                    if (!isOpen) void loadAvailableWeek(item, 0);
                  }}
                  aria-expanded={isOpen}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#e3e6de] bg-white px-4 py-2.5 text-xs font-semibold transition hover:bg-[#f5f6f2] disabled:opacity-40">
                  <CalendarClock size={15}/> Remarcar <ChevronDown size={14} className={isOpen ? "rotate-180" : ""}/>
                </button>
                <button type="button" disabled={busy === item.id} onClick={() => void cancel(item)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#e9e7e2] bg-[#fbfaf8] px-4 py-2.5 text-xs font-semibold text-[#79544c] transition hover:bg-[#f6efec] disabled:opacity-40">
                  <X size={15}/>{busy === item.id ? "Processando..." : "Cancelar reserva"}
                </button>
              </div>}
              {active(item.status) && !canManage && <p className="mt-4 text-xs text-[#999e93]">
                Cancelamento e remarcação exigem 2 horas de antecedência.
              </p>}
              {isOpen && canManage && <div className="mt-4 rounded-2xl border border-[#e9eae4] bg-[#f8f9f5] p-4 sm:p-5">
                <h4 className="text-[13px] font-bold text-[#2b342a]">Escolha entre as datas disponíveis</h4>
                <p className="mt-1 text-[12px] leading-5 text-[#828c7e]">
                  Apenas os dias com horários livres em {item.tenant.name} são exibidos. O novo horário deve ter pelo menos 1 hora de antecedência.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[12px] font-semibold text-[#3d493a]">
                    {formatDate(plusDays(localToday(zone), (weeks[item.id] ?? 0) * 7) + "T12:00:00.000Z", "UTC").split(" às ")[0]}
                    {" — "}
                    {formatDate(plusDays(localToday(zone), (weeks[item.id] ?? 0) * 7 + 6) + "T12:00:00.000Z", "UTC").split(" às ")[0]}
                  </p>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Semana anterior"
                      disabled={(weeks[item.id] ?? 0) === 0 || loadingWeek === item.id || busy === item.id}
                      onClick={() => void loadAvailableWeek(item, (weeks[item.id] ?? 0) - 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#dfe5da] bg-white disabled:opacity-35">
                      <ChevronLeft size={17}/>
                    </button>
                    <button type="button" aria-label="Próxima semana"
                      disabled={plusDays(localToday(zone), ((weeks[item.id] ?? 0) + 1) * 7) >
                        plusDays(localToday(zone), item.tenant.bookingAdvanceDays ?? 21) ||
                        loadingWeek === item.id || busy === item.id}
                      onClick={() => void loadAvailableWeek(item, (weeks[item.id] ?? 0) + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#dfe5da] bg-white disabled:opacity-35">
                      <ChevronRight size={17}/>
                    </button>
                  </div>
                </div>
                {loadingWeek === item.id ?
                  <div role="status" className="mt-3 flex min-h-[90px] items-center justify-center rounded-xl border border-[#e8ece5] bg-white text-[12px] text-[#7b8577]">
                    Consultando a disponibilidade da barbearia...
                  </div> :
                  availableWeeks[item.id] ? <>
                    <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7" aria-label="Dias disponíveis para remarcação">
                      {availableWeeks[item.id].days
                        .filter(row => row.slots.length > 0 &&
                          row.date <= plusDays(localToday(zone), item.tenant.bookingAdvanceDays ?? 21))
                        .map(row => {
                          const available = row.slots.length > 0;
                          const chosen = dates[item.id] === row.date;
                          const weekday = new Intl.DateTimeFormat("pt-BR", {
                            weekday: "short", timeZone: "UTC",
                          }).format(new Date(row.date + "T12:00:00.000Z")).replace(".", "");
                          return <button key={row.date} type="button"
                            disabled={!available || busy === item.id}
                            aria-pressed={chosen}
                            onClick={() => pickAvailableDate(item, row.date)}
                            className={`flex min-h-[84px] flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition
                              ${chosen ? "border-[#242c22] bg-[#242c22] text-white" :
                                available ? "border-[#d9e3d4] bg-white text-[#2d3b2a] hover:border-[#83947e]" :
                                "border-[#e7eae4] bg-[#f0f1ed] text-[#9aa297] opacity-65"}`}>
                            <span className="text-[11px] font-semibold capitalize">{weekday}</span>
                            <strong className="mt-1 text-xl tabular-nums">{row.date.slice(-2)}</strong>
                            <span className={`mt-1 text-[10px] ${chosen ? "text-white/80" :
                              available ? "text-[#658061]" : "text-[#9aa297]"}`}>
                              {available ? `${row.slots.length} horário(s)` : "Indisponível"}
                            </span>
                          </button>;
                        })}
                    </div>
                    {!availableWeeks[item.id].days.some(row => row.slots.length) &&
                      <p className="mt-4 text-[12px] leading-5 text-[#7c8777]">
                        Nenhum horário livre nesta semana. Avance para consultar as próximas datas.
                      </p>}
                  </> : <button type="button" onClick={() => void loadAvailableWeek(item, weeks[item.id] ?? 0)}
                    className="mt-4 rounded-xl border border-[#dfe5da] bg-white px-4 py-3 text-xs font-semibold">
                    Tentar consultar novamente
                  </button>}
                {dates[item.id] && <div className="mt-5 border-t border-[#e1e6de] pt-5">
                  <h5 className="text-[12px] font-bold">Horários livres para o dia selecionado</h5>
                  {loadingSlots === item.id ? <p className="mt-3 text-xs text-[#8c9589]">Atualizando horários...</p> :
                    (slots[item.id]?.length ?? 0) > 0 ? <div className="mt-3 flex flex-wrap gap-2">
                      {(slots[item.id] ?? []).map(iso => <button key={iso} type="button"
                        disabled={busy === item.id} onClick={() => void reschedule(item, iso)}
                        className="min-h-10 rounded-xl border border-[#dae3d6] bg-white px-4 py-2 text-xs font-bold transition hover:border-[#273425] hover:bg-[#eaf0e7] disabled:opacity-40">
                        {formatTime(iso, zone)}
                      </button>)}
                    </div> : <p className="mt-3 text-xs text-[#8c9589]">
                      Este dia não tem mais horários disponíveis. Escolha outro.
                    </p>}
                </div>}
              </div>}
            </article>;
          })}
        </div>}
      </section>
      <p className="mt-6 text-center text-xs text-[#a0a59a]">AICorta · Reservas organizadas para você</p>
    </div>
  </main>;
}
