"use client";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { apiJson, mutation } from "../../../lib/api";
import { EmptyState, fieldClass, PageHeader, Panel, primaryButton, secondaryButton, shortDate, StatusPill } from "../../../components/dashboard/ui";

type Tenant = { id: string; name: string; slug: string; status: "ACTIVE" | "SUSPENDED";
  billingDueDay: number; createdAt: string; owner: { name: string; email: string };
  _count: { appointments: number; services: number; memberships: number } };

const emptyForm = {
  name: "", slug: "", billingDueDay: 10, ownerName: "", ownerUsername: "",
  ownerEmail: "", ownerWhatsapp: "", ownerPassword: "",
};
type TenantForm = typeof emptyForm;
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
const sanitizeSlugInput = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+/, "").slice(0, 50);

const usernamePattern = /^[a-z0-9]{3,30}$/;
const phoneDigits = (value: string) => value.replace(/\D/g, "").slice(0, 11);
function formatWhatsapp(value: string) {
  const digits = phoneDigits(value);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function SystemTenants() {
  const [items, setItems] = useState<Tenant[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [form, setForm] = useState<TenantForm>(emptyForm);
  const usernameInvalid = form.ownerUsername.length > 0 && !usernamePattern.test(form.ownerUsername);
  const whatsappInvalid = form.ownerWhatsapp.length > 0 && phoneDigits(form.ownerWhatsapp).length !== 11;
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
  function update<K extends keyof TenantForm>(field: K, value: TenantForm[K]) {
    setForm(current => ({ ...current, [field]: value }));
  }
  function closeCreate() {
    if (creating) return;
    setCreateOpen(false); setCreateError("");
  }
  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    if (!usernamePattern.test(form.ownerUsername)) {
      setCreateError("O nome de usuário deve ter entre 3 e 30 caracteres, apenas letras minúsculas e números.");
      return;
    }
    if (phoneDigits(form.ownerWhatsapp).length !== 11) {
      setCreateError("Informe um WhatsApp válido com DDD e 9 dígitos, por exemplo (32) 99999-9999.");
      return;
    }
    setCreating(true); setCreateError(""); setNotice("");
    try {
      const payload = { ...form, ownerWhatsapp: phoneDigits(form.ownerWhatsapp) };
      const created = await apiJson<Tenant>("/system/tenants", mutation("POST", payload));
      setItems(current => [created, ...current]);
      setForm(emptyForm); setSlugEdited(false); setCreateOpen(false);
      setNotice(`Barbearia “${created.name}” criada. O proprietário já pode entrar pelo acesso administrativo.`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Não foi possível criar a barbearia.");
    } finally { setCreating(false); }
  }
  return <>
    <PageHeader kicker="Plataforma / Estabelecimentos" title="Barbearias"
      description="Visualize os parceiros cadastrados e controle o acesso de cada estabelecimento."
      action={<button type="button" className={primaryButton} onClick={() => setCreateOpen(true)}><Plus size={17}/> Nova barbearia</button>}/>
    {notice && <p role="status" className="mb-5 rounded-xl border border-[#dce5d9] bg-[#f1f6ef] p-3 text-sm text-[#4c684c]">{notice}</p>}
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
        description="Altere os filtros ou cadastre uma nova barbearia manualmente."/> :
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
    <p className="mt-5 text-xs text-[#989c94]">A suspensão pode ser manual ou automática por mensalidade vencida. Pagamentos são confirmados pelo SYSTEM na página Mensalidades.</p>
    {createOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Fechar cadastro" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={closeCreate}/>
      <section role="dialog" aria-modal="true" aria-labelledby="new-tenant-title"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-[#e4e6df] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#eceee8] bg-white px-6 py-5 sm:px-8">
          <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#91968d]">Cadastro manual</p>
            <h2 id="new-tenant-title" className="mt-2 text-2xl font-bold tracking-[-.04em]">Nova barbearia</h2>
            <p className="mt-1 text-xs text-[#858a81]">Crie o estabelecimento e o primeiro acesso administrativo.</p></div>
          <button type="button" aria-label="Fechar" onClick={closeCreate} className="rounded-xl p-2 text-[#777c73] hover:bg-[#f1f2ee]"><X size={20}/></button>
        </div>
        <form onSubmit={createTenant} className="space-y-7 p-6 sm:p-8">
          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="col-span-full mb-1 text-sm font-bold">Dados do estabelecimento</legend>
            <label className="block text-xs font-semibold text-[#545a51]">Nome da barbearia
              <input required minLength={2} maxLength={100} className={fieldClass + " mt-2"} value={form.name}
                onChange={event => {
                  const name = event.target.value;
                  setForm(current => ({ ...current, name, ...(!slugEdited && { slug: slugify(name) }) }));
                }} placeholder="Ex.: Barbearia Central"/>
            </label>
            <label className="block text-xs font-semibold text-[#545a51]">Endereço público
              <div className="mt-2 flex items-center rounded-xl border border-[#e1e3dd] bg-white pl-4 focus-within:border-[#111] focus-within:ring-2 focus-within:ring-black/5">
                <span className="text-sm text-[#9a9e96]">/b/</span><input required minLength={3} maxLength={50} pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm outline-none" value={form.slug}
                  onChange={event => { setSlugEdited(true); update("slug", sanitizeSlugInput(event.target.value)); }}
                  onBlur={() => update("slug", slugify(form.slug))} placeholder="barbearia-central"/>
              </div>
            </label>
            <label className="block text-xs font-semibold text-[#545a51]">Dia mensal de vencimento
              <input required type="number" min={1} max={31} className={fieldClass + " mt-2"} value={form.billingDueDay}
                onChange={event => update("billingDueDay", Number(event.target.value))}/>
            </label>
          </fieldset>
          <fieldset className="grid gap-5 border-t border-[#eceee8] pt-7 sm:grid-cols-2">
            <legend className="col-span-full mb-1 text-sm font-bold">Proprietário e acesso inicial</legend>
            <label className="block text-xs font-semibold text-[#545a51]">Nome completo
              <input required minLength={2} maxLength={100} autoComplete="name" className={fieldClass + " mt-2"} value={form.ownerName}
                onChange={event => update("ownerName", event.target.value)} placeholder="Nome do proprietário"/>
            </label>
            <label className="block text-xs font-semibold text-[#545a51]">Usuário
              <input required minLength={3} maxLength={30} pattern="[a-z0-9]{3,30}"
                title="Use de 3 a 30 caracteres: apenas letras minúsculas e números, sem espaços, acentos ou símbolos."
                autoCapitalize="none" spellCheck={false} autoComplete="username"
                aria-invalid={usernameInvalid} aria-describedby="owner-username-help"
                className={fieldClass + " mt-2" + (usernameInvalid ? " border-red-400 focus:border-red-500" : "")}
                value={form.ownerUsername}
                onChange={event => update("ownerUsername", event.target.value.toLowerCase())}
                placeholder="usuarioadmin"/>
              <span id="owner-username-help" className={`mt-1.5 block text-[11px] leading-4 ${usernameInvalid ? "text-red-600" : "text-[#92988e]"}`}>
                {usernameInvalid ? "Usuário inválido. Use somente letras de a a z e números, entre 3 e 30 caracteres." :
                  "De 3 a 30 caracteres, somente letras minúsculas e números. Sem espaços ou acentos."}
              </span>
            </label>
            <label className="block text-xs font-semibold text-[#545a51]">E-mail
              <input required type="email" autoComplete="email" className={fieldClass + " mt-2"} value={form.ownerEmail}
                onChange={event => update("ownerEmail", event.target.value)} placeholder="proprietario@exemplo.com"/>
            </label>
            <label className="block text-xs font-semibold text-[#545a51]">WhatsApp
              <input required type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={15}
                aria-invalid={whatsappInvalid} aria-describedby="owner-whatsapp-help"
                className={fieldClass + " mt-2" + (whatsappInvalid ? " border-red-400 focus:border-red-500" : "")}
                value={form.ownerWhatsapp}
                onChange={event => update("ownerWhatsapp", formatWhatsapp(event.target.value))}
                placeholder="(32) 99999-9999"/>
              <span id="owner-whatsapp-help" className={`mt-1.5 block text-[11px] leading-4 ${whatsappInvalid ? "text-red-600" : "text-[#92988e]"}`}>
                {whatsappInvalid ? "Informe 11 dígitos: DDD + celular com 9 dígitos." :
                  "Formato (DD) 99999-9999. Somente números serão enviados."}
              </span>
            </label>
            <label className="block text-xs font-semibold text-[#545a51] sm:col-span-2">Senha inicial
              <input required type="password" minLength={10} maxLength={128} autoComplete="new-password" className={fieldClass + " mt-2"} value={form.ownerPassword}
                onChange={event => update("ownerPassword", event.target.value)} placeholder="Mínimo de 10 caracteres"/>
            </label>
          </fieldset>
          {createError && <p role="alert" className="rounded-xl bg-[#f9eeee] p-3 text-sm text-[#9f4a45]">{createError}</p>}
          <div className="flex flex-col-reverse gap-3 border-t border-[#eceee8] pt-6 sm:flex-row sm:justify-end">
            <button type="button" className={secondaryButton} onClick={closeCreate} disabled={creating}>Cancelar</button>
            <button type="submit" className={primaryButton} disabled={creating}><Plus size={17}/>{creating ? "Criando..." : "Criar barbearia"}</button>
          </div>
        </form>
      </section>
    </div> : null}
  </>;
}
