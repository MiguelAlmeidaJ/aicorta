"use client";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CirclePlus, Pencil, Scissors, Search, X } from "lucide-react";
import { apiJson, mutation } from "../../../../../lib/api";
import { EmptyState, fieldClass, money, PageHeader, Panel, primaryButton, secondaryButton, StatusPill } from "../../../../../components/dashboard/ui";

type Service = { id: string; name: string; description: string | null; durationMinutes: number; priceCents: number; isActive: boolean };
type FormState = { name: string; description: string; durationMinutes: number; price: string };
const empty: FormState = { name: "", description: "", durationMinutes: 30, price: "" };
const fromService = (s: Service): FormState => ({
  name: s.name, description: s.description ?? "", durationMinutes: s.durationMinutes,
  price: (s.priceCents / 100).toFixed(2).replace(".", ","),
});

export default function ServicesPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [items, setItems] = useState<Service[]>([]);
  const [form, setForm] = useState<FormState>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const load = () => apiJson<Service[]>(`/tenants/${tenantId}/services/manage`).then(setItems);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [tenantId]);
  const open = (service?: Service) => { setEditing(service?.id ?? null); setForm(service ? fromService(service) : empty); setShowForm(true); setError(""); };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(""); setMessage("");
    const rawPrice = form.price.trim().replace(",", ".");
    const priceCents = Math.round(Number(rawPrice) * 100);
    if (!rawPrice || !Number.isFinite(priceCents) || priceCents < 0 || priceCents > 100000000) {
      setError("Informe um preço válido."); setSaving(false); return;
    }
    try {
      await apiJson(`/tenants/${tenantId}/services${editing ? "/" + editing : ""}`,
        mutation(editing ? "PATCH" : "POST", { name: form.name, description: form.description,
          durationMinutes: form.durationMinutes, priceCents }));
      setShowForm(false); setMessage(editing ? "Serviço atualizado." : "Serviço cadastrado."); await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  }
  async function toggle(service: Service) {
    setError("");
    try {
      await apiJson(`/tenants/${tenantId}/services/${service.id}`, mutation("PATCH", { isActive: !service.isActive }));
      setMessage(service.isActive ? "Serviço desativado." : "Serviço ativado.");
      await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Falha ao alterar serviço"); }
  }
  const shown = items.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeader kicker="Gestão / Catálogo" title="Serviços"
      description="Organize seu catálogo de serviços, preços e duração de cada atendimento."
      action={<button type="button" onClick={() => open()} className={primaryButton}><CirclePlus size={17}/> Novo serviço</button>}/>
    {message && <p role="status" className="mb-4 rounded-xl bg-[#eaf0e9] px-4 py-3 text-sm text-[#426049]">{message}</p>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-[#faeeee] px-4 py-3 text-sm text-[#9f4942]">{error}</p>}
    {showForm && <div className="mb-6 rounded-[22px] border border-[#e4e6e0] bg-white p-6">
      <div className="flex items-center justify-between"><h2 className="font-bold">{editing ? "Editar serviço" : "Novo serviço"}</h2>
        <button type="button" onClick={() => setShowForm(false)} aria-label="Fechar" className="rounded-lg p-2 hover:bg-[#f1f2ee]"><X size={18}/></button></div>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Nome do serviço<input className={fieldClass + " mt-2"} required minLength={2}
          maxLength={100} value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}/></label>
        <label className="text-xs font-semibold">Preço (R$)<input className={fieldClass + " mt-2"} required
          inputMode="decimal" placeholder="45,00" value={form.price} onChange={e => setForm(v => ({ ...v, price: e.target.value }))}/></label>
        <label className="text-xs font-semibold">Duração (minutos)<input className={fieldClass + " mt-2"} required
          type="number" min={5} max={480} value={form.durationMinutes} onChange={e => setForm(v => ({ ...v, durationMinutes: Number(e.target.value) }))}/></label>
        <label className="text-xs font-semibold">Descrição<input className={fieldClass + " mt-2"}
          maxLength={500} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))}/></label>
        <div className="sm:col-span-2"><button type="submit" disabled={saving} className={primaryButton}>
          {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar serviço"}</button></div>
      </form>
    </div>}
    <Panel title="Catálogo da barbearia" description={`${items.length} serviços cadastrados`}
      right={<label className="flex items-center gap-2 rounded-xl border border-[#e8e9e4] px-3">
        <Search size={15} className="text-[#999d95]"/><input aria-label="Filtrar serviços" placeholder="Buscar serviço..."
          className="w-36 bg-transparent py-2.5 text-xs outline-none" value={query} onChange={e => setQuery(e.target.value)}/>
      </label>}>
      {shown.length === 0 ? <EmptyState icon={Scissors} title="Nenhum serviço encontrado"
        description="Cadastre o primeiro serviço da sua barbearia para montar o catálogo."/> :
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{shown.map(item =>
        <article key={item.id} className="rounded-2xl border border-[#e8eae4] bg-[#fafbf9] p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-xl bg-[#e9eae6] p-3"><Scissors size={18}/></span>
            <StatusPill status={item.isActive ? "ACTIVE" : "SUSPENDED"}/>
          </div>
          <h3 className="mt-5 text-base font-bold tracking-tight">{item.name}</h3>
          <p className="mt-1 min-h-9 text-xs leading-5 text-[#8b9187]">{item.description || "Serviço da barbearia"}</p>
          <div className="mt-4 flex items-center justify-between border-t border-[#e8eae4] pt-4">
            <div><p className="text-lg font-bold tracking-tight">{money(item.priceCents)}</p>
              <p className="text-xs text-[#8d9389]">{item.durationMinutes} minutos</p></div>
            <div className="flex gap-2">
              <button type="button" aria-label={"Editar " + item.name} onClick={() => open(item)} className="rounded-lg border border-[#e4e6df] bg-white p-2.5 hover:bg-[#f0f2ed]"><Pencil size={15}/></button>
              <button type="button" onClick={() => void toggle(item)} className={secondaryButton}>
                {item.isActive ? "Desativar" : "Ativar"}</button>
            </div>
          </div>
        </article>)}</div>}
    </Panel>
  </>;
}
