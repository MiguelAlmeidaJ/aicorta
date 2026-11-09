"use client";

/* eslint-disable @next/next/no-img-element -- imagens autenticadas vêm da API configurável */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CirclePlus, Clock3, Pencil, Scissors, Search, UsersRound } from "lucide-react";
import { API_URL, apiJson, mutation } from "../../../../../lib/api";
import { EmptyState, money, PageHeader, Panel, primaryButton, secondaryButton, StatusPill } from "../../../../../components/dashboard/ui";

type Service = {
  id: string; name: string; description: string | null; durationMinutes: number;
  priceCents: number; isActive: boolean; imageUrl: string | null;
  professionals: Array<{ id: string; user: { name: string } }>;
};

export default function ServicesPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [items, setItems] = useState<Service[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiJson<Service[]>(`/tenants/${tenantId}/services/manage`).then(result => {
      if (active) setItems(result);
    }).catch(loadError => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os serviços.");
    });
    return () => { active = false; };
  }, [tenantId]);

  async function toggle(service: Service) {
    setBusy(service.id); setError(""); setMessage("");
    try {
      await apiJson(`/tenants/${tenantId}/services/${service.id}`, mutation("PATCH", { isActive: !service.isActive }));
      setItems(current => current.map(item => item.id === service.id ? { ...item, isActive: !item.isActive } : item));
      setMessage(service.isActive ? "Serviço desativado." : "Serviço ativado.");
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Falha ao alterar serviço");
    } finally { setBusy(null); }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const shown = normalizedQuery ? items.filter(item =>
    [item.name, item.description ?? "", ...item.professionals.map(member => member.user.name)]
      .some(value => value.toLowerCase().includes(normalizedQuery))) : items;
  const base = `/painel/barbearias/${tenantId}/servicos`;

  return <>
    <PageHeader kicker="Gestão / Catálogo" title="Serviços"
      description="Organize seu catálogo, preços, duração e profissionais habilitados."
      action={<Link href={`${base}/novo`} className={primaryButton}><CirclePlus size={17}/> Novo serviço</Link>}/>
    {message ? <p role="status" className="mb-4 rounded-xl bg-[#eaf0e9] px-4 py-3 text-sm text-[#426049]">{message}</p> : null}
    {error ? <p role="alert" className="mb-4 rounded-xl bg-[#faeeee] px-4 py-3 text-sm text-[#9f4942]">{error}</p> : null}
    <Panel title="Catálogo da barbearia" description={`${items.length} serviço(s) cadastrado(s)`}
      right={<label className="flex items-center gap-2 rounded-xl border border-[#e8e9e4] px-3">
        <Search size={15} className="text-[#999d95]"/><input aria-label="Filtrar serviços" placeholder="Buscar serviço..."
          className="w-36 bg-transparent py-2.5 text-xs outline-none sm:w-52" value={query} onChange={event => setQuery(event.target.value)}/>
      </label>}>
      {shown.length === 0 ? <EmptyState icon={Scissors} title="Nenhum serviço encontrado"
        description="Cadastre o primeiro serviço da sua barbearia para montar o catálogo."/> :
      <div className="divide-y divide-[#eceee8]">{shown.map(service =>
        <article key={service.id} className="grid gap-4 py-5 first:pt-0 last:pb-0 sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-center">
          <div className="relative h-[76px] w-[76px] overflow-hidden rounded-2xl bg-[#eff0ec]">
            {service.imageUrl ? <img src={`${API_URL}${service.imageUrl}`} alt="" className="h-full w-full rounded-2xl object-cover"/> :
              <span className="flex h-full w-full items-center justify-center text-[#777d73]"><Scissors size={21}/></span>}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold">{service.name}</h3>
              <StatusPill status={service.isActive ? "ACTIVE" : "SUSPENDED"}/></div>
            <p className="mt-1 truncate text-xs text-[#8b9187]">{service.description || "Sem descrição"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#696f66]">
              <span className="font-bold text-[#242722]">{money(service.priceCents)}</span>
              <span className="inline-flex items-center gap-1"><Clock3 size={13}/>{service.durationMinutes} min</span>
              <span className="inline-flex min-w-0 items-center gap-1"><UsersRound size={13}/>
                <span className="truncate">{service.professionals.length
                  ? service.professionals.map(member => member.user.name).join(", ") : "Sem profissional"}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:justify-end">
            <Link href={`${base}/${service.id}`} className={secondaryButton} aria-label={`Editar ${service.name}`}><Pencil size={15}/> Editar</Link>
            <button type="button" disabled={busy === service.id} onClick={() => void toggle(service)} className={secondaryButton}>
              {busy === service.id ? "Salvando..." : service.isActive ? "Desativar" : "Ativar"}
            </button>
          </div>
        </article>)}</div>}
    </Panel>
  </>;
}
