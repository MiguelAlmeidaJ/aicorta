"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CalendarDays, Check, Clock3, Scissors, ShieldCheck, UserRound,
} from "lucide-react";
import { BrandLogo } from "../../../components/brand/brand-provider";
import { apiFetch, apiJson } from "../../../lib/api";
import { money } from "../../../components/dashboard/ui";

type Service = {
  id: string; name: string; description: string | null;
  durationMinutes: number; priceCents: number;
};
type Professional = { id: string; name: string; serviceIds: string[] };
type Catalog = {
  tenant: { id: string; name: string; slug: string; timezone: string };
  services: Service[]; professionals: Professional[];
};
type Slots = { slots: string[] };
function localToday(zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (name: string) => parts.find(p => p.type === name)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function plusDays(ymd: string, days: number) {
  const day = new Date(ymd + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}
function labelDay(day: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short",
  }).format(new Date(day + "T12:00:00Z"));
}

export default function PublicBarbershopPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [day, setDay] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const service = catalog?.services.find(s => s.id === serviceId);
  const professionals = useMemo(() => catalog?.professionals.filter(p => p.serviceIds.includes(serviceId)) ?? [],
    [catalog, serviceId]);
  const selectedProfessional = professionals.find(p => p.id === professionalId);
  const today = catalog ? localToday(catalog.tenant.timezone) : "";
  const nextDays = useMemo(() => today ? Array.from({ length: 7 }, (_, i) => plusDays(today, i)) : [], [today]);
  const time = (iso: string) => new Intl.DateTimeFormat("pt-BR", {
    timeZone: catalog?.tenant.timezone ?? "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

  useEffect(() => {
    let active = true;
    if (!slug) return;
    setLoading(true); setError("");
    apiJson<Catalog>(`/b/${encodeURIComponent(slug)}`)
      .then(data => { if (active) { setCatalog(data); setDay(localToday(data.tenant.timezone)); } })
      .catch(() => { if (active) setError("Esta barbearia não está disponível no momento."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    let active = true;
    setSelectedSlot("");
    if (!slug || !serviceId || !professionalId || !day) {
      setSlots([]); setLoadingSlots(false); return;
    }
    setLoadingSlots(true);
    const query = new URLSearchParams({ date: day, serviceId, membershipId: professionalId });
    apiJson<Slots>(`/b/${encodeURIComponent(slug)}/slots?${query}`)
      .then(result => { if (active) setSlots(result.slots); })
      .catch(() => { if (active) { setSlots([]); setError("Não foi possível consultar os horários. Tente novamente."); } })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [slug, serviceId, professionalId, day]);

  async function book() {
    if (!selectedSlot || !service || !selectedProfessional || submitting) return;
    setSubmitting(true); setError("");
    try {
      const response = await apiFetch(`/b/${encodeURIComponent(slug)}/bookings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId, employeeMembershipId: professionalId, startsAt: selectedSlot,
        }),
      });
      if (response.status === 401) {
        router.push("/login?next=" + encodeURIComponent("/b/" + slug)); return;
      }
      if (response.status === 409) {
        setError("Esse horário acabou de ser reservado. Escolha outro.");
        setSelectedSlot("");
        return;
      }
      if (!response.ok) {
        const body: { message?: string | string[] } = await response.json().catch(() => ({}));
        setError(Array.isArray(body.message) ? body.message.join("; ") : body.message ?? "Não foi possível realizar a reserva.");
        return;
      }
      router.push("/meus-agendamentos");
    } catch { setError("Não foi possível conectar à API. Verifique sua conexão."); }
    finally { setSubmitting(false); }
  }

  return <main className="min-h-screen bg-[#f7f8f5] text-[#181a16]">
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
      <Link href="/" aria-label="Voltar ao início"><BrandLogo className="h-12 max-w-[210px]"/></Link>
      <div className="flex items-center gap-4 text-xs font-semibold">
        <Link href="/meus-agendamentos" className="text-[#656a62] hover:text-[#151715]">Meus horários</Link>
        <Link href="/login" className="rounded-xl border border-[#e3e5df] bg-white px-4 py-2.5 hover:bg-[#f2f2ee]">Entrar</Link>
      </div>
    </header>

    <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
      <div className="relative overflow-hidden rounded-[28px] bg-[#151714] p-7 text-white sm:p-10 lg:p-12">
        <span className="absolute -right-12 -top-28 h-72 w-72 rounded-full border-[42px] border-white/[.04]"/>
        <span className="relative inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#d9dcd4]">
          <Scissors size={13} className="text-[#f2c225]"/> Agendamento online
        </span>
        <h1 className="relative mt-5 max-w-3xl text-3xl font-bold tracking-[-.055em] sm:text-5xl">
          {catalog?.tenant.name ?? (loading ? "Preparando sua experiência..." : "Agendamento indisponível")}
        </h1>
        <p className="relative mt-4 max-w-lg text-sm leading-6 text-[#afb4a8]">
          Seu próximo corte começa aqui. Escolha o serviço, encontre um profissional e reserve seu horário em poucos passos.
        </p>
        <div className="relative mt-7 flex items-center gap-2 text-xs font-semibold text-[#d6d9d1]">
          <ShieldCheck size={17} className="text-[#f2c225]"/> Confirmação pelo estabelecimento
        </div>
      </div>

      {error && <div role="alert" className="mt-6 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}
      {loading && <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {[1, 2, 3].map(n => <div key={n} className="h-40 animate-pulse rounded-2xl bg-[#e9eae5]"/>)}
      </div>}
      {catalog && <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="rounded-[22px] border border-[#e7e9e3] bg-white p-6 sm:p-7">
            <div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181a16] text-sm font-bold text-white">1</span>
              <div><h2 className="text-lg font-bold">Escolha seu serviço</h2><p className="text-xs text-[#888e84]">O que vamos fazer hoje?</p></div>
            </div>
            {catalog.services.length === 0 ? <div className="rounded-xl bg-[#f5f6f2] px-4 py-8 text-center text-sm text-[#878c81]">
              A barbearia ainda não disponibilizou serviços.
            </div> : <div className="grid gap-3 sm:grid-cols-2">
              {catalog.services.map(item => <button key={item.id} type="button" aria-pressed={serviceId === item.id}
                onClick={() => { setServiceId(item.id); setProfessionalId(""); setSlots([]); }}
                className={`flex flex-col items-start rounded-2xl border p-4 text-left transition
                  ${serviceId === item.id ? "border-[#1b1c18] bg-[#f8f8f3] ring-1 ring-[#1b1c18]" : "border-[#e8e9e4] hover:border-[#9da298]"}`}>
                <div className="flex w-full items-start justify-between gap-3">
                  <span className="rounded-xl bg-[#eeefea] p-2.5"><Scissors size={17}/></span>
                  {serviceId === item.id && <Check size={17} className="text-[#242b20]"/>}
                </div>
                <span className="mt-4 text-sm font-bold">{item.name}</span>
                <span className="mt-1 min-h-8 text-[11px] leading-4 text-[#898e84]">{item.description || "Atendimento profissional"}</span>
                <div className="mt-4 flex w-full items-center justify-between border-t border-[#e9eae4] pt-3">
                  <span className="text-sm font-bold">{money(item.priceCents)}</span>
                  <span className="flex items-center gap-1 text-[11px] text-[#888d84]"><Clock3 size={12}/>{item.durationMinutes} min</span>
                </div>
              </button>)}
            </div>}
          </section>

          <section className="rounded-[22px] border border-[#e7e9e3] bg-white p-6 sm:p-7">
            <div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181a16] text-sm font-bold text-white">2</span>
              <div><h2 className="text-lg font-bold">Selecione o profissional</h2><p className="text-xs text-[#888e84]">Quem vai cuidar do seu visual?</p></div>
            </div>
            {!serviceId ? <p className="rounded-xl bg-[#f5f6f2] p-5 text-xs text-[#959a91]">Selecione primeiro um serviço.</p> :
              professionals.length === 0 ? <p className="rounded-xl bg-[#f5f6f2] p-5 text-xs text-[#959a91]">Nenhum profissional habilitado para este serviço.</p> :
              <div className="grid gap-3 sm:grid-cols-2">
                {professionals.map(person => <button key={person.id} type="button" aria-pressed={professionalId === person.id}
                  onClick={() => setProfessionalId(person.id)}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition
                    ${professionalId === person.id ? "border-[#171916] bg-[#f8f8f4] ring-1 ring-[#171916]" : "border-[#e7e9e2] hover:border-[#9da298]"}`}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9ebe5] text-[#666b61]"><UserRound size={22}/></span>
                  <span className="flex-1 text-sm font-semibold">{person.name}</span>
                  {professionalId === person.id && <Check size={17}/>}
                </button>)}
              </div>}
          </section>

          <section className="rounded-[22px] border border-[#e7e9e3] bg-white p-6 sm:p-7">
            <div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181a16] text-sm font-bold text-white">3</span>
              <div><h2 className="text-lg font-bold">Data e horário</h2><p className="text-xs text-[#888e84]">Escolha o melhor momento para você.</p></div>
            </div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#888e85]">Próximos dias</p>
              <input aria-label="Selecionar data" type="date" min={today} value={day}
                onChange={e => setDay(e.target.value)}
                className="rounded-xl border border-[#e4e6e0] bg-white px-3 py-2 text-xs"/>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-3">
              {nextDays.map(value => <button key={value} type="button" aria-pressed={value === day}
                onClick={() => setDay(value)}
                className={`min-w-[104px] rounded-xl border px-3 py-3 text-xs font-semibold capitalize transition
                  ${value === day ? "border-[#171916] bg-[#171916] text-white" : "border-[#e6e8e2] bg-[#fafbf8] text-[#777c74] hover:border-[#a5aaa0]"}`}>
                {labelDay(value)}
              </button>)}
            </div>
            {!serviceId || !professionalId ? <p className="mt-3 rounded-xl bg-[#f5f6f2] p-5 text-xs text-[#949990]">Escolha o serviço e o profissional para visualizar os horários.</p> :
              loadingSlots ? <div className="mt-5 h-16 animate-pulse rounded-xl bg-[#f1f2ee]"/> :
              slots.length === 0 ? <p className="mt-5 rounded-xl bg-[#f5f6f2] p-5 text-xs text-[#898e84]">Sem horários disponíveis para esta data. Escolha outro dia.</p> :
              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {slots.map(iso => <button key={iso} type="button" aria-pressed={selectedSlot === iso}
                  onClick={() => setSelectedSlot(iso)}
                  className={`rounded-xl border px-3 py-3 text-xs font-bold transition
                    ${selectedSlot === iso ? "border-[#181a16] bg-[#181a16] text-white" : "border-[#e7e8e2] bg-white hover:border-[#9ea399]"}`}>
                  {time(iso)}
                </button>)}
              </div>}
          </section>
        </div>

        <aside className="sticky top-5 rounded-[22px] border border-[#e7e9e3] bg-white p-6 shadow-[0_12px_35px_#00000008]">
          <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#8b9085]">Seu agendamento</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">Resumo da reserva</h2>
          <div className="mt-6 space-y-4 border-t border-[#eeefea] pt-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[#848980]">Serviço</span>
              <span className="max-w-[170px] text-right text-xs font-semibold">{service?.name ?? "A escolher"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[#848980]">Profissional</span>
              <span className="max-w-[170px] text-right text-xs font-semibold">{selectedProfessional?.name ?? "A escolher"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[#848980]">Data</span>
              <span className="text-right text-xs font-semibold capitalize">{day ? labelDay(day) : "A escolher"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[#848980]">Horário</span>
              <span className="text-xs font-semibold">{selectedSlot ? time(selectedSlot) : "A escolher"}</span>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-[#eeefea] pt-5">
            <span className="text-sm text-[#767b71]">Total estimado</span>
            <span className="text-xl font-bold">{service ? money(service.priceCents) : "—"}</span>
          </div>
          <button type="button" disabled={!selectedSlot || submitting} onClick={() => void book()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#181a16] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#35372f] disabled:cursor-not-allowed disabled:opacity-40">
            {submitting ? "Reservando..." : "Confirmar agendamento"}<ArrowRight size={17}/>
          </button>
          <p className="mt-4 text-center text-[11px] leading-5 text-[#8b9087]">
            É preciso entrar na sua conta para reservar. A barbearia confirmará o atendimento.
          </p>
          <Link href="/cadastro-cliente" className="mt-4 block text-center text-xs font-semibold text-[#51574e] underline underline-offset-4">
            Ainda não tem conta? Cadastre-se
          </Link>
        </aside>
      </div>}
    </section>
  </main>;
}
