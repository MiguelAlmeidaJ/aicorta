"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, CalendarOff, Check, ChevronRight, Clock3, Coffee, Plus, Save, Scissors, Store, Trash2, UserRound, UsersRound } from "lucide-react";
import { apiJson, mutation } from "../../../../../../lib/api";
import { fieldClass, PageHeader, Panel, primaryButton, secondaryButton } from "../../../../../../components/dashboard/ui";

type WindowRow = { id?: string; weekday: number; startMinute: number; endMinute: number };
type Member = { id: string; isActive: boolean; appearsInAgenda: boolean; user: { name: string } };
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
  if (draft.kind === "custom") {
    const update = (index: number, patch: Partial<WindowRow>) => onChange({
      kind: "custom", windows: draft.windows.map((row, i) => i === index ? { ...row, ...patch } : row),
    });
    return <div className="space-y-4">
      <div className="rounded-xl border border-[#eadfca] bg-[#faf7ef] px-4 py-3 text-xs leading-5 text-[#776b55]">
        Este expediente já utiliza pausas diferentes entre os dias. Mantivemos todos os intervalos originais para não alterar sua escala.
      </div>
      <div className="space-y-2">
        {draft.windows.map((row, index) => <div key={row.id ?? index} className="grid grid-cols-[1fr_1fr_42px] items-end gap-2 rounded-xl border border-[#e8eae5] bg-white p-3 sm:grid-cols-[1.1fr_1fr_1fr_42px] sm:items-center">
          <select aria-label="Dia da semana" className={fieldClass + " col-span-3 sm:col-span-1"} value={row.weekday}
            onChange={event => update(index, { weekday: Number(event.target.value) })}>
            {days.map((day, value) => <option key={day} value={value}>{day}</option>)}
          </select>
          <label className="text-[11px] font-medium text-[#777f74]">Início
            <input aria-label="Início do intervalo" className={fieldClass + " mt-1"} type="time" value={time(row.startMinute)}
              onChange={event => update(index, { startMinute: minute(event.target.value) })}/>
          </label>
          <label className="text-[11px] font-medium text-[#777f74]">Fim
            <input aria-label="Fim do intervalo" className={fieldClass + " mt-1"} type="time" value={time(row.endMinute)}
              onChange={event => update(index, { endMinute: minute(event.target.value) })}/>
          </label>
          <button type="button" aria-label="Excluir intervalo" title="Excluir intervalo"
            className="flex h-11 w-10 items-center justify-center rounded-xl border border-[#e5e8e1] text-[#8a9185] hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            onClick={() => onChange({ kind: "custom", windows: draft.windows.filter((_, i) => i !== index) })}>
            <Trash2 size={16}/>
          </button>
        </div>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={secondaryButton} onClick={() => onChange({
          kind: "custom", windows: [...draft.windows, { weekday: 1, startMinute: 540, endMinute: 1080 }],
        })}><Plus size={15}/> Adicionar intervalo</button>
        <button type="button" className="rounded-xl px-3 py-2 text-xs font-semibold text-[#586055] underline underline-offset-4 hover:bg-[#f5f6f2]"
          onClick={() => { if (window.confirm("Substituir os intervalos atuais pela semana padrão?")) onChange(defaultWeek()); }}>
          Usar semana padrão
        </button>
      </div>
    </div>;
  }

  const updateDay = (weekday: number, patch: Partial<DayRow>) =>
    onChange({ ...draft, days: draft.days.map(day => day.weekday === weekday ? { ...day, ...patch } : day) });
  const orderedDays = [1, 2, 3, 4, 5, 6, 0];
  const activeDays = draft.days.length;
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(270px,.9fr)]">
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e5e8e2] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#e9ebe6] px-4 py-4 sm:px-5">
        <div>
          <h3 className="text-sm font-bold text-[#20251f]">Dias de funcionamento</h3>
          <p className="mt-1 text-xs leading-5 text-[#8b9288]">{description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#f0f2ed] px-3 py-1.5 text-[11px] font-semibold text-[#505a4d]">
          {activeDays} {activeDays === 1 ? "dia ativo" : "dias ativos"}
        </span>
      </div>
      <div className="hidden grid-cols-[minmax(110px,.95fr)_1fr_1fr] gap-3 bg-[#fafbf9] px-5 py-2.5 text-[11px] font-semibold text-[#8a9287] sm:grid">
        <span>Dia / situação</span><span>Abertura</span><span>Fechamento</span>
      </div>
      <div className="divide-y divide-[#eef0eb]">
        {orderedDays.map(weekday => {
          const row = draft.days.find(item => item.weekday === weekday);
          const active = Boolean(row);
          return <div key={weekday} className={`grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(110px,.95fr)_1fr_1fr] sm:items-center sm:px-5 ${active ? "bg-white" : "bg-[#fbfcfa]"}`}>
            <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
              <button type="button" role="switch" aria-checked={active}
                aria-label={`${active ? "Desativar" : "Ativar"} expediente de ${days[weekday]}`}
                onClick={() => onChange({
                  ...draft,
                  days: active ? draft.days.filter(day => day.weekday !== weekday)
                    : [...draft.days, { weekday, startMinute: 540, endMinute: 1080 }]
                      .sort((a, b) => orderedDays.indexOf(a.weekday) - orderedDays.indexOf(b.weekday)),
                })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${active ? "bg-[#1c211b]" : "bg-[#daddd6]"}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${active ? "left-6" : "left-1"}`}/>
              </button>
              <div className="flex-1 sm:flex-initial">
                <span className={`block text-[13px] font-semibold ${active ? "text-[#242923]" : "text-[#a1a79e]"}`}>{days[weekday]}</span>
                <span className="block text-[10px] text-[#9aa196]">{active ? "Aberto" : "Fechado"}</span>
              </div>
            </div>
            {row ? <>
              <label className="block text-[10px] font-medium text-[#82897f] sm:text-transparent">Abertura
                <input aria-label={`Abertura de ${days[weekday]}`} type="time" className={fieldClass + " mt-1 w-full bg-white sm:mt-0"}
                  value={time(row.startMinute)} onChange={event => updateDay(weekday, { startMinute: minute(event.target.value) })}/>
              </label>
              <label className="block text-[10px] font-medium text-[#82897f] sm:text-transparent">Fechamento
                <input aria-label={`Fechamento de ${days[weekday]}`} type="time" className={fieldClass + " mt-1 w-full bg-white sm:mt-0"}
                  value={time(row.endMinute)} onChange={event => updateDay(weekday, { endMinute: minute(event.target.value) })}/>
              </label>
            </> : <span className="col-span-2 flex h-10 items-center text-xs text-[#a1a79d]">Sem atendimento neste dia</span>}
          </div>;
        })}
      </div>
    </section>
    <aside className="space-y-4">
      <div className="rounded-2xl border border-[#e5e8e2] bg-white p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f3ee] text-[#4e594a]"><Coffee size={19}/></span>
          <div className="flex-1"><h3 className="text-sm font-bold text-[#222820]">Pausa para almoço</h3>
            <p className="mt-0.5 text-[11px] text-[#929a8d]">Aplicada à semana inteira</p></div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" className="peer sr-only" checked={draft.lunchEnabled}
              onChange={event => onChange({ ...draft, lunchEnabled: event.target.checked })}/>
            <span className="h-6 w-11 rounded-full bg-[#daddd6] transition-colors peer-checked:bg-[#1c211b] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-black"/>
            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"/>
            <span className="sr-only">Ativar pausa de almoço</span>
          </label>
        </div>
        {draft.lunchEnabled ? <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="min-w-0 text-[11px] font-semibold text-[#5d665a]">Início
            <input aria-label="Início do almoço" type="time" className={fieldClass + " mt-2 w-full"}
              value={time(draft.lunchStart)} onChange={event => onChange({ ...draft, lunchStart: minute(event.target.value) })}/>
          </label>
          <label className="min-w-0 text-[11px] font-semibold text-[#5d665a]">Término
            <input aria-label="Fim do almoço" type="time" className={fieldClass + " mt-2 w-full"}
              value={time(draft.lunchEnd)} onChange={event => onChange({ ...draft, lunchEnd: minute(event.target.value) })}/>
          </label>
          <p className="col-span-2 rounded-xl bg-[#f6f7f3] px-3 py-3 text-[11px] leading-5 text-[#727b6c]">
            <Clock3 size={14} className="mr-1.5 inline-block align-[-2px]"/> Nesse intervalo não serão oferecidos horários para reserva.
          </p>
        </div> : <p className="mt-4 text-xs leading-5 text-[#92998e]">Sem pausa automática configurada.</p>}
      </div>
      <div className="rounded-2xl border border-[#e5e8e2] bg-[#f8f9f6] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#343d31]"><CalendarDays size={17}/> Resumo da semana</div>
        <p className="mt-3 text-[25px] font-bold tracking-tight text-[#1c231b]">{activeDays} <span className="text-[13px] font-medium text-[#818a7d]">dias de expediente</span></p>
        <p className="mt-2 text-xs leading-5 text-[#81897d]">
          Ative ou desative dias pelo controle ao lado de cada nome. Os horários são salvos somente ao clicar em Salvar.
        </p>
      </div>
    </aside>
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
  const [section, setSection] = useState<"shop" | "staff">("shop");
  const [staffTab, setStaffTab] = useState<"hours" | "services" | "timeoff">("hours");
  const [savingScope, setSavingScope] = useState<string | null>(null);
  const [loadingMember, setLoadingMember] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiJson<WindowRow[]>(`/tenants/${tenantId}/agenda/hours`),
      apiJson<Member[]>(`/tenants/${tenantId}/employees`),
      apiJson<Service[]>(`/tenants/${tenantId}/services/manage`),
    ]).then(([hours, people, catalog]) => { if (active) { setShop(fromWindows(hours)); setMembers(people.filter(item => item.isActive && item.appearsInAgenda)); setServices(catalog.filter(item => item.isActive)); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Erro ao carregar configuração"); });
    return () => { active = false; };
  }, [tenantId]);

  useEffect(() => {
    if (!memberId) return;
    let active = true;
    setLoadingMember(true);
    Promise.all([
      apiJson<WindowRow[]>(`/tenants/${tenantId}/agenda/professionals/${memberId}/hours`),
      apiJson<Assigned[]>(`/tenants/${tenantId}/agenda/professionals/${memberId}/services`),
      apiJson<TimeOff[]>(`/tenants/${tenantId}/agenda/professionals/${memberId}/time-off`),
    ]).then(([hours, enabled, absences]) => { if (active) { setStaff(fromWindows(hours)); setAssigned(enabled.map(item => item.service.id)); setTimeOff(absences); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Erro ao carregar profissional"); })
      .finally(() => { if (active) setLoadingMember(false); });
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
    setSavingScope(scope);
    try {
      await apiJson(`/tenants/${tenantId}/agenda/${path}`, mutation("PUT", { windows: toWindows(draft) }));
      setMessage("Horários salvos com sucesso.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar horários"); }
    finally { setSavingScope(null); }
  }

  async function saveServices() {
    setError(""); setMessage(""); setSavingScope("services");
    try {
      await apiJson(`/tenants/${tenantId}/agenda/professionals/${memberId}/services`, mutation("PUT", { serviceIds: assigned }));
      setMessage("Serviços do profissional atualizados.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar serviços"); }
    finally { setSavingScope(null); }
  }

  async function addTimeOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage(""); setSavingScope("timeoff");
    const form = new FormData(event.currentTarget);
    try {
      await apiJson(`/tenants/${tenantId}/agenda/time-off`, mutation("POST", {
        membershipId: memberId, startsAt: new Date(String(form.get("startsAt"))).toISOString(),
        endsAt: new Date(String(form.get("endsAt"))).toISOString(), reason: form.get("reason"),
      }));
      setTimeOff(await apiJson<TimeOff[]>(`/tenants/${tenantId}/agenda/professionals/${memberId}/time-off`));
      event.currentTarget.reset(); setMessage("Folga registrada.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível registrar a folga"); }
    finally { setSavingScope(null); }
  }

  const selectedMember = members.find(member => member.id === memberId);
  const tabButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";
  return <>
    <PageHeader kicker="Agenda / Preparação" title="Configuração da agenda"
      description="Organize os horários do estabelecimento, a equipe e os bloqueios de atendimento."
      action={<Link className={secondaryButton} href={`/painel/barbearias/${tenantId}/agenda`}>Voltar à agenda</Link>}/>
    {message && <p role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-[#dcebdd] bg-[#f0f6ef] px-4 py-3 text-sm text-[#3d6744]"><Check size={16}/>{message}</p>}
    {error && <p role="alert" className="mb-4 rounded-xl border border-[#f1d8d6] bg-[#fff1f0] px-4 py-3 text-sm text-[#a14740]">{error}</p>}

    <nav aria-label="Áreas de configuração da agenda" className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-[#e5e8e1] bg-white p-2 sm:w-fit">
      <button type="button" aria-current={section === "shop" ? "page" : undefined}
        onClick={() => { setSection("shop"); setError(""); setMessage(""); }}
        className={`${tabButton} flex-1 sm:flex-none ${section === "shop" ? "bg-[#1b1f1a] text-white" : "text-[#697166] hover:bg-[#f3f5f0] hover:text-[#262d23]"}`}>
        <Store size={17}/> Barbearia
      </button>
      <button type="button" aria-current={section === "staff" ? "page" : undefined}
        onClick={() => { setSection("staff"); setError(""); setMessage(""); }}
        className={`${tabButton} flex-1 sm:flex-none ${section === "staff" ? "bg-[#1b1f1a] text-white" : "text-[#697166] hover:bg-[#f3f5f0] hover:text-[#262d23]"}`}>
        <UsersRound size={17}/> Profissionais
      </button>
    </nav>

    {section === "shop" ? <Panel title="Expediente da barbearia"
      description="Configure os dias de funcionamento e a pausa de almoço. Tudo em um único lugar.">
      <WindowsEditor draft={shop} onChange={setShop} description="Ative os dias trabalhados e ajuste os horários."/>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#eceee8] pt-5">
        <p className="text-xs text-[#92998f]">Essas alterações afetam os horários disponíveis para agendamento.</p>
        <button type="button" disabled={savingScope !== null} className={primaryButton + " w-full justify-center sm:w-auto"}
          onClick={() => void saveWindows("shop")}><Save size={16}/>
          {savingScope === "shop" ? "Salvando..." : "Salvar expediente"}
        </button>
      </div>
    </Panel> : <Panel title="Jornada dos profissionais"
      description="Defina os horários de cada pessoa, os serviços que atende e suas ausências.">
      {members.length ? <>
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#e6e9e1] bg-[#f9faf7] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e9e0] bg-white text-[#4d594c]"><UserRound size={20}/></span>
            <div>
              <label htmlFor="selected-professional" className="block text-sm font-bold text-[#293027]">Selecionar profissional</label>
              <p className="mt-1 text-[11px] text-[#8a9286]">Configurações individuais de trabalho</p>
            </div>
          </div>
          <select id="selected-professional" className={fieldClass + " w-full bg-white sm:max-w-[310px]"}
            value={memberId} onChange={event => { setMemberId(event.target.value); setError(""); setMessage(""); setStaffTab("hours"); }}>
            <option value="">Escolha uma pessoa</option>
            {members.map(member => <option key={member.id} value={member.id}>{member.user.name}</option>)}
          </select>
        </div>
        {!memberId ? <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dfe4da] bg-[#fbfcfa] px-5 py-10 text-center">
          <UsersRound size={29} className="text-[#929b8d]"/>
          <h3 className="mt-4 text-sm font-bold text-[#333b30]">Escolha um profissional para começar</h3>
          <p className="mt-2 max-w-sm text-xs leading-5 text-[#8d9589]">Você poderá configurar a jornada, vincular serviços e registrar folgas sem misturar as informações de outras pessoas.</p>
        </div> : loadingMember ? <div role="status" className="rounded-xl bg-[#f6f7f3] px-5 py-10 text-center text-sm text-[#858c82]">Carregando horários de {selectedMember?.user.name}...</div> : <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#91998e]">Configurando</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight text-[#252c24]">{selectedMember?.user.name}</h3>
            </div>
            <span className="rounded-full border border-[#dfe8dc] bg-[#f3f7f1] px-3 py-1.5 text-xs font-semibold text-[#5b7156]">Participa da agenda</span>
          </div>
          <div role="tablist" aria-label="Configurações do profissional"
            className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#e5e8e1] bg-[#f7f8f5] p-1.5">
            {([
              { id: "hours" as const, label: "Jornada", icon: Clock3 },
              { id: "services" as const, label: "Serviços", icon: Scissors },
              { id: "timeoff" as const, label: "Folgas e bloqueios", icon: CalendarOff },
            ]).map(tab => <button key={tab.id} type="button" role="tab"
              aria-selected={staffTab === tab.id}
              onClick={() => { setStaffTab(tab.id); setError(""); setMessage(""); }}
              className={`inline-flex min-h-10 flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition ${staffTab === tab.id ? "bg-white text-[#20271f] shadow-sm ring-1 ring-[#e4e7df]" : "text-[#7f877a] hover:text-[#343d31]"}`}>
              <tab.icon size={15}/>{tab.label}
            </button>)}
          </div>
          {staffTab === "hours" ? <div role="tabpanel">
            <WindowsEditor draft={staff} onChange={setStaff}
              description="Defina os dias de atendimento deste profissional."/>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eceee8] pt-5">
              <p className="max-w-lg text-xs leading-5 text-[#858d80]">O atendimento depende também dos horários gerais da barbearia. Configure ambos para liberar os agendamentos.</p>
              <button type="button" disabled={savingScope !== null}
                className={primaryButton + " w-full justify-center sm:w-auto"} onClick={() => void saveWindows("staff")}>
                <Save size={16}/>{savingScope === "staff" ? "Salvando..." : "Salvar jornada"}
              </button>
            </div>
          </div> : null}
          {staffTab === "services" ? <div role="tabpanel" className="rounded-2xl border border-[#e6e9e2] bg-white p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div><h4 className="text-sm font-bold text-[#293027]">Serviços que realiza</h4>
                <p className="mt-1 text-xs text-[#91988e]">Selecione quais serviços podem ser reservados com este profissional.</p></div>
              <span className="rounded-full bg-[#f0f2ed] px-3 py-1.5 text-xs font-semibold text-[#556051]">{assigned.length} selecionados</span>
            </div>
            {services.length ? <div className="grid gap-2 sm:grid-cols-2">
              {services.map(service => { const selected = assigned.includes(service.id); return <label key={service.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm transition ${selected ? "border-[#cbd5c7] bg-[#f5f8f3]" : "border-[#e7e9e4] bg-white hover:border-[#cbd0c6]"}`}>
                <input type="checkbox" className="h-4 w-4 accent-[#1d251b]" checked={selected}
                  onChange={event => setAssigned(current => event.target.checked ? [...current, service.id] : current.filter(id => id !== service.id))}/>
                <span className="flex-1 font-medium">{service.name}</span>
                {selected ? <Check size={16} className="text-[#52684b]"/> : null}
              </label>; })}
            </div> : <p className="rounded-xl bg-[#f7f8f5] p-5 text-xs text-[#889085]">Nenhum serviço ativo. Cadastre serviços antes de vinculá-los.</p>}
            <div className="mt-5 flex justify-end border-t border-[#eef0e9] pt-5">
              <button type="button" disabled={savingScope !== null}
                className={primaryButton + " w-full justify-center sm:w-auto"} onClick={() => void saveServices()}>
                <Save size={16}/>{savingScope === "services" ? "Salvando..." : "Salvar serviços"}
              </button>
            </div>
          </div> : null}
          {staffTab === "timeoff" ? <div role="tabpanel" className="rounded-2xl border border-[#e6e9e2] bg-white p-4 sm:p-6">
            <div className="mb-5"><h4 className="text-sm font-bold text-[#293027]">Registrar indisponibilidade</h4>
              <p className="mt-1 text-xs leading-5 text-[#91988e]">Férias, folgas ou compromissos que devem bloquear novos horários.</p>
            </div>
            <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end"
              onSubmit={addTimeOff}>
              <label className="text-xs font-semibold text-[#586253]">Início
                <input className={fieldClass + " mt-2 w-full"} name="startsAt" type="datetime-local" required/>
              </label>
              <label className="text-xs font-semibold text-[#586253]">Término
                <input className={fieldClass + " mt-2 w-full"} name="endsAt" type="datetime-local" required/>
              </label>
              <label className="text-xs font-semibold text-[#586253] sm:col-span-2 xl:col-span-1">Motivo (opcional)
                <input className={fieldClass + " mt-2 w-full"} name="reason" placeholder="Ex.: férias ou consulta" maxLength={300}/>
              </label>
              <button type="submit" disabled={savingScope !== null}
                className={primaryButton + " min-h-11 w-full justify-center sm:col-span-2 xl:col-span-1"}>
                <Plus size={16}/>{savingScope === "timeoff" ? "Registrando..." : "Registrar folga"}
              </button>
            </form>
            <div className="mt-7 border-t border-[#e9ece6] pt-5">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#737d71]">Bloqueios registrados</h4>
              {timeOff.length ? <div className="space-y-2">
                {timeOff.map(item => <div key={item.id} className="flex items-start gap-3 rounded-xl border border-[#e8ebe5] bg-[#fafbf9] p-4">
                  <CalendarOff size={18} className="mt-0.5 shrink-0 text-[#667262]"/>
                  <div className="min-w-0"><p className="text-xs font-semibold text-[#323b2f]">
                    {new Date(item.startsAt).toLocaleString("pt-BR")} — {new Date(item.endsAt).toLocaleString("pt-BR")}
                  </p>{item.reason && <p className="mt-1 text-xs text-[#858d81]">{item.reason}</p>}</div>
                </div>)}
              </div> : <div className="rounded-xl border border-dashed border-[#e0e5db] bg-[#fafbf9] p-7 text-center text-xs text-[#8d9589]">
                Nenhuma folga cadastrada para este profissional.
              </div>}
            </div>
          </div> : null}
        </>}
      </> : <div className="rounded-xl border border-dashed border-[#e0e5dc] bg-[#fafbf9] px-5 py-8 text-center">
        <UsersRound size={25} className="mx-auto text-[#969e92]"/>
        <p className="mt-3 text-sm font-semibold text-[#4b5548]">Nenhum profissional habilitado</p>
        <p className="mt-1 text-xs text-[#8f988b]">Ative a participação na agenda na página Equipe.</p>
        <Link href={`/painel/barbearias/${tenantId}/equipe`} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4">
          Abrir equipe <ChevronRight size={14}/>
        </Link>
      </div>}
    </Panel>}
  </>;
}
