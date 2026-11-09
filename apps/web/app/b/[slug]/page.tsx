"use client";

/* eslint-disable @next/next/no-img-element -- imagens públicas vêm da API configurável */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Clock3, MapPin, Scissors, ShieldCheck, UserRound } from "lucide-react";
import { BrandLogo } from "../../../components/brand/brand-provider";
import { UserMenu } from "../../../components/auth/user-menu";
import { API_URL, apiFetch, apiJson } from "../../../lib/api";
import { money } from "../../../components/dashboard/ui";

type Service = { id: string; name: string; description: string | null; durationMinutes: number; priceCents: number; imageUrl: string | null };
type Professional = { id: string; name: string; serviceIds: string[] };
type Catalog = { tenant: { id: string; name: string; slug: string; timezone: string; city: string | null; state: string | null; neighborhood: string | null; coverUrl: string | null }; services: Service[]; professionals: Professional[] };
type Slots = { slots: string[] };

function localToday(zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (name: string) => parts.find(part => part.type === name)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function plusDays(ymd: string, days: number) { const date = new Date(ymd + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function labelDay(day: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(day + "T12:00:00Z")); }

export default function PublicBarbershopPage() {
  const { slug } = useParams<{ slug: string }>(); const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null); const [loading, setLoading] = useState(true);
  const [professionalId, setProfessionalId] = useState(""); const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [day, setDay] = useState(""); const [slots, setSlots] = useState<string[]>([]); const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState("");
  const professional = catalog?.professionals.find(item => item.id === professionalId);
  const availableServices = useMemo(() => catalog?.services.filter(item => professional?.serviceIds.includes(item.id)) ?? [], [catalog, professional]);
  const selectedServices = useMemo(() => catalog?.services.filter(item => serviceIds.includes(item.id)) ?? [], [catalog, serviceIds]);
  const total = selectedServices.reduce((sum, item) => sum + item.priceCents, 0); const duration = selectedServices.reduce((sum, item) => sum + item.durationMinutes, 0);
  const today = catalog ? localToday(catalog.tenant.timezone) : ""; const days = useMemo(() => today ? Array.from({ length: 7 }, (_, index) => plusDays(today, index)) : [], [today]);
  const location = catalog ? [catalog.tenant.neighborhood, [catalog.tenant.city, catalog.tenant.state].filter(Boolean).join(" / ")].filter(Boolean).join(" · ") : "";
  const time = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: catalog?.tenant.timezone ?? "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  useEffect(() => {
    let active = true; if (!slug) return;
    apiJson<Catalog>(`/b/${encodeURIComponent(slug)}`).then(data => { if (active) { setCatalog(data); setDay(localToday(data.tenant.timezone)); } })
      .catch(() => { if (active) setError("Este estabelecimento não está disponível no momento."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);
  useEffect(() => {
    let active = true; if (!slug || !professionalId || !serviceIds.length || !day) return;
    const query = new URLSearchParams({ date: day, serviceIds: serviceIds.join(","), membershipId: professionalId });
    apiJson<Slots>(`/b/${encodeURIComponent(slug)}/slots?${query}`).then(result => { if (active) setSlots(result.slots); })
      .catch(() => { if (active) { setSlots([]); setError("Não foi possível consultar os horários."); } }).finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [day, professionalId, serviceIds, slug]);

  function chooseProfessional(id: string) { setProfessionalId(id); setServiceIds([]); setSlots([]); setSelectedSlot(""); }
  function toggleService(id: string) { setServiceIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); setSlots([]); setSelectedSlot(""); setLoadingSlots(true); }
  function chooseDay(value: string) { setDay(value); setSlots([]); setSelectedSlot(""); if (professionalId && serviceIds.length) setLoadingSlots(true); }
  async function book() {
    if (!selectedSlot || !professionalId || !serviceIds.length || submitting) return; setSubmitting(true); setError("");
    try {
      const response = await apiFetch(`/b/${encodeURIComponent(slug)}/bookings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceIds, employeeMembershipId: professionalId, startsAt: selectedSlot }) });
      if (response.status === 401) { router.push("/login?next=" + encodeURIComponent("/b/" + slug)); return; }
      if (response.status === 409) { setError("Esse horário acabou de ser reservado. Escolha outro."); setSelectedSlot(""); return; }
      if (!response.ok) { const body = await response.json().catch(() => ({})) as { message?: string | string[] }; throw new Error(Array.isArray(body.message) ? body.message.join("; ") : body.message ?? "Não foi possível reservar."); }
      router.push("/meus-agendamentos");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível concluir a reserva."); }
    finally { setSubmitting(false); }
  }

  const stepClass = "rounded-[22px] border border-[#e4e6df] bg-white p-6 sm:p-8";
  return <main className="min-h-screen bg-[#f3f4f0] text-[#171916]">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"><Link href="/"><BrandLogo className="h-11 max-w-[200px]"/></Link><div className="flex items-center gap-4"><Link href="/meus-agendamentos" className="hidden text-xs font-semibold text-[#686e65] sm:block">Meus horários</Link><UserMenu/></div></header>
    <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
      <div className="relative aspect-[1280/520] min-h-[300px] overflow-hidden rounded-[28px] bg-[#171916] text-white">{catalog?.tenant.coverUrl ? <img src={`${API_URL}${catalog.tenant.coverUrl}`} alt="" className="absolute inset-0 h-full w-full object-cover"/> : null}<div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/20"/>
        <div className="relative flex h-full max-w-3xl flex-col justify-center p-7 sm:p-12"><span className="w-fit rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.17em] text-[#f2c225]">Agendamento online</span><h1 className="mt-5 text-4xl font-bold tracking-[-.055em] sm:text-6xl">{catalog?.tenant.name ?? (loading ? "Carregando..." : "Indisponível")}</h1><p className="mt-4 max-w-xl text-sm leading-6 text-white/70">Escolha quem vai atender você, monte seu atendimento e encontre o melhor horário.</p><div className="mt-6 flex flex-wrap gap-5 text-xs font-semibold text-white/80">{location ? <span className="flex items-center gap-2"><MapPin size={16} className="text-[#f2c225]"/>{location}</span> : null}<span className="flex items-center gap-2"><ShieldCheck size={16} className="text-[#f2c225]"/>Reserva segura</span></div></div>
      </div>
      {error ? <p role="alert" className="mt-6 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p> : null}
      {catalog ? <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-6">
        <section className={stepClass}><Step number="1" title="Escolha o profissional" description="Quem vai cuidar do seu visual?"/><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{catalog.professionals.map(person => <button key={person.id} type="button" aria-pressed={professionalId === person.id} onClick={() => chooseProfessional(person.id)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${professionalId === person.id ? "border-[#171916] bg-[#f7f7f2] ring-1 ring-[#171916]" : "border-[#e5e7e0] hover:border-[#9b9f97]"}`}><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9ebe5]"><UserRound size={21}/></span><span className="flex-1 text-sm font-bold">{person.name}</span>{professionalId === person.id ? <Check size={17}/> : null}</button>)}</div></section>
        <section className={`${stepClass} ${professionalId ? "" : "opacity-60"}`}><Step number="2" title="Selecione um ou mais serviços" description="Monte o atendimento do seu jeito."/>{!professionalId ? <Empty text="Escolha primeiro um profissional."/> : <div className="mt-6 grid gap-3 sm:grid-cols-2">{availableServices.map(item => { const selected = serviceIds.includes(item.id); return <button key={item.id} type="button" aria-pressed={selected} onClick={() => toggleService(item.id)} className={`flex gap-4 rounded-2xl border p-3 text-left ${selected ? "border-[#171916] bg-[#f8f8f3] ring-1 ring-[#171916]" : "border-[#e5e7e0] hover:border-[#999e94]"}`}><span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#eff0ec]">{item.imageUrl ? <img src={`${API_URL}${item.imageUrl}`} alt="" className="h-full w-full object-contain"/> : <Scissors/>}</span><span className="min-w-0 flex-1 py-1"><span className="flex items-start justify-between gap-2"><strong className="text-sm">{item.name}</strong>{selected ? <span className="rounded-full bg-[#171916] p-1 text-white"><Check size={12}/></span> : null}</span><span className="mt-2 block text-xs text-[#858a81]">{item.description || "Atendimento profissional"}</span><span className="mt-4 flex items-center justify-between text-xs"><b>{money(item.priceCents)}</b><span className="flex items-center gap-1 text-[#858a81]"><Clock3 size={12}/>{item.durationMinutes} min</span></span></span></button>; })}</div>}</section>
        <section className={`${stepClass} ${serviceIds.length ? "" : "opacity-60"}`}><Step number="3" title="Escolha a data e o horário" description={duration ? `${duration} minutos reservados para seu atendimento.` : "Veja os horários disponíveis."}/>{!serviceIds.length ? <Empty text="Selecione pelo menos um serviço."/> : <><div className="mt-6 flex gap-2 overflow-x-auto pb-2">{days.map(value => <button key={value} type="button" aria-pressed={day === value} onClick={() => chooseDay(value)} className={`min-w-[104px] rounded-xl border px-3 py-3 text-xs font-semibold capitalize ${day === value ? "border-[#171916] bg-[#171916] text-white" : "border-[#e4e6df]"}`}>{labelDay(value)}</button>)}</div>{loadingSlots ? <div className="mt-5 h-16 animate-pulse rounded-xl bg-[#eef0ea]"/> : slots.length ? <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">{slots.map(slot => <button key={slot} type="button" aria-pressed={selectedSlot === slot} onClick={() => setSelectedSlot(slot)} className={`rounded-xl border px-3 py-3 text-xs font-bold ${selectedSlot === slot ? "border-[#171916] bg-[#171916] text-white" : "border-[#e4e6df] hover:border-[#92978e]"}`}>{time(slot)}</button>)}</div> : <Empty text="Nenhum horário disponível para esta data."/>}</>}</section>
      </div><aside className="sticky top-5 rounded-[22px] border border-[#e4e6df] bg-white p-6 shadow-[0_14px_40px_#0000000b]"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8b9087]">Seu agendamento</p><h2 className="mt-2 text-xl font-bold">Resumo da reserva</h2><div className="mt-6 space-y-4 border-t border-[#eceee8] pt-5"><Summary label="Profissional" value={professional?.name ?? "A escolher"}/><div><span className="text-xs text-[#858a81]">Serviços</span><div className="mt-2 space-y-1">{selectedServices.length ? selectedServices.map(item => <p key={item.id} className="text-xs font-semibold">{item.name}</p>) : <p className="text-xs font-semibold">A escolher</p>}</div></div><Summary label="Data" value={day ? labelDay(day) : "A escolher"}/><Summary label="Horário" value={selectedSlot ? time(selectedSlot) : "A escolher"}/><Summary label="Duração" value={duration ? `${duration} min` : "—"}/></div><div className="mt-6 flex items-center justify-between border-t border-[#eceee8] pt-5"><span className="text-sm text-[#767b72]">Total</span><strong className="text-xl">{money(total)}</strong></div><button type="button" disabled={!selectedSlot || submitting} onClick={() => void book()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#171916] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40">{submitting ? "Reservando..." : "Confirmar agendamento"}<ArrowRight size={17}/></button></aside></div> : null}
    </section>
  </main>;
}

function Step({ number, title, description }: { number: string; title: string; description: string }) { return <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#171916] text-sm font-bold text-white">{number}</span><div><h2 className="text-lg font-bold">{title}</h2><p className="text-xs text-[#888e84]">{description}</p></div></div>; }
function Empty({ text }: { text: string }) { return <p className="mt-6 rounded-xl bg-[#f3f4f0] p-5 text-xs text-[#8b9087]">{text}</p>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-xs text-[#858a81]">{label}</span><span className="text-right text-xs font-semibold capitalize">{value}</span></div>; }
