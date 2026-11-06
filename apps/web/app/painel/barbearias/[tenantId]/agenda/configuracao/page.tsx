"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarOff, Plus, Save, Trash2 } from "lucide-react";
import { apiJson, mutation } from "../../../../../../lib/api";
import { fieldClass, PageHeader, Panel, primaryButton, secondaryButton } from "../../../../../../components/dashboard/ui";

type WindowRow = { id?: string; weekday: number; startMinute: number; endMinute: number };
type Member = { id: string; user: { name: string } };
type Service = { id: string; name: string; isActive: boolean };
type Assigned = { service: Service };
type TimeOff = { id: string; startsAt: string; endsAt: string; reason: string | null };
const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const time = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const minute = (value: string) => { const [hour, min] = value.split(":").map(Number); return hour * 60 + min; };

function WindowsEditor({ rows, onChange }: { rows: WindowRow[]; onChange: (rows: WindowRow[]) => void }) {
  const update = (index: number, patch: Partial<WindowRow>) => onChange(rows.map((row, position) => position === index ? { ...row, ...patch } : row));
  return <div className="space-y-3">
    {rows.map((row, index) => <div key={`${row.weekday}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <select aria-label="Dia da semana" className={fieldClass} value={row.weekday} onChange={event => update(index, { weekday: Number(event.target.value) })}>
        {days.map((day, value) => <option key={day} value={value}>{day}</option>)}
      </select>
      <input aria-label="Início" className={fieldClass} type="time" value={time(row.startMinute)} onChange={event => update(index, { startMinute: minute(event.target.value) })}/>
      <input aria-label="Fim" className={fieldClass} type="time" value={time(row.endMinute)} onChange={event => update(index, { endMinute: minute(event.target.value) })}/>
      <button type="button" aria-label="Remover intervalo" className={secondaryButton} onClick={() => onChange(rows.filter((_, position) => position !== index))}><Trash2 size={15}/></button>
    </div>)}
    <button type="button" className={secondaryButton} onClick={() => onChange([...rows, { weekday: 1, startMinute: 540, endMinute: 1080 }])}><Plus size={15}/>Adicionar intervalo</button>
  </div>;
}

export default function ScheduleConfigurationPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [shop, setShop] = useState<WindowRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [memberId, setMemberId] = useState("");
  const [staff, setStaff] = useState<WindowRow[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiJson<WindowRow[]>(`/tenants/${tenantId}/agenda/hours`),
      apiJson<Member[]>(`/tenants/${tenantId}/employees`),
      apiJson<Service[]>(`/tenants/${tenantId}/services/manage`),
    ]).then(([hours, people, catalog]) => { if (active) { setShop(hours); setMembers(people); setServices(catalog.filter(item => item.isActive)); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Erro ao carregar configuração"); });
    return () => { active = false; };
  }, [tenantId]);

  useEffect(() => {
    if (!memberId) return;
    let active = true;
    Promise.all([
      apiJson<WindowRow[]>(`/tenants/${tenantId}/agenda/professionals/${memberId}/hours`),
      apiJson<Assigned[]>(`/tenants/${tenantId}/agenda/professionals/${memberId}/services`),
      apiJson<TimeOff[]>(`/tenants/${tenantId}/agenda/professionals/${memberId}/time-off`),
    ]).then(([hours, enabled, absences]) => { if (active) { setStaff(hours); setAssigned(enabled.map(item => item.service.id)); setTimeOff(absences); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Erro ao carregar profissional"); });
    return () => { active = false; };
  }, [memberId, tenantId]);

  async function saveWindows(scope: "shop" | "staff") {
    setError(""); setMessage("");
    const path = scope === "shop" ? "hours" : `professionals/${memberId}/hours`;
    try {
      await apiJson(`/tenants/${tenantId}/agenda/${path}`, mutation("PUT", { windows: scope === "shop" ? shop : staff }));
      setMessage("Horários salvos com sucesso.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar horários"); }
  }

  async function saveServices() {
    try {
      await apiJson(`/tenants/${tenantId}/agenda/professionals/${memberId}/services`, mutation("PUT", { serviceIds: assigned }));
      setMessage("Serviços do profissional atualizados.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar serviços"); }
  }

  async function addTimeOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiJson(`/tenants/${tenantId}/agenda/time-off`, mutation("POST", {
        membershipId: memberId, startsAt: new Date(String(form.get("startsAt"))).toISOString(),
        endsAt: new Date(String(form.get("endsAt"))).toISOString(), reason: form.get("reason"),
      }));
      setTimeOff(await apiJson<TimeOff[]>(`/tenants/${tenantId}/agenda/professionals/${memberId}/time-off`));
      event.currentTarget.reset(); setMessage("Folga registrada.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível registrar a folga"); }
  }

  return <>
    <PageHeader kicker="Agenda / Preparação" title="Configuração da agenda" description="Defina expediente, jornada, serviços e folgas antes de abrir reservas." action={<Link className={secondaryButton} href={`/painel/barbearias/${tenantId}/agenda`}>Voltar à agenda</Link>}/>
    {message && <p role="status" className="mb-4 rounded-xl bg-[#eaf1e8] p-4 text-sm text-[#48654b]">{message}</p>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-[#faeeee] p-4 text-sm text-[#a14740]">{error}</p>}
    <div className="space-y-6">
      <Panel title="Expediente da barbearia" description="Adicione mais de um intervalo no mesmo dia para representar pausas.">
        <WindowsEditor rows={shop} onChange={setShop}/><button type="button" className={primaryButton + " mt-5"} onClick={() => void saveWindows("shop")}><Save size={16}/>Salvar expediente</button>
      </Panel>
      <Panel title="Configuração por profissional" description="A jornada precisa estar dentro do expediente geral.">
        <select aria-label="Profissional" className={fieldClass} value={memberId} onChange={event => setMemberId(event.target.value)}><option value="">Selecione um profissional</option>{members.map(member => <option key={member.id} value={member.id}>{member.user.name}</option>)}</select>
        {memberId && <div className="mt-6 space-y-7">
          <div><h3 className="mb-3 text-sm font-bold">Jornada semanal</h3><WindowsEditor rows={staff} onChange={setStaff}/><button type="button" className={primaryButton + " mt-4"} onClick={() => void saveWindows("staff")}><Save size={16}/>Salvar jornada</button></div>
          <div><h3 className="mb-3 text-sm font-bold">Serviços habilitados</h3><div className="grid gap-2 sm:grid-cols-2">{services.map(service => <label key={service.id} className="flex items-center gap-3 rounded-xl border border-[#e5e7e1] p-3 text-sm"><input type="checkbox" checked={assigned.includes(service.id)} onChange={event => setAssigned(current => event.target.checked ? [...current, service.id] : current.filter(id => id !== service.id))}/>{service.name}</label>)}</div><button type="button" className={primaryButton + " mt-4"} onClick={() => void saveServices()}><Save size={16}/>Salvar serviços</button></div>
          <div><h3 className="mb-3 text-sm font-bold">Folgas e bloqueios</h3><form className="grid gap-3 md:grid-cols-4" onSubmit={addTimeOff}><input className={fieldClass} aria-label="Início da folga" name="startsAt" type="datetime-local" required/><input className={fieldClass} aria-label="Fim da folga" name="endsAt" type="datetime-local" required/><input className={fieldClass} aria-label="Motivo" name="reason" placeholder="Motivo (opcional)"/><button className={primaryButton}><CalendarOff size={16}/>Registrar</button></form><div className="mt-3 space-y-2">{timeOff.map(item => <p key={item.id} className="rounded-xl bg-[#f5f6f2] p-3 text-xs">{new Date(item.startsAt).toLocaleString("pt-BR")} — {new Date(item.endsAt).toLocaleString("pt-BR")} {item.reason ? `· ${item.reason}` : ""}</p>)}</div></div>
        </div>}
      </Panel>
    </div>
  </>;
}
