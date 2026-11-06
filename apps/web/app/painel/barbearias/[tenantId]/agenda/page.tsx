"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarDays, Check, Search, RefreshCw } from "lucide-react";
import { apiJson } from "../../../../../lib/api";
import { dateTime, EmptyState, PageHeader, Panel, secondaryButton, StatusPill } from "../../../../../components/dashboard/ui";

type Appointment = { id: string; startsAt: string; endsAt: string; status: string; priceCents: number;
  service: { name: string }; client: { name: string } };
export default function AgendaPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [items, setItems] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => apiJson<Appointment[]>(`/tenants/${tenantId}/appointments`).then(setItems);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [tenantId]);
  const shown = useMemo(() => items.filter(item =>
    (filter === "ALL" || filter === item.status) &&
    [item.client.name, item.service.name].some(value => value.toLowerCase().includes(query.toLowerCase()))),
    [items, filter, query]);
  async function confirm(id: string) {
    setBusy(id); setError("");
    try {
      await apiJson(`/tenants/${tenantId}/appointments/${id}/confirm`, { method: "PATCH" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível confirmar"); }
    finally { setBusy(null); }
  }
  return <>
    <PageHeader kicker="Operação / Agendamentos" title="Agenda"
      description="Acompanhe as reservas e confirme os agendamentos recebidos." 
      action={<button onClick={() => void load().catch(e => setError(e.message))}
        className={secondaryButton}><RefreshCw size={16}/> Atualizar</button>}/>
    <Panel title="Todos os agendamentos" description={`${shown.length} agendamento(s)`}
      right={<div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-[#e5e7e1] bg-[#fafbf8] px-3">
          <Search size={15} className="text-[#91958e]"/>
          <input aria-label="Buscar agenda" placeholder="Cliente ou serviço..." value={query}
            onChange={e => setQuery(e.target.value)} className="w-36 bg-transparent py-2.5 text-xs outline-none sm:w-44"/>
        </label>
        <select aria-label="Filtrar status" value={filter} onChange={e => setFilter(e.target.value)}
          className="rounded-xl border border-[#e5e7e1] bg-[#fafbf8] px-3 text-xs">
          <option value="ALL">Todos</option>
          <option value="PENDING">Pendentes</option><option value="CONFIRMED">Confirmados</option>
          <option value="COMPLETED">Concluídos</option><option value="CANCELLED">Cancelados</option>
        </select>
      </div>}>
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      {shown.length === 0 ? <EmptyState icon={CalendarDays} title="Nenhum agendamento"
        description="As reservas desta barbearia serão exibidas aqui."/> :
      <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left">
        <thead className="text-[11px] uppercase tracking-[.1em] text-[#92978f]"><tr className="border-b border-[#eff0eb]">
          <th className="pb-4 font-semibold">Cliente</th><th className="pb-4 font-semibold">Serviço</th>
          <th className="pb-4 font-semibold">Data / Horário</th><th className="pb-4 font-semibold">Status</th>
          <th className="pb-4 text-right font-semibold">Ação</th>
        </tr></thead><tbody>{shown.map(item =>
          <tr key={item.id} className="border-b border-[#f0f1ed] last:border-0">
            <td className="py-4 text-sm font-semibold">{item.client.name}</td>
            <td className="py-4 text-xs text-[#737970]">{item.service.name}</td>
            <td className="py-4 text-xs font-medium">{dateTime(item.startsAt)}</td>
            <td className="py-4"><StatusPill status={item.status}/></td>
            <td className="py-4 text-right">{item.status === "PENDING" &&
              <button disabled={busy === item.id} onClick={() => void confirm(item.id)}
                className={secondaryButton}><Check size={15}/>{busy === item.id ? "Salvando" : "Confirmar"}</button>}</td>
          </tr>)}</tbody>
      </table></div>}
    </Panel>
  </>;
}
