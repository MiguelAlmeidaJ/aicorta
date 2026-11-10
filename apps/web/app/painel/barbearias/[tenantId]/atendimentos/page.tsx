"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3, Play, RefreshCw, UserCheck } from "lucide-react";
import { apiJson } from "../../../../../lib/api";
import { EmptyState, money, PageHeader, Panel, secondaryButton, StatusPill } from "../../../../../components/dashboard/ui";

type Appointment = {
  id: string; startsAt: string; status: string; priceCents: number;
  client: { name: string }; employee: { user: { name: string } }; service: { name: string };
};
type ServiceOrder = {
  id: string; appointmentId: string; status: string; checkedInAt: string;
  subtotalCents: number; discountCents: number; totalCents: number;
  client: { name: string }; employee: { user: { name: string } };
  appointment: { startsAt: string }; items: { id: string }[];
};

const statusLabel: Record<string, string> = {
  CHECKED_IN: "Check-in", IN_PROGRESS: "Em atendimento", CLOSED: "Encerrada", CANCELLED: "Cancelada",
};
function localTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function ServiceOrdersPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [reload, setReload] = useState(1);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const loading = loaded !== reload;

  useEffect(() => {
    let active = true;
    const from = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const to = new Date(Date.now() + 48 * 60 * 60_000).toISOString();
    Promise.all([
      apiJson<ServiceOrder[]>(`/tenants/${tenantId}/service-orders?take=100`),
      apiJson<Appointment[]>(`/tenants/${tenantId}/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&take=300`),
    ]).then(([nextOrders, nextAppointments]) => {
      if (!active) return;
      setOrders(nextOrders);
      setAppointments(nextAppointments);
      setLoadedAt(Date.now());
      setError("");
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Nao foi possivel carregar os atendimentos.");
    }).finally(() => { if (active) setLoaded(reload); });
    return () => { active = false; };
  }, [tenantId, reload]);

  const activeOrders = useMemo(() => orders.filter(order =>
    ["CHECKED_IN", "IN_PROGRESS"].includes(order.status)), [orders]);
  const completedOrders = useMemo(() => orders.filter(order =>
    ["CLOSED", "CANCELLED"].includes(order.status)), [orders]);
  const orderedAppointments = useMemo(() => new Set(orders.map(order => order.appointmentId)), [orders]);
  const waiting = useMemo(() => appointments.filter(item =>
    item.status === "CONFIRMED" && !orderedAppointments.has(item.id)), [appointments, orderedAppointments]);

  async function checkIn(appointmentId: string) {
    setBusy(appointmentId); setError("");
    try {
      const order = await apiJson<ServiceOrder>(`/tenants/${tenantId}/appointments/${appointmentId}/check-in`, { method: "POST" });
      router.push(`/painel/barbearias/${tenantId}/atendimentos/${order.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nao foi possivel realizar o check-in.");
    } finally { setBusy(""); }
  }

  async function start(orderId: string) {
    setBusy(orderId); setError("");
    try {
      await apiJson(`/tenants/${tenantId}/service-orders/${orderId}/start`, { method: "PATCH" });
      setReload(value => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nao foi possivel iniciar o atendimento.");
    } finally { setBusy(""); }
  }

  const summary = [
    { label: "Aguardando check-in", value: waiting.length },
    { label: "Com check-in", value: orders.filter(order => order.status === "CHECKED_IN").length },
    { label: "Em atendimento", value: orders.filter(order => order.status === "IN_PROGRESS").length },
    { label: "Encerradas", value: orders.filter(order => order.status === "CLOSED").length },
  ];

  return <>
    <PageHeader kicker="Operacao / Atendimentos" title="Atendimentos e comandas"
      description="Faca o check-in, acompanhe servicos em andamento e encerre cada comanda com valores auditaveis."
      action={<button type="button" onClick={() => setReload(value => value + 1)} className={secondaryButton}>
        <RefreshCw size={16}/> Atualizar
      </button>}/>
    {error ? <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {summary.map(item => <article key={item.label} className="rounded-[22px] border border-[#e9eae5] bg-white p-5">
        <p className="text-xs text-[#81867d]">{item.label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums">{loading ? "—" : item.value}</p>
      </article>)}
    </div>

    <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
      <Panel title="Aguardando check-in" description="Reservas confirmadas nas proximas 48 horas."
        right={<UserCheck size={20} className="text-[#888d84]"/>}>
        {loading ? <p className="py-8 text-center text-sm text-[#92978e]">Carregando reservas...</p> : waiting.length ?
          <div className="space-y-3">{waiting.map(item => {
            const available = new Date(item.startsAt).getTime() <= loadedAt + 30 * 60_000;
            return <article key={item.id} className="rounded-xl border border-[#e6e8e1] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-bold">{item.client.name}</p><p className="mt-1 text-xs text-[#7f847b]">{item.service.name} · {item.employee.user.name}</p></div>
                <span className="text-xs font-semibold">{money(item.priceCents)}</span>
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-[#696e66]"><Clock3 size={14}/>{localTime(item.startsAt)}</p>
              <button type="button" disabled={!available || busy === item.id} onClick={() => void checkIn(item.id)}
                title={available ? "Realizar check-in" : "Disponivel 30 minutos antes"}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#171916] px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                <UserCheck size={15}/>{busy === item.id ? "Registrando..." : available ? "Fazer check-in" : "Check-in ainda indisponivel"}
              </button>
            </article>;
          })}</div> : <EmptyState icon={UserCheck} title="Nenhuma reserva aguardando" description="As reservas confirmadas aparecerao aqui no dia do atendimento."/>}
      </Panel>

      <Panel title="Operacao em andamento" description="Comandas abertas por ordem de check-in."
        right={<Play size={20} className="text-[#888d84]"/>}>
        {loading ? <p className="py-8 text-center text-sm text-[#92978e]">Carregando comandas...</p> : activeOrders.length ?
          <div className="space-y-3">{activeOrders.map(order => <article key={order.id} className="rounded-xl border border-[#e4e6df] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="flex items-center gap-2"><p className="font-bold">{order.client.name}</p><StatusPill status={statusLabel[order.status] ?? order.status}/></div>
                <p className="mt-1 text-xs text-[#858a81]">{order.employee.user.name} · {order.items.length} item(ns)</p></div>
              <strong>{money(order.totalCents)}</strong>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {order.status === "CHECKED_IN" ? <button type="button" disabled={busy === order.id} onClick={() => void start(order.id)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#171916] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Play size={14}/> Iniciar</button> : null}
              <Link href={`/painel/barbearias/${tenantId}/atendimentos/${order.id}`} className={secondaryButton}>Abrir comanda <ArrowRight size={14}/></Link>
            </div>
          </article>)}</div> : <EmptyState icon={Play} title="Nenhum atendimento em andamento" description="Faca o check-in de uma reserva confirmada para abrir a comanda."/>}
      </Panel>
    </div>

    <div className="mt-6"><Panel title="Historico recente" right={<CheckCircle2 size={18}/> }>
      {completedOrders.length ? <div className="divide-y divide-[#eceee8]">{completedOrders.slice(0, 20).map(order =>
        <Link key={order.id} href={`/painel/barbearias/${tenantId}/atendimentos/${order.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-[#fafbf8]">
          <div><p className="text-sm font-bold">{order.client.name}</p><p className="mt-1 text-xs text-[#898e85]">{localTime(order.checkedInAt)} · {statusLabel[order.status]}</p></div>
          <div className="flex items-center gap-4"><strong className="text-sm">{money(order.totalCents)}</strong><ArrowRight size={15}/></div>
        </Link>)}</div> : <p className="py-5 text-sm text-[#92978e]">Nenhuma comanda encerrada.</p>}
    </Panel></div>
  </>;
}
