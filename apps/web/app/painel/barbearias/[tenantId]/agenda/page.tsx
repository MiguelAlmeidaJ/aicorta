"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3,
  ListFilter, RefreshCw, Settings2, UserRoundX, UsersRound,
} from "lucide-react";
import { apiJson, mutation } from "../../../../../lib/api";
import {
  EmptyState, money, PageHeader, Panel, secondaryButton, StatusPill,
} from "../../../../../components/dashboard/ui";

type Appointment = {
  id: string; employeeMembershipId: string; startsAt: string; endsAt: string;
  status: string; priceCents: number;
  service: { name: string }; client: { name: string };
  employee: { user: { name: string } };
};
type Summary = { tenant: { timezone: string; slug: string } };
type View = "week" | "day";

const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const statuses = [
  { id: "ALL", label: "Todos" }, { id: "PENDING", label: "Pendentes" },
  { id: "CONFIRMED", label: "Confirmados" }, { id: "COMPLETED", label: "Concluídos" },
  { id: "CANCELLED", label: "Cancelados" }, { id: "NO_SHOW", label: "Ausências" },
];

function dayAt(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, day: "2-digit", month: "2-digit", year: "numeric",
  }).formatToParts(date);
  const get = (name: string) => parts.find(part => part.type === name)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function plusDays(date: string, days: number) {
  const current = new Date(date + "T12:00:00.000Z");
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().slice(0, 10);
}
function firstWeekday(date: string) {
  const n = new Date(date + "T12:00:00.000Z").getUTCDay();
  return plusDays(date, -((n + 6) % 7));
}
function displayDay(date: string, pattern: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", { ...pattern, timeZone: "UTC" })
    .format(new Date(date + "T12:00:00.000Z"));
}
function timeAt(date: string, zone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone, hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
}
function totalFor(items: Appointment[], status: string) {
  return items.filter(item => item.status === status).length;
}

export default function AgendaPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [today] = useState(() => dayAt(new Date(), "America/Sao_Paulo"));
  const [day, setDay] = useState(today);
  const [view, setView] = useState<View>("week");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [items, setItems] = useState<Appointment[]>([]);
  const [professional, setProfessional] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [loadedRequest, setLoadedRequest] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  const weekStart = firstWeekday(day);
  const requestKey = `${tenantId}:${weekStart}:${reload}`;
  const loading = loadedRequest !== requestKey;
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => plusDays(weekStart, i)), [weekStart]);

  useEffect(() => {
    let active = true;
    const from = new Date(plusDays(weekStart, -1) + "T00:00:00Z").toISOString();
    const to = new Date(plusDays(weekStart, 9) + "T00:00:00Z").toISOString();
    const q = new URLSearchParams({ from, to, take: "300" });
    Promise.all([
      apiJson<Appointment[]>(`/tenants/${tenantId}/appointments?${q.toString()}`),
      apiJson<Summary>(`/tenants/${tenantId}/dashboard`),
    ]).then(([appointments, summary]) => {
      if (!active) return;
      setItems(appointments);
      setTimezone(summary.tenant.timezone);
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : "Não foi possível carregar a agenda.");
    }).finally(() => { if (active) setLoadedRequest(requestKey); });
    return () => { active = false; };
  }, [tenantId, weekStart, requestKey]);

  const professionals = useMemo(() => {
    const byId = new Map<string, string>();
    items.forEach(item => byId.set(item.employeeMembershipId, item.employee.user.name));
    return [...byId].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [items]);
  const filtered = useMemo(() => items.filter(item =>
    (professional === "ALL" || item.employeeMembershipId === professional) &&
    (status === "ALL" || item.status === status)), [items, professional, status]);
  const dayBookings = useMemo(() => filtered.filter(item =>
    dayAt(new Date(item.startsAt), timezone) === day), [filtered, timezone, day]);

  async function setBookingStatus(id: string, next: "CONFIRMED" | "COMPLETED" | "NO_SHOW") {
    if (busy) return;
    setBusy(id); setError(""); setNotice("");
    const target = next === "CONFIRMED"
      ? `/tenants/${tenantId}/appointments/${id}/confirm`
      : `/tenants/${tenantId}/appointments/${id}/status`;
    try {
      await apiJson(target, next === "CONFIRMED"
        ? { method: "PATCH" }
        : mutation("PATCH", { status: next }));
      setItems(current => current.map(item => item.id === id ? { ...item, status: next } : item));
      setNotice(next === "CONFIRMED" ? "Reserva confirmada com sucesso." :
        next === "COMPLETED" ? "Atendimento concluído." : "Ausência registrada.");
      setReload(value => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a reserva.");
    } finally { setBusy(null); }
  }

  function actions(item: Appointment) {
    const canFinish = new Date(item.startsAt) <= new Date();
    return <div className="mt-3 flex flex-wrap gap-2">
      {item.status === "PENDING" && <button disabled={busy !== null} type="button"
        onClick={() => void setBookingStatus(item.id, "CONFIRMED")}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#181a16] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#353731] disabled:opacity-40">
        <Check size={13}/> Confirmar
      </button>}
      {item.status === "CONFIRMED" && canFinish && <>
        <button disabled={busy === item.id} onClick={() => void setBookingStatus(item.id, "COMPLETED")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#181a16] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40">
          <Check size={13}/> Concluir
        </button>
        <button disabled={busy === item.id} onClick={() => void setBookingStatus(item.id, "NO_SHOW")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5e0] bg-white px-3 py-2 text-[11px] font-bold disabled:opacity-40">
          <UserRoundX size={13}/> Falta
        </button>
      </>}
    </div>;
  }

  function card(item: Appointment, compact = false) {
    return <article key={item.id} className="rounded-xl border border-[#e7e8e3] bg-white p-3.5 shadow-[0_3px_10px_#00000005]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#484b44]">
          <Clock3 size={13}/>{timeAt(item.startsAt, timezone)}
        </span>
        <StatusPill status={item.status}/>
      </div>
      <p className="mt-3 truncate text-[13px] font-bold text-[#1b1d18]">{item.client.name}</p>
      <p className="mt-1 truncate text-[11px] text-[#777c72]">{item.service.name}</p>
      <p className="mt-1 truncate text-[11px] text-[#92968e]">{item.employee.user.name}</p>
      {!compact && <p className="mt-2 text-[11px] font-semibold">{money(item.priceCents)}</p>}
      {actions(item)}
    </article>;
  }

  return <>
    <PageHeader kicker="Operação / Agenda" title="Agenda de atendimentos"
      description="Uma visão clara dos horários, clientes e profissionais. Atualize o status das reservas sem sair do calendário."
      action={<div className="flex flex-wrap items-center gap-2">
        <Link href={`/painel/barbearias/${tenantId}/agenda/configuracao`}
          className={secondaryButton}><Settings2 size={16}/> Configurar</Link>
        <button type="button" aria-label="Atualizar agenda" onClick={() => setReload(x => x + 1)}
          className={secondaryButton}><RefreshCw size={16}/> Atualizar</button>
      </div>}/>

    {error && <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {notice && <div role="status" className="mb-5 rounded-xl border border-[#e4e7dd] bg-[#edf0e8] p-4 text-sm text-[#475743]">{notice}</div>}

    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { label: "Reservas no período", value: filtered.length, icon: CalendarDays },
        { label: "Aguardando", value: totalFor(items, "PENDING"), icon: CalendarClock },
        { label: "Confirmados", value: totalFor(items, "CONFIRMED"), icon: Check },
        { label: "Concluídos", value: totalFor(items, "COMPLETED"), icon: Clock3 },
      ].map(stat => <div key={stat.label} className="flex items-center gap-3 rounded-2xl border border-[#e6e7e1] bg-white p-4">
        <span className="rounded-xl bg-[#f3f3ef] p-2.5 text-[#686c63]"><stat.icon size={19}/></span>
        <div><p className="text-[10px] font-medium text-[#878b83]">{stat.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{loading ? "—" : stat.value}</p></div>
      </div>)}
    </div>

    <Panel title="Calendário da barbearia" description="Horários exibidos no fuso do estabelecimento">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[#eeefea] pb-5 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <button aria-label="Período anterior" onClick={() => setDay(d => plusDays(d, view === "week" ? -7 : -1))}
            className={secondaryButton}><ChevronLeft size={18}/></button>
          <button onClick={() => setDay(dayAt(new Date(), timezone))} className={secondaryButton}>Hoje</button>
          <button aria-label="Próximo período" onClick={() => setDay(d => plusDays(d, view === "week" ? 7 : 1))}
            className={secondaryButton}><ChevronRight size={18}/></button>
          <span className="ml-2 text-sm font-bold capitalize tracking-tight">
            {view === "week"
              ? `${displayDay(week[0], { day: "2-digit", month: "short" })} – ${displayDay(week[6], { day: "2-digit", month: "short", year: "numeric" })}`
              : displayDay(day, { dateStyle: "full" })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-[#e4e6e0] bg-white px-3">
            <UsersRound size={15} className="text-[#8c9188]"/>
            <select aria-label="Filtrar profissional" value={professional} onChange={e => setProfessional(e.target.value)}
              className="max-w-[170px] bg-transparent py-2.5 text-xs outline-none">
              <option value="ALL">Todos os profissionais</option>
              {professionals.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[#e4e6e0] bg-white px-3">
            <ListFilter size={15} className="text-[#8c9188]"/>
            <select aria-label="Filtrar situação" value={status} onChange={e => setStatus(e.target.value)}
              className="bg-transparent py-2.5 text-xs outline-none">
              {statuses.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <div className="flex rounded-xl border border-[#e4e6e0] bg-[#f5f5f2] p-1">
            {(["week", "day"] as const).map(option => <button key={option}
              className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${view === option ? "bg-[#171916] text-white" : "text-[#858980] hover:text-[#262923]"}`}
              onClick={() => setView(option)}>
              {option === "week" ? "Semana" : "Dia"}
            </button>)}
          </div>
        </div>
      </div>

      {loading ? <div aria-live="polite" className="space-y-3 py-7">
        <p className="text-sm text-[#949890]">Carregando agendamentos...</p>
        {[0, 1, 2].map(n => <div key={n} className="h-16 animate-pulse rounded-xl bg-[#f1f2ef]"/>)}
      </div> : view === "week" ?
        <div className="overflow-x-auto pb-3">
          <div className="grid min-w-[990px] grid-cols-7 gap-2.5">
            {week.map((date, index) => {
              const current = date === day;
              const todayMark = date === dayAt(new Date(), timezone);
              const bookings = filtered.filter(item => dayAt(new Date(item.startsAt), timezone) === date);
              return <div key={date} className="min-h-[155px]">
                <button onClick={() => { setDay(date); setView("day"); }}
                  aria-label={`Ver agenda de ${displayDay(date, { dateStyle: "full" })}`}
                  className={`mb-3 flex w-full flex-col items-center gap-1 rounded-xl px-2 py-3 transition
                    ${current ? "bg-[#181a16] text-white" : "bg-[#f6f7f3] text-[#6f746b] hover:bg-[#eeefe9]"}`}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider">{weekdays[index]}</span>
                  <span className="text-2xl font-bold tabular-nums">{date.slice(8)}</span>
                  <span className={`text-[10px] ${current ? "text-white/60" : "text-[#a0a49b]"}`}>
                    {todayMark ? "Hoje" : `${bookings.length} reserva(s)`}
                  </span>
                </button>
                <div className="space-y-2.5">
                  {bookings.map(booking => card(booking, true))}
                  {bookings.length === 0 && <div className="rounded-xl border border-dashed border-[#e7e9e3] px-2 py-6 text-center text-[11px] text-[#afb3aa]">
                    Sem reservas
                  </div>}
                </div>
              </div>;
            })}
          </div>
        </div> :
        <div>
          <div className="mb-5 flex items-center justify-between rounded-xl bg-[#f7f8f4] px-5 py-4">
            <div><p className="text-[11px] font-semibold uppercase tracking-widest text-[#8b9186]">Dia selecionado</p>
              <p className="mt-1 text-lg font-bold capitalize">{displayDay(day, { dateStyle: "full" })}</p></div>
            <p className="rounded-full bg-white px-3 py-1.5 text-xs font-bold">{dayBookings.length} reserva(s)</p>
          </div>
          {dayBookings.length === 0 ? <EmptyState icon={CalendarDays} title="Sem reservas neste dia"
            description="Experimente outra data ou altere os filtros. Os horários disponíveis continuam acessíveis na página pública."/> :
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dayBookings.map(item => card(item))}
          </div>}
        </div>}
      {!loading && view === "week" && <p className="mt-3 text-xs text-[#a2a69e]">
        Clique em um dia para ver a agenda detalhada. A grade pode ser deslizada horizontalmente em telas menores.
      </p>}
    </Panel>
  </>;
}
