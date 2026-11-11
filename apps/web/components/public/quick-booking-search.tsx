"use client";

import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Clock3, MapPin, Search, Scissors } from "lucide-react";
import { API_URL, apiJson } from "../../lib/api";

type Match = {
  id: string; name: string; slug: string; timezone: string;
  city: string | null; state: string | null; neighborhood: string | null;
  coverUrl: string | null; hasCustomCover: boolean;
  serviceId: string; serviceName: string; durationMinutes: number; priceCents: number;
  membershipId: string; startsAt: string; exact: boolean;
  offsetMinutes: number; dayOffset: number;
};
type QuickResponse = { items: Match[]; matchedServices: number; searchedDate: string;
  searchedTime: string; notice: string };
function dateInputToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
function formatSlot(iso: string, zone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: zone,
  }).format(new Date(iso));
}

export function QuickBookingSearch() {
  const [service, setService] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [result, setResult] = useState<QuickResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (service.trim().length < 2 || !date || !time) {
      setError("Informe o serviço, a data e o horário desejados."); return;
    }
    const id = ++requestId.current;
    setError(""); setResult(null); setLoading(true);
    try {
      const params = new URLSearchParams({ service: service.trim(), date, time });
      const matches = await apiJson<QuickResponse>(`/public/quick-booking?${params}`);
      if (id !== requestId.current) return;
      setResult(matches);
    } catch (reason) {
      if (id === requestId.current) setError(
        reason instanceof Error ? reason.message : "Não foi possível consultar os horários.");
    } finally { if (id === requestId.current) setLoading(false); }
  }
  return <div className="space-y-5">
    <form role="search" onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,.8fr)_minmax(0,.65fr)_auto]">
      <label className="block min-w-0 text-[11px] font-semibold text-[#e5e9e0]">Serviço desejado
        <div className="mt-2 flex h-12 items-center gap-2 rounded-xl bg-white px-3 text-[#273027]">
          <Scissors size={17} className="shrink-0 text-[#879184]"/>
          <input required minLength={2} maxLength={80} value={service} onChange={event=>setService(event.target.value)}
            placeholder="Ex.: corte, barba..." autoComplete="off"
            className="h-full w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[#a2aa9f]"/>
        </div>
      </label>
      <label className="block min-w-0 text-[11px] font-semibold text-[#e5e9e0]">Dia desejado
        <div className="mt-2 flex h-12 items-center gap-2 rounded-xl bg-white px-3 text-[#273027]">
          <CalendarDays size={16} className="shrink-0 text-[#879184]"/>
          <input required type="date" min={dateInputToday()} value={date} onChange={event=>setDate(event.target.value)}
            className="h-full w-full min-w-0 bg-transparent text-[13px] outline-none"/>
        </div>
      </label>
      <label className="block min-w-0 text-[11px] font-semibold text-[#e5e9e0]">Horário
        <div className="mt-2 flex h-12 items-center gap-2 rounded-xl bg-white px-3 text-[#273027]">
          <Clock3 size={16} className="shrink-0 text-[#879184]"/>
          <input required type="time" value={time} onChange={event=>setTime(event.target.value)}
            className="h-full w-full min-w-0 bg-transparent text-[13px] outline-none"/>
        </div>
      </label>
      <button type="submit" disabled={loading}
        className="flex min-h-12 items-center justify-center gap-2 self-end rounded-xl bg-[#e6c374] px-5 text-[13px] font-bold text-[#1f251d] transition hover:bg-[#f4d590] disabled:opacity-55">
        <Search size={16}/>{loading ? "Consultando..." : "Buscar"}
      </button>
    </form>
    <p className="text-[11px] leading-5 text-[#c5cdc0]">Exibimos os horários livres no dia escolhido. Se não houver, buscamos alternativas nos próximos 7 dias, dentro do prazo de cada barbearia.</p>
    {error && <p role="alert" className="rounded-xl border border-[#dfb0a1] bg-[#512f2b] px-4 py-3 text-[12px] text-[#ffe1d8]">{error}</p>}
    {loading && <p role="status" className="rounded-xl border border-white/15 bg-white/10 px-4 py-4 text-[13px] text-white">Consultando serviços e horários disponíveis...</p>}
    {result && <section aria-live="polite" className="rounded-[16px] bg-white p-4 text-[#20271f] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold">Horários encontrados</h3>
        <span className="text-[11px] text-[#849083]">{result.items.length} {result.items.length === 1 ? "barbearia" : "barbearias"}</span>
      </div>
      {result.items.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.map(item => {
          const query = new URLSearchParams({ service: item.serviceId, professional: item.membershipId,
            date: new Intl.DateTimeFormat("en-CA", { year:"numeric", month:"2-digit", day:"2-digit",
              timeZone:item.timezone }).format(new Date(item.startsAt)),
            time: item.startsAt });
          return <article key={item.id} className="min-w-0 overflow-hidden rounded-xl border border-[#e4e9df] bg-[#fbfcfa]">
            <div className="flex items-start gap-3 p-3">
              {item.coverUrl ?
                // eslint-disable-next-line @next/next/no-img-element -- capa da API
                <img src={API_URL + item.coverUrl} alt="" loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-lg bg-[#e7eae3] object-cover"/> :
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#e7eae3]"><Scissors size={21}/></span>}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold">{item.name}</p>
                <p className="mt-1 line-clamp-1 text-[11px] text-[#82907e]">
                  <MapPin size={11} className="mr-1 inline"/>{[item.neighborhood,item.city,item.state].filter(Boolean).join(" · ") || "Endereço a confirmar"}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[#556950]">{item.serviceName}</p>
              </div>
            </div>
            <div className="border-t border-[#e4e9df] px-3 pb-3 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#81907c]">
                {item.exact ? "Horário solicitado disponível" :
                  item.dayOffset > 0 ? "Próxima data disponível" : "Horário próximo disponível"}
              </p>
              <p className="mt-1 text-[13px] font-bold">{formatSlot(item.startsAt,item.timezone)}</p>
              <Link href={`/b/${encodeURIComponent(item.slug)}?${query}`}
                className="mt-3 flex min-h-9 items-center justify-between rounded-lg bg-[#202820] px-3 text-[11px] font-bold text-white hover:bg-[#3b493a]">
                Escolher horário <ArrowRight size={15}/>
              </Link>
            </div>
          </article>;
        })}
      </div> : <div className="space-y-2 py-4">
        <p className="text-[13px] font-medium">Não encontramos horários disponíveis para esse serviço no período consultado.</p>
        <p className="text-[12px] text-[#788575]">Experimente outro horário ou uma data diferente.</p>
        <Link href="/barbearias" className="inline-flex items-center gap-2 pt-2 text-[12px] font-semibold underline underline-offset-4">Ver todas as barbearias <ArrowRight size={14}/></Link>
      </div>}
      {result.items.length > 0 && <p className="mt-3 text-[10px] text-[#889487]">{result.notice}</p>}
    </section>}
  </div>;
}
