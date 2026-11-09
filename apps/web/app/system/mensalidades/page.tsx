"use client";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, History, Play, Search, Settings2 } from "lucide-react";
import { apiJson, mutation } from "../../../lib/api";
import { EmptyState, fieldClass, money, PageHeader, Panel, primaryButton, secondaryButton, StatusPill } from "../../../components/dashboard/ui";

type Fee = { id: string; competence: string; amountCents: number; dueOn: string; overdueAt: string; status: "PENDING" | "PAID";
  paidAt: string | null; confirmedBy: { id: string; name: string } | null };
type Audit = { id: string; action: string; createdAt: string; actor: { id: string; name: string } | null };
type TenantBilling = { id: string; name: string; status: string; suspensionReason: string | null; monthlyFeeCents: number;
  billingDueDay: number; billingStartedAt: string; pendingCount: number; overdueCount: number; monthlyFees: Fee[]; billingAuditEvents: Audit[] };

function dateLabel(value: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
function dueLabel(value: string) { const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; }

export default function MonthlyFeesPage() {
  const [items, setItems] = useState<TenantBilling[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TenantBilling | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = () => apiJson<TenantBilling[]>("/system/billing").then(value => { setItems(value); return value; });
  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : "Falha ao carregar mensalidades")); }, []);
  const shown = useMemo(() => items.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase())), [items, query]);

  async function markPaid(fee: Fee) {
    if (!window.confirm(`Confirmar o pagamento de ${fee.competence} no valor de ${money(fee.amountCents)}?`)) return;
    setBusy(fee.id); setError(""); setNotice("");
    try {
      await apiJson(`/system/billing/${fee.id}/paid`, mutation("PATCH", {}));
      const fresh = await load();
      setSelected(current => fresh.find(item => item.id === current?.id) ?? null);
      setNotice("Pagamento confirmado e situação de acesso recalculada.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao confirmar pagamento"); }
    finally { setBusy(""); }
  }

  async function runVerification() {
    setBusy("run"); setError(""); setNotice("");
    try {
      await apiJson("/system/billing/run", mutation("POST", {}));
      await load(); setNotice("Verificação financeira executada no servidor.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha na verificação"); }
    finally { setBusy(""); }
  }

  return <>
    <PageHeader kicker="Plataforma / Financeiro" title="Mensalidades SaaS"
      description="Registre confirmações administrativas. Nenhuma cobrança, Pix ou operação bancária é processada pelo sistema."
      action={<button className={secondaryButton} type="button" disabled={busy === "run"} onClick={() => void runVerification()}>
        <Play size={16}/>{busy === "run" ? "Verificando..." : "Executar verificação"}</button>}/>
    {error ? <p role="alert" className="mb-5 rounded-xl bg-[#faeeee] p-4 text-sm text-[#9b4741]">{error}</p> : null}
    {notice ? <p role="status" className="mb-5 rounded-xl bg-[#edf6ea] p-4 text-sm text-[#466743]">{notice}</p> : null}
    <Panel title="Estabelecimentos" description="Configuração, pendências e histórico de competências"
      right={<label className="flex items-center gap-2 rounded-xl border border-[#e2e4de] px-3"><Search size={15}/>
        <input aria-label="Buscar estabelecimento" className="w-48 bg-transparent py-2.5 text-xs outline-none" value={query}
          onChange={event => setQuery(event.target.value)} placeholder="Buscar barbearia..."/></label>}>
      {shown.length === 0 ? <EmptyState icon={CircleDollarSign} title="Nenhum estabelecimento encontrado" description="Cadastre ou altere a busca para configurar mensalidades."/> :
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs">
        <thead><tr className="border-b border-[#eceee8] uppercase tracking-wider text-[#92978e]">
          <th className="pb-4">Estabelecimento</th><th className="pb-4">Mensalidade</th><th className="pb-4">Vencimento</th>
          <th className="pb-4">Pendências</th><th className="pb-4">Situação</th><th className="pb-4 text-right">Ações</th>
        </tr></thead>
        <tbody>{shown.map(item => <tr key={item.id} className="border-b border-[#f0f1ed] last:border-0">
          <td className="py-4"><p className="text-sm font-bold">{item.name}</p><p className="mt-1 text-[#969b92]">Contrato: {dateLabel(item.billingStartedAt)}</p></td>
          <td className="py-4 font-semibold">{money(item.monthlyFeeCents)}</td><td className="py-4">Dia {item.billingDueDay}</td>
          <td className="py-4"><span className={item.overdueCount ? "font-bold text-[#a24841]" : "text-[#686e65]"}>{item.pendingCount} pendente(s){item.overdueCount ? ` · ${item.overdueCount} atrasada(s)` : ""}</span></td>
          <td className="py-4"><StatusPill status={item.status}/></td>
          <td className="py-4 text-right"><button className={secondaryButton} type="button" onClick={() => setSelected(item)}><Settings2 size={15}/> Gerenciar</button></td>
        </tr>)}</tbody>
      </table></div>}
    </Panel>
    {selected ? <BillingDialog tenant={selected} busy={busy} onClose={() => setSelected(null)} onPaid={markPaid}
      onSaved={async () => { const fresh = await load(); setSelected(fresh.find(item => item.id === selected.id) ?? null); setNotice("Configuração de mensalidade atualizada."); }}/>: null}
  </>;
}

function BillingDialog({ tenant, busy, onClose, onPaid, onSaved }: {
  tenant: TenantBilling; busy: string; onClose: () => void; onPaid: (fee: Fee) => Promise<void>; onSaved: () => Promise<void>;
}) {
  const [monthlyFee, setMonthlyFee] = useState((tenant.monthlyFeeCents / 100).toFixed(2));
  const [dueDay, setDueDay] = useState(tenant.billingDueDay);
  const [startedAt, setStartedAt] = useState(tenant.billingStartedAt.slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFormError("");
    const cents = Math.round(Number(monthlyFee.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) { setFormError("Informe um valor válido."); setSaving(false); return; }
    try {
      await apiJson(`/system/tenants/${tenant.id}/billing`, mutation("PATCH", {
        monthlyFeeCents: cents, billingDueDay: dueDay, billingStartedAt: `${startedAt}T12:00:00-03:00`,
      }));
      await onSaved();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Falha ao salvar"); }
    finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button aria-label="Fechar" className="absolute inset-0 bg-black/55" type="button" onClick={onClose}/>
    <section role="dialog" aria-modal="true" aria-labelledby="billing-title" className="relative max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#92978e]">Mensalidade SaaS</p>
        <h2 id="billing-title" className="mt-2 text-2xl font-bold">{tenant.name}</h2></div>
        <button className={secondaryButton} type="button" onClick={onClose}>Fechar</button></div>
      <form className="mt-6 grid gap-4 rounded-2xl border border-[#e8eae4] bg-[#fafbf8] p-5 sm:grid-cols-4" onSubmit={save}>
        <label className="text-xs font-semibold sm:col-span-2">Valor mensal (R$)<input className={fieldClass + " mt-2"} inputMode="decimal" value={monthlyFee} onChange={event => setMonthlyFee(event.target.value)}/></label>
        <label className="text-xs font-semibold">Dia de vencimento<input className={fieldClass + " mt-2"} type="number" min={1} max={31} disabled={tenant.monthlyFees.length > 0} value={dueDay} onChange={event => setDueDay(Number(event.target.value))}/></label>
        <label className="text-xs font-semibold">Início do contrato<input className={fieldClass + " mt-2"} type="date" required disabled={tenant.monthlyFees.length > 0} value={startedAt} onChange={event => setStartedAt(event.target.value)}/></label>
        {formError ? <p role="alert" className="text-xs text-[#9b4741] sm:col-span-3">{formError}</p> : <p className="text-xs leading-5 text-[#81867d] sm:col-span-3">Valor zero desativa novas competências e suspensão financeira. Após a primeira mensalidade, início e vencimento ficam fixos; reajustes de valor se aplicam apenas a novas competências.</p>}
        <button className={primaryButton} disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar configuração"}</button>
      </form>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
        <div><h3 className="flex items-center gap-2 text-sm font-bold"><CircleDollarSign size={17}/> Competências</h3>
          <div className="mt-3 divide-y divide-[#eceee8] rounded-2xl border border-[#e8eae4] px-4">{tenant.monthlyFees.length ? tenant.monthlyFees.map(fee => {
            const overdue = fee.status === "PENDING" && new Date(fee.overdueAt) <= new Date();
            return <div className="flex flex-wrap items-center gap-3 py-4" key={fee.id}><div className="min-w-28 flex-1"><p className="text-sm font-bold">{fee.competence}</p><p className="mt-1 text-xs text-[#8e938a]">Vence {dueLabel(fee.dueOn)} · {money(fee.amountCents)}</p></div>
              <span className={`text-xs font-bold ${overdue ? "text-[#a24841]" : fee.status === "PAID" ? "text-[#50714d]" : "text-[#8b742b]"}`}>{overdue ? "ATRASADA" : fee.status === "PAID" ? "PAGA" : "PENDENTE"}</span>
              {fee.status === "PENDING" ? <button className={secondaryButton} disabled={busy === fee.id} type="button" onClick={() => void onPaid(fee)}><CheckCircle2 size={15}/>{busy === fee.id ? "Confirmando..." : "Marcar como pago"}</button> : null}
              {fee.paidAt ? <p className="w-full text-[11px] text-[#92978e]">Confirmada em {dateLabel(fee.paidAt)} por {fee.confirmedBy?.name ?? "administrador removido"}</p> : null}
            </div>;
          }) : <p className="py-8 text-center text-xs text-[#92978e]">Nenhuma competência gerada.</p>}</div>
        </div>
        <div><h3 className="flex items-center gap-2 text-sm font-bold"><History size={17}/> Auditoria</h3>
          <div className="mt-3 space-y-3">{tenant.billingAuditEvents.length ? tenant.billingAuditEvents.map(event => <div className="rounded-xl bg-[#f5f6f2] p-3" key={event.id}>
            <p className="text-xs font-bold">{event.action.replaceAll("_", " ")}</p><p className="mt-1 text-[11px] text-[#8c9188]">{dateLabel(event.createdAt)} · {event.actor?.name ?? "Rotina do servidor"}</p>
          </div>) : <p className="text-xs text-[#92978e]">Sem eventos registrados.</p>}</div>
        </div>
      </div>
    </section>
  </div>;
}
