"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarOff, Coffee, Plus, Save, Trash2 } from "lucide-react";
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


type DayRow = { weekday: number; startMinute: number; endMinute: number };
type ScheduleDraft =
  | { kind: "weekly"; days: DayRow[]; lunchEnabled: boolean; lunchStart: number; lunchEnd: number }
  | { kind: "custom"; windows: WindowRow[] };

const defaultWeek = (): ScheduleDraft => ({
  kind: "weekly",
  days: [1, 2, 3, 4, 5].map(weekday => ({ weekday, startMinute: 540, endMinute: 1080 })),
  lunchEnabled: true, lunchStart: 720, lunchEnd: 780,
});

/** O banco armazena somente intervalos de trabalho. A pausa é a lacuna entre eles. */
function fromWindows(windows: WindowRow[]): ScheduleDraft {
  if (!windows.length) return defaultWeek();
  const groups = new Map<number, WindowRow[]>();
  for (const row of windows) groups.set(row.weekday, [...(groups.get(row.weekday) ?? []), row]);
  const sorted = [...groups].sort(([a], [b]) => a - b)
    .map(([weekday, intervals]) => ({ weekday, intervals: intervals.sort((a, b) => a.startMinute - b.startMinute) }));
  const gaps = sorted.flatMap(({ intervals }) =>
    intervals.slice(1).map((row, i) => [intervals[i].endMinute, row.startMinute] as const));
  const lunch = gaps[0];
  const supported = sorted.every(({ intervals }) => intervals.length <= 2) &&
    gaps.every(gap => lunch && gap[0] === lunch[0] && gap[1] === lunch[1]) &&
    (!lunch || sorted.every(({ intervals }) =>
      intervals.length === 2 || intervals[0].endMinute <= lunch[0] || intervals[0].startMinute >= lunch[1]));
  if (!supported) return { kind: "custom", windows };
  return {
    kind: "weekly",
    days: sorted.map(({ weekday, intervals }) => ({
      weekday, startMinute: intervals[0].startMinute, endMinute: intervals[intervals.length - 1].endMinute,
    })),
    lunchEnabled: Boolean(lunch), lunchStart: lunch?.[0] ?? 720, lunchEnd: lunch?.[1] ?? 780,
  };
}

function toWindows(draft: ScheduleDraft): WindowRow[] {
  if (draft.kind === "custom") return draft.windows;
  return draft.days.flatMap(day => {
    if (!draft.lunchEnabled || day.endMinute <= draft.lunchStart || day.startMinute >= draft.lunchEnd) {
      return [{ ...day }];
    }
    return [
      ...(day.startMinute < draft.lunchStart
        ? [{ weekday: day.weekday, startMinute: day.startMinute, endMinute: draft.lunchStart }] : []),
      ...(day.endMinute > draft.lunchEnd
        ? [{ weekday: day.weekday, startMinute: draft.lunchEnd, endMinute: day.endMinute }] : []),
    ];
  }).sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
}

function WindowsEditor({ draft, onChange, description }: {
  draft: ScheduleDraft; onChange: (draft: ScheduleDraft) => void; description: string;
}) {
  const [newDay, setNewDay] = useState(6);
  if (draft.kind === "custom") {
    const update = (index: number, patch: Partial<WindowRow>) => onChange({
      kind: "custom", windows: draft.windows.map((row, i) => i === index ? { ...row, ...patch } : row),
    });
    return <div className="space-y-3">
      <p className="rounded-xl bg-[#faf7ee] p-3 text-xs leading-5 text-[#786c49]">
        Este expediente já possui pausas diferentes entre os dias. Os intervalos existentes foram preservados para não alterar seus horários. Edite-os abaixo.
      </p>
      {draft.windows.map((row, index) => <div key={row.id ?? index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select aria-label="Dia da semana" className={fieldClass} value={row.weekday}
          onChange={event => update(index, { weekday: Number(event.target.value) })}>
          {days.map((day, value) => <option key={day} value={value}>{day}</option>)}
        </select>
        <input aria-label="Início" className={fieldClass} type="time" value={time(row.startMinute)}
          onChange={event => update(index, { startMinute: minute(event.target.value) })}/>
        <input aria-label="Fim" className={fieldClass} type="time" value={time(row.endMinute)}
          onChange={event => update(index, { endMinute: minute(event.target.value) })}/>
        <button type="button" aria-label="Remover intervalo" className={secondaryButton}
          onClick={() => onChange({ kind: "custom", windows: draft.windows.filter((_, i) => i !== index) })}><Trash2 size={15}/></button>
      </div>)}
      <button type="button" className={secondaryButton} onClick={() => onChange({
        kind: "custom", windows: [...draft.windows, { weekday: 1, startMinute: 540, endMinute: 1080 }],
      })}><Plus size={15}/>Adicionar intervalo</button>
      <button type="button" className="block text-xs font-semibold text-[#50574e] underline underline-offset-4"
        onClick={() => onChange(defaultWeek())}>Substituir pelos horários padrão de segunda a sexta</button>
    </div>;
  }

  const updateDay = (weekday: number, patch: Partial<DayRow>) =>
    onChange({ ...draft, days: draft.days.map(day => day.weekday === weekday ? { ...day, ...patch } : day) });
  const remaining = [1, 2, 3, 4, 5, 6, 0].filter(weekday => !draft.days.some(day => day.weekday === weekday));

  return <div className="space-y-5">
    <p className="text-xs leading-5 text-[#8b9188]">{description}</p>
    <div className="overflow-hidden rounded-xl border border-[#e7e9e3]">
      <div className="hidden grid-cols-[minmax(100px,1fr)_minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 bg-[#f6f7f4] px-4 py-3 text-[11px] font-semibold text-[#777e74] sm:grid">
        <span>Dia</span><span>Abertura</span><span>Fechamento</span><span/>
      </div>
      {draft.days.map(day => <div key={day.weekday}
        className="grid grid-cols-[1fr_1fr_40px] items-end gap-2 border-t border-[#eceee9] px-3 py-3 first:border-0 sm:grid-cols-[minmax(100px,1fr)_minmax(0,1fr)_minmax(0,1fr)_44px] sm:items-center sm:gap-3 sm:px-4">
        <div className="col-span-3 text-[13px] font-semibold text-[#242824] sm:col-span-1">{days[day.weekday]}</div>
        <label className="text-[10px] text-[#8a9187] sm:text-transparent">Abertura
          <input aria-label={`Abertura de ${days[day.weekday]}`} type="time" className={fieldClass + " mt-1 sm:mt-0"}
            value={time(day.startMinute)} onChange={event => updateDay(day.weekday, { startMinute: minute(event.target.value) })}/>
        </label>
        <label className="text-[10px] text-[#8a9187] sm:text-transparent">Fechamento
          <input aria-label={`Fechamento de ${days[day.weekday]}`} type="time" className={fieldClass + " mt-1 sm:mt-0"}
            value={time(day.endMinute)} onChange={event => updateDay(day.weekday, { endMinute: minute(event.target.value) })}/>
        </label>
        <button type="button" title={`Remover ${days[day.weekday]}`}
          aria-label={`Remover ${days[day.weekday]}`} className="flex h-11 w-10 items-center justify-center rounded-xl border border-[#e6e8e2] text-[#8d928a] hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          onClick={() => onChange({ ...draft, days: draft.days.filter(item => item.weekday !== day.weekday) })}><Trash2 size={16}/></button>
      </div>)}
    </div>

    {remaining.length > 0 && <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Dia para adicionar" className={fieldClass + " max-w-[200px]"}
        value={remaining.includes(newDay) ? newDay : remaining[0]}
        onChange={event => setNewDay(Number(event.target.value))}>
        {remaining.map(weekday => <option key={weekday} value={weekday}>{days[weekday]}</option>)}
      </select>
      <button type="button" className={secondaryButton} onClick={() => {
        const weekday = remaining.includes(newDay) ? newDay : remaining[0];
        onChange({ ...draft, days: [...draft.days, { weekday, startMinute: 540, endMinute: 1080 }]
          .sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7)) });
      }}><Plus size={15}/>Adicionar dia</button>
    </div>}

    <div className="rounded-xl border border-[#e5e7e1] bg-[#fafbf9] p-4 sm:p-5">
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" className="h-4 w-4 accent-[#171917]" checked={draft.lunchEnabled}
          onChange={event => onChange({ ...draft, lunchEnabled: event.target.checked })}/>
        <Coffee size={17} className="text-[#575f55]"/>
        <span className="text-[13px] font-semibold text-[#292e28]">Horário de almoço</span>
      </label>
      <p className="mt-2 text-xs leading-5 text-[#858c82]">
        Uma única pausa para os dias configurados. Os horários de almoço não ficarão disponíveis para agendamento.
      </p>
      {draft.lunchEnabled && <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-[360px]">
        <label className="text-xs font-semibold text-[#50574f]">Início do almoço
          <input aria-label="Início do almoço" type="time" className={fieldClass + " mt-2"}
            value={time(draft.lunchStart)} onChange={event => onChange({ ...draft, lunchStart: minute(event.target.value) })}/>
        </label>
        <label className="text-xs font-semibold text-[#50574f]">Fim do almoço
          <input aria-label="Fim do almoço" type="time" className={fieldClass + " mt-2"}
            value={time(draft.lunchEnd)} onChange={event => onChange({ ...draft, lunchEnd: minute(event.target.value) })}/>
        </label>
      </div>}
    </div>
  </div>;
}

export default function ScheduleConfigurationPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [shop, setShop] = useState<ScheduleDraft>(defaultWeek);
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [memberId, setMemberId] = useState("");
  const [staff, setStaff] = useState<ScheduleDraft>(defaultWeek);
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
    ]).then(([hours, people, catalog]) => { if (active) { setShop(fromWindows(hours)); setMembers(people); setServices(catalog.filter(item => item.isActive)); } })
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
    ]).then(([hours, enabled, absences]) => { if (active) { setStaff(fromWindows(hours)); setAssigned(enabled.map(item => item.service.id)); setTimeOff(absences); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Erro ao carregar profissional"); });
    return () => { active = false; };
  }, [memberId, tenantId]);

  async function saveWindows(scope: "shop" | "staff") {
    setError(""); setMessage("");
    const draft = scope === "shop" ? shop : staff;
    if (draft.kind === "weekly" && draft.lunchEnabled && draft.lunchEnd <= draft.lunchStart) {
      setError("O término do almoço deve ser posterior ao início."); return;
    }
    if (draft.kind === "weekly" && draft.days.some(day => day.endMinute <= day.startMinute ||
      (draft.lunchEnabled && day.startMinute >= draft.lunchStart && day.endMinute <= draft.lunchEnd))) {
      setError("Confira os horários de abertura e fechamento de cada dia."); return;
    }
    const path = scope === "shop" ? "hours" : `professionals/${memberId}/hours`;
    try {
      await apiJson(`/tenants/${tenantId}/agenda/${path}`, mutation("PUT", { windows: toWindows(draft) }));
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
      <Panel title="Expediente da barbearia" description="Defina a abertura e o fechamento de cada dia e configure uma pausa de almoço para a semana.">
        <WindowsEditor draft={shop} onChange={setShop} description="Segunda a sexta já estão incluídas. Remova dias sem expediente ou adicione sábado e domingo."/><button type="button" className={primaryButton + " mt-5"} onClick={() => void saveWindows("shop")}><Save size={16}/>Salvar expediente</button>
      </Panel>
      <Panel title="Configuração por profissional" description="A jornada precisa estar dentro do expediente geral.">
        <select aria-label="Profissional" className={fieldClass} value={memberId} onChange={event => setMemberId(event.target.value)}><option value="">Selecione um profissional</option>{members.map(member => <option key={member.id} value={member.id}>{member.user.name}</option>)}</select>
        {memberId && <div className="mt-6 space-y-7">
          <div><h3 className="mb-3 text-sm font-bold">Jornada semanal</h3><WindowsEditor draft={staff} onChange={setStaff} description="Configure a jornada deste profissional. Os horários precisam estar dentro do expediente da barbearia."/><button type="button" className={primaryButton + " mt-4"} onClick={() => void saveWindows("staff")}><Save size={16}/>Salvar jornada</button></div>
          <div><h3 className="mb-3 text-sm font-bold">Serviços habilitados</h3><div className="grid gap-2 sm:grid-cols-2">{services.map(service => <label key={service.id} className="flex items-center gap-3 rounded-xl border border-[#e5e7e1] p-3 text-sm"><input type="checkbox" checked={assigned.includes(service.id)} onChange={event => setAssigned(current => event.target.checked ? [...current, service.id] : current.filter(id => id !== service.id))}/>{service.name}</label>)}</div><button type="button" className={primaryButton + " mt-4"} onClick={() => void saveServices()}><Save size={16}/>Salvar serviços</button></div>
          <div><h3 className="mb-3 text-sm font-bold">Folgas e bloqueios</h3><form className="grid gap-3 md:grid-cols-4" onSubmit={addTimeOff}><input className={fieldClass} aria-label="Início da folga" name="startsAt" type="datetime-local" required/><input className={fieldClass} aria-label="Fim da folga" name="endsAt" type="datetime-local" required/><input className={fieldClass} aria-label="Motivo" name="reason" placeholder="Motivo (opcional)"/><button className={primaryButton}><CalendarOff size={16}/>Registrar</button></form><div className="mt-3 space-y-2">{timeOff.map(item => <p key={item.id} className="rounded-xl bg-[#f5f6f2] p-3 text-xs">{new Date(item.startsAt).toLocaleString("pt-BR")} — {new Date(item.endsAt).toLocaleString("pt-BR")} {item.reason ? `· ${item.reason}` : ""}</p>)}</div></div>
        </div>}
      </Panel>
    </div>
  </>;
}
