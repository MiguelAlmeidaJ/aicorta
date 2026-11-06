"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Search, UsersRound } from "lucide-react";
import { apiJson } from "../../../../../lib/api";
import { EmptyState, PageHeader, Panel, StatusPill } from "../../../../../components/dashboard/ui";

type Client = { id: string; isActive: boolean; createdAt: string;
  user: { id: string; name: string; email: string; username: string; whatsapp: string } };
export default function ClientsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [items, setItems] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiJson<Client[]>(`/tenants/${tenantId}/clients`)
      .then(value => { if (active) setItems(value); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [tenantId]);
  const shown = items.filter(item => [item.user.name, item.user.email, item.user.username]
    .some(value => value.toLowerCase().includes(query.toLowerCase())));
  const phone = (value: string) => value.length === 11 ?
    `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}` : value;
  return <>
    <PageHeader kicker="Gestão / Relacionamento" title="Clientes"
      description="Consulte os clientes vinculados à sua barbearia. Os dados pertencem somente a este estabelecimento."/>
    <Panel title="Base de clientes" description={`${shown.length} cliente(s) encontrado(s)`}
      right={<label className="flex items-center gap-2 rounded-xl border border-[#e8e9e4] px-3">
        <Search size={15} className="text-[#92978e]"/>
        <input aria-label="Buscar clientes" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar cliente..." className="w-36 bg-transparent py-2.5 text-xs outline-none sm:w-48"/>
      </label>}>
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      {shown.length === 0 ? <EmptyState icon={UsersRound} title="Nenhum cliente encontrado"
        description="Assim que clientes se vincularem à barbearia, eles aparecerão aqui."/> :
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left">
        <thead className="text-[11px] uppercase tracking-wider text-[#969b92]">
          <tr className="border-b border-[#eff0eb]"><th className="pb-4 font-semibold">Cliente</th>
            <th className="pb-4 font-semibold">Contato</th><th className="pb-4 font-semibold">WhatsApp</th>
            <th className="pb-4 font-semibold">Status</th></tr>
        </thead>
        <tbody>{shown.map(item => <tr key={item.id} className="border-b border-[#f0f1ed] last:border-0">
          <td className="py-4"><p className="text-sm font-semibold">{item.user.name}</p>
            <p className="mt-1 text-xs text-[#92978f]">@{item.user.username}</p></td>
          <td className="py-4 text-xs text-[#70756c]">{item.user.email}</td>
          <td className="py-4 text-xs text-[#70756c]">{phone(item.user.whatsapp)}</td>
          <td className="py-4"><StatusPill status={item.isActive ? "ACTIVE" : "SUSPENDED"}/></td>
        </tr>)}</tbody>
      </table></div>}
    </Panel>
  </>;
}
