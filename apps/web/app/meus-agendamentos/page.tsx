"use client";
import { BrandLogo } from "../../components/brand/brand-provider";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
type Booking = { id: string; tenantId: string; serviceId: string; employeeMembershipId: string;
  status: string; startsAt: string; endsAt: string; priceCents: number;
  tenant: { name: string; slug: string }; service: { name: string };
  employee: { user: { name: string } } };
export default function MyBookingsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Booking[]>([]);
  const [status, setStatus] = useState("");
  const [dates, setDates] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Record<string, string[]>>({});

  async function load() {
    let result = await fetch(`${API}/my/bookings`, { credentials: "include", cache: "no-store" });
    if (result.status === 401) {
      const refreshed = await fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" });
      if (refreshed.ok) result = await fetch(`${API}/my/bookings`, { credentials: "include", cache: "no-store" });
    }
    if (result.status === 401) { router.push("/login"); return; }
    if (!result.ok) throw new Error("Falha ao carregar reservas");
    setItems(await result.json());
  }
  useEffect(() => { void load().catch(() => setStatus("Não foi possível carregar as reservas.")); }, []);
  async function cancel(item: Booking) {
    if (!window.confirm("Deseja cancelar este agendamento?")) return;
    const response = await fetch(`${API}/b/${encodeURIComponent(item.tenant.slug)}/bookings/${item.id}/cancel`,
      { method: "PATCH", credentials: "include" });
    setStatus(response.ok ? "Agendamento cancelado." : "Cancelamento não autorizado ou fora do prazo.");
    if (response.ok) await load();
  }
  async function getSlots(item: Booking, date: string) {
    setDates(old => ({ ...old, [item.id]: date }));
    const q = new URLSearchParams({ date, serviceId: item.serviceId, membershipId: item.employeeMembershipId });
    const response = await fetch(`${API}/b/${encodeURIComponent(item.tenant.slug)}/slots?${q}`);
    const data: { slots?: string[] } | null = response.ok ? await response.json() : null;
    setSlots(old => ({ ...old, [item.id]: data?.slots ?? [] }));
  }
  async function reschedule(item: Booking, startsAt: string) {
    const response = await fetch(`${API}/b/${encodeURIComponent(item.tenant.slug)}/bookings/${item.id}/reschedule`,
      { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt }) });
    setStatus(response.ok ? "Solicitação de remarcação registrada." : "Horário não disponível ou fora do prazo.");
    if (response.ok) { setSlots({}); await load(); }
  }
  const when = (iso: string) => new Intl.DateTimeFormat("pt-BR",
    { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
  return <main className="shell">
    <header className="nav"><Link href="/" className="brand"><BrandLogo className="h-12 max-w-[230px]"/></Link><Link href="/painel">Painel</Link></header>
    <section className="booking-wrap"><span className="eyebrow">Área do cliente</span><h1>Meus agendamentos</h1>
      <p role="status">{status}</p>
      {items.length === 0 && <p>Nenhum agendamento registrado.</p>}
      {items.map(item => <article className="booking-item" key={item.id}>
        <h2>{item.service.name} · {item.tenant.name}</h2>
        <p>{when(item.startsAt)} · {item.employee.user.name} · <strong>{item.status}</strong></p>
        {["PENDING", "CONFIRMED"].includes(item.status) && <>
          <button type="button" onClick={() => cancel(item)}>Cancelar</button>
          <label>Remarcar para outro dia
            <input type="date" value={dates[item.id] ?? ""} onChange={e => void getSlots(item, e.target.value)}/>
          </label>
          <div className="booking-slots">{(slots[item.id] ?? []).map(slot =>
            <button className="slot" type="button" key={slot} onClick={() => void reschedule(item, slot)}>
              {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(slot))}
            </button>)}</div>
        </>}
      </article>)}
      <p className="helper">Cancelamentos e remarcações pelo cliente exigem pelo menos duas horas de antecedência.</p>
    </section></main>;
}
