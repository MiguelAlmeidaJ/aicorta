"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, Search, SlidersHorizontal } from "lucide-react";
import { apiJson, mutation } from "../../../lib/api";
import { EmptyState, PageHeader, Panel, secondaryButton, shortDate, StatusPill } from "../../../components/dashboard/ui";

type Tenant = { id: string; name: string; slug: string; status: "ACTIVE" | "SUSPENDED";
  billingDueDay: number; createdAt: string; owner: { name: string; email: string };
  _count: { appointments: number; services: number; memberships: number } };

export default function SystemTenants() {
  const [items, setItems] = useState<Tenant[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = () => apiJson<Tenant[]>("/system/tenants").then(setItems);
  useEffect(() => { void load().catch(e => setError(e.message)); }, []);
  const shown = useMemo(() => items.filter(item =>
    (filter === "ALL" || item.status === filter) &&
    [item.name, item.owner.name, item.owner.email, item.slug].some(value => value.toLowerCase().includes(query.toLowerCase().trim()))),
    [items, query, filter]);
  async function toggle(item: Tenant) {
    const next = item.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (!window.confirm(next === "SUSPENDED" ?
      `Suspender o acesso de "${item.name}" à plataforma?` :
      `Reativar o acesso de "${item.name}"?`)) return;
    setBusy(item.id); setError("");
    try {
      await apiJson(`/system/tenants/${item.id}/status`, mutation("PATCH", { status: next }));
      await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Falha ao atualizar"); }
    finally { setBusy(null); }
  }
  return <>
    <PageHeader kicker="Plataforma / Estabelecimentos" title="Barbearias"
      description="Visualize os parceiros cadastrados e controle o acesso de cada estabelecimento."/>
    <Panel title="Estabelecimentos" description={`${shown.length} resultado(s) exibido(s)`}
      right={<div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-[#e6e8e2] bg-[#fafbf8] px-3">
          <Search size={16} className="text-[#8e938a]"/>
          <input aria-label="Buscar barbearias" className="w-36 bg-transparent py-2.5 text-xs outline-none sm:w-48"
            placeholder="Buscar barbearia..." value={query} onChange={e => setQuery(e.target.value)}/>
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-[#e6e8e2] bg-[#fafbf8] px-3">
          <SlidersHorizontal size={15} className="text-[#8e938a]"/>
          <select aria-label="Filtrar status" className="bg-transparent py-2.5 text-xs outline-none"
            value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">Todos</option><option value="ACTIVE">Ativas</option><option value="SUSPENDED">Suspensas</option>
          </select>
        </label>
      </div>}>
      {error && <p role="alert" className="mb-5 rounded-xl bg-[#f9eeee] p-3 text-sm text-[#9f4a45]">{error}</p>}
      {shown.length === 0 ? <EmptyState icon={Building2} title="Nenhuma barbearia encontrada"
        description="Altere o filtro ou crie um convite para cadastrar uma nova barbearia."/> :
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left">
          <thead><tr className="border-b border-[#eff0eb] text-[11px] uppercase tracking-wider text-[#989c94]">
            <th className="pb-4 font-semibold">Barbearia</th><th className="pb-4 font-semibold">Responsável</th>
            <th className="pb-4 font-semibold">Vencimento</th><th className="pb-4 font-semibold">Cadastro</th>
            <th className="pb-4 font-semibold">Status</th><th className="pb-4 text-right font-semibold">Ação</th>
          </tr></thead>
          <tbody>{shown.map(item => <tr key={item.id} className="border-b border-[#f1f2ee] last:border-0">
            <td className="py-4"><p className="text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-[#989c94]">/{item.slug} · {item._count.memberships} vínculos</p></td>
            <td className="py-4"><p className="text-xs font-semibold">{item.owner.name}</p><p className="mt-1 text-xs text-[#959a92]">{item.owner.email}</p></td>
            <td className="py-4 text-xs text-[#656a62]">Dia {item.billingDueDay}</td>
            <td className="py-4 text-xs text-[#656a62]">{shortDate(item.createdAt)}</td>
            <td className="py-4"><StatusPill status={item.status}/></td>
            <td className="py-4 text-right"><button type="button" disabled={busy === item.id}
              className={secondaryButton} onClick={() => void toggle(item)}>
                {busy === item.id ? "Salvando..." : item.status === "ACTIVE" ? "Suspender" : "Reativar"}
              </button></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </Panel>
    <p className="mt-5 text-xs text-[#989c94]">O dia de vencimento é um dado para o financeiro. A suspensão de acesso é manual nesta versão.</p>
  </>;
}
