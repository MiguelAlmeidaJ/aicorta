"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
type Service = { id: string; name: string; description: string | null; durationMinutes: number; priceCents: number };
type Professional = { id: string; name: string; serviceIds: string[] };
type Catalog = { tenant: { id: string; name: string; slug: string; timezone: string };
  services: Service[]; professionals: Professional[] };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function BarberPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [day, setDay] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const workers = useMemo(() => catalog?.professionals.filter(p => p.serviceIds.includes(serviceId)) ?? [],
    [catalog, serviceId]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    fetch(`${API}/b/${encodeURIComponent(slug)}`)
      .then(r => { if (!r.ok) throw new Error("Barbearia indisponível"); return r.json() as Promise<Catalog>; })
      .then(data => { if (active) setCatalog(data); })
      .catch(() => { if (active) setStatus("Não foi possível carregar a barbearia."); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!slug || !serviceId || !professionalId || !day) { setSlots([]); return; }
    let active = true;
    setSelected("");
    const params = new URLSearchParams({ serviceId, membershipId: professionalId, date: day });
    fetch(`${API}/b/${encodeURIComponent(slug)}/slots?${params}`)
      .then(r => { if (!r.ok) throw new Error("Erro ao consultar horários"); return r.json(); })
      .then(data => { if (active) setSlots(data.slots ?? []); })
      .catch(() => { if (active) setStatus("Não foi possível consultar horários."); });
    return () => { active = false; };
  }, [slug, serviceId, professionalId, day]);

  const label = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: catalog?.tenant.timezone,
    hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  async function book() {
    if (!selected || !serviceId || !professionalId) return;
    setBusy(true); setStatus("");
    try {
      const endpoint = `${API}/b/${encodeURIComponent(slug)}/bookings`;
      let response = await fetch(endpoint, { method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, employeeMembershipId: professionalId, startsAt: selected }) });
      if (response.status === 401) {
        const refresh = await fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" });
        if (refresh.ok) response = await fetch(endpoint, { method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId, employeeMembershipId: professionalId, startsAt: selected }) });
      }
      if (response.status === 401) { router.push("/login?next=" + encodeURIComponent("/b/" + slug)); return; }
      if (response.status === 409) { setStatus("Esse horário foi reservado. Escolha outro."); setSelected(""); return; }
      if (!response.ok) throw new Error("Não foi possível reservar. Confira seus dados e tente novamente.");
      router.push("/meus-agendamentos");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Erro ao reservar"); }
    finally { setBusy(false); }
  }

  return <main className="shell">
    <header className="nav"><Link href="/" className="brand">✂ AICorta</Link><Link href="/meus-agendamentos">Minhas reservas</Link></header>
    <section className="booking-wrap">
      <span className="eyebrow">Agendamento online</span>
      <h1>{catalog?.tenant.name ?? "Carregando barbearia..."}</h1>
      {catalog && <div className="booking-steps">
        <label>1. Escolha o serviço
          <select value={serviceId} onChange={e => { setServiceId(e.target.value); setProfessionalId(""); setSlots([]); }}>
            <option value="">Selecione o serviço</option>
            {catalog.services.map(s => <option value={s.id} key={s.id}>{s.name} · {money(s.priceCents)} · {s.durationMinutes}min</option>)}
          </select>
        </label>
        <label>2. Escolha o profissional
          <select value={professionalId} onChange={e => setProfessionalId(e.target.value)}>
            <option value="">Selecione o profissional</option>
            {workers.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>3. Escolha o dia
          <input type="date" value={day} onChange={e => setDay(e.target.value)}/>
        </label>
        <div><strong>4. Escolha o horário</strong>
          <div className="booking-slots">{slots.map(iso => <button type="button" key={iso}
            className={selected === iso ? "selected" : "slot"} onClick={() => setSelected(iso)}>{label(iso)}</button>)}</div>
          {day && professionalId && serviceId && slots.length === 0 && <p>Nenhum horário disponível nesta data.</p>}
        </div>
        <button type="button" disabled={!selected || busy} onClick={book}>{busy ? "Reservando..." : "Confirmar agendamento"}</button>
        <p role="status">{status}</p>
        <p className="helper">É necessário entrar na sua conta para concluir. A reserva fica pendente até confirmação do estabelecimento.</p>
      </div>}
      {!catalog && <p role="status">{status}</p>}
    </section>
  </main>;
}
