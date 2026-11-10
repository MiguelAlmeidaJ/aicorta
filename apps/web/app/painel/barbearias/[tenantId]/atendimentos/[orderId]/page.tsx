"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BadgePercent, Check, Clock3, CreditCard, Play, Plus, Trash2, X } from "lucide-react";
import { apiJson, mutation } from "../../../../../../lib/api";
import { money, Panel, secondaryButton } from "../../../../../../components/dashboard/ui";

type OrderItem = {
  id: string; source: string; description: string; quantity: number; unitPriceCents: number; totalCents: number;
};
type OrderEvent = { id: string; type: string; payload: unknown; createdAt: string; actor: { name: string } };
type ServiceOrder = {
  id: string; status: string; subtotalCents: number; discountCents: number; discountReason: string | null;
  totalCents: number; checkedInAt: string; startedAt: string | null; closedAt: string | null;
  client: { name: string }; employee: { user: { name: string } };
  appointment: { startsAt: string }; items: OrderItem[]; events: OrderEvent[];
};
type Profile = { memberships: { tenantId: string; role: string }[] };
type Payment = {
  id: string; method: string; status: string; amountCents: number; reference: string | null;
  voidReason: string | null; createdAt: string; receivedBy: { name: string }; voidedBy: { name: string } | null;
};
type PaymentSummary = { totalCents: number; paidCents: number; remainingCents: number; payments: Payment[] };
type PaymentDraft = { method: string; amount: string; reference: string };

const eventLabels: Record<string, string> = {
  CHECKED_IN: "Check-in realizado", STARTED: "Atendimento iniciado", ITEM_ADDED: "Item adicionado",
  ITEM_REMOVED: "Item removido", DISCOUNT_APPLIED: "Desconto atualizado", CLOSED: "Comanda encerrada",
  CANCELLED: "Comanda cancelada",
};
const statusLabels: Record<string, string> = {
  CHECKED_IN: "Check-in", IN_PROGRESS: "Em atendimento", CLOSED: "Encerrada", CANCELLED: "Cancelada",
};
const methodLabels: Record<string, string> = {
  CASH: "Dinheiro no estabelecimento", PIX: "PIX do estabelecimento", DEBIT_CARD: "Debito na maquininha", CREDIT_CARD: "Credito na maquininha", OTHER: "Outro meio presencial",
};
const emptyPayment: PaymentDraft = { method: "PIX", amount: "", reference: "" };
function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
}

export default function ServiceOrderDetailPage() {
  const { tenantId, orderId } = useParams<{ tenantId: string; orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [admin, setAdmin] = useState(false);
  const [payments, setPayments] = useState<PaymentSummary | null>(null);
  const [paymentParts, setPaymentParts] = useState<PaymentDraft[]>([{ ...emptyPayment }]);
  const [version, setVersion] = useState(1);
  const [loaded, setLoaded] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loading = loaded !== version;

  useEffect(() => {
    let active = true;
    Promise.all([
      apiJson<ServiceOrder>(`/tenants/${tenantId}/service-orders/${orderId}`),
      apiJson<Profile>("/auth/me"),
      apiJson<PaymentSummary>(`/tenants/${tenantId}/service-orders/${orderId}/payments`),
    ]).then(([nextOrder, profile, paymentSummary]) => {
      if (!active) return;
      setOrder(nextOrder);
      setAdmin(profile.memberships.some(item => item.tenantId === tenantId && item.role === "ADMIN"));
      setPayments(paymentSummary);
      setError("");
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Nao foi possivel carregar a comanda.");
    }).finally(() => { if (active) setLoaded(version); });
    return () => { active = false; };
  }, [tenantId, orderId, version]);

  async function action(path: string, success: string) {
    setBusy(path); setError(""); setNotice("");
    try {
      await apiJson(`/tenants/${tenantId}/service-orders/${orderId}/${path}`, { method: "PATCH" });
      setNotice(success);
      setVersion(value => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nao foi possivel atualizar a comanda.");
    } finally { setBusy(""); }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("item"); setError(""); setNotice("");
    try {
      await apiJson(`/tenants/${tenantId}/service-orders/${orderId}/items`, mutation("POST", {
        description: String(data.get("description") ?? ""),
        quantity: Number(data.get("quantity")),
        unitPriceCents: Math.round(Number(data.get("price")) * 100),
      }));
      form.reset(); setNotice("Item adicionado."); setVersion(value => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nao foi possivel adicionar o item.");
    } finally { setBusy(""); }
  }

  async function removeItem(itemId: string) {
    setBusy(itemId); setError(""); setNotice("");
    try {
      await apiJson(`/tenants/${tenantId}/service-orders/${orderId}/items/${itemId}`, { method: "DELETE" });
      setNotice("Item removido."); setVersion(value => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nao foi possivel remover o item.");
    } finally { setBusy(""); }
  }

  async function applyDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy("discount"); setError(""); setNotice("");
    try {
      await apiJson(`/tenants/${tenantId}/service-orders/${orderId}/discount`, mutation("PATCH", {
        discountCents: Math.round(Number(data.get("discount")) * 100), reason: String(data.get("reason") ?? ""),
      }));
      setNotice("Desconto atualizado."); setVersion(value => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nao foi possivel aplicar o desconto.");
    } finally { setBusy(""); }
  }

  function updatePaymentPart(index: number, patch: Partial<PaymentDraft>) {
    setPaymentParts(current => current.map((part, position) => position === index ? { ...part, ...patch } : part));
  }

  async function receivePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("payment"); setError(""); setNotice("");
    try {
      const parts = paymentParts.map(part => ({
        method: part.method, amountCents: Math.round(Number(part.amount) * 100),
        ...(part.reference.trim() && { reference: part.reference.trim() }),
      }));
      const result = await apiJson<PaymentSummary>(`/tenants/${tenantId}/service-orders/${orderId}/payments`, mutation("POST", { parts }));
      setPayments(result); setPaymentParts([{ ...emptyPayment }]); setNotice("Pagamento presencial registrado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nao foi possivel registrar o pagamento presencial.");
    } finally { setBusy(""); }
  }

  async function voidPayment(paymentId: string) {
    const reason = window.prompt("Informe o motivo do estorno:")?.trim();
    if (!reason) return;
    setBusy(paymentId); setError(""); setNotice("");
    try {
      const result = await apiJson<PaymentSummary>(`/tenants/${tenantId}/payments/${paymentId}/void`, mutation("PATCH", { reason }));
      setPayments(result); setNotice("Estorno registrado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel estornar o pagamento.");
    } finally { setBusy(""); }
  }

  if (loading && !order) return <p className="py-16 text-center text-sm text-[#858a81]">Carregando comanda...</p>;
  if (!order) return <div className="space-y-4"><p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || "Comanda indisponivel."}</p>
    <button type="button" onClick={() => router.back()} className={secondaryButton}><ArrowLeft size={15}/> Voltar</button></div>;
  const open = ["CHECKED_IN", "IN_PROGRESS"].includes(order.status);

  return <div className="space-y-6 pb-12">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><Link href={`/painel/barbearias/${tenantId}/atendimentos`} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[#747a71]"><ArrowLeft size={14}/> Atendimentos</Link>
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#989d94]">Comanda operacional</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-.045em]">{order.client.name}</h1>
        <p className="mt-2 text-sm text-[#7d8279]">{order.employee.user.name} · Reserva em {dateTime(order.appointment.startsAt)}</p></div>
      <span className="rounded-full bg-[#e9ece4] px-4 py-2 text-xs font-bold">{statusLabels[order.status] ?? order.status}</span>
    </div>
    {error ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><X size={16}/>{error}</div> : null}
    {notice ? <div role="status" className="flex items-center gap-2 rounded-xl border border-[#dfe5d8] bg-[#edf2e9] p-4 text-sm text-[#486044]"><Check size={16}/>{notice}</div> : null}

    <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <div className="space-y-6">
        <Panel title="Itens da comanda" description="Os itens originais preservam o valor da reserva."
          right={<span className="text-xs text-[#8d9289]">{order.items.length} item(ns)</span>}>
          <div className="mt-5 divide-y divide-[#eceee8]">{order.items.map(item => <div key={item.id} className="flex items-center justify-between gap-4 py-4">
            <div><p className="text-sm font-bold">{item.description}</p><p className="mt-1 text-xs text-[#8b9087]">{item.quantity} × {money(item.unitPriceCents)} · {item.source === "APPOINTMENT" ? "Reserva" : "Adicional"}</p></div>
            <div className="flex items-center gap-3"><strong className="text-sm">{money(item.totalCents)}</strong>{open && item.source === "MANUAL" ?
              <button type="button" aria-label={`Remover ${item.description}`} disabled={busy === item.id} onClick={() => void removeItem(item.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 size={15}/></button> : null}</div>
          </div>)}</div>
          {open ? <form onSubmit={addItem} className="mt-5 grid gap-3 border-t border-[#eceee8] pt-5 sm:grid-cols-[1fr_90px_120px_auto]">
            <label className="text-xs font-semibold">Descricao<input name="description" required minLength={2} maxLength={120} className="mt-2 w-full rounded-xl border border-[#dfe2da] px-3 py-2.5 text-sm" placeholder="Ex.: Barba premium"/></label>
            <label className="text-xs font-semibold">Qtd.<input name="quantity" required type="number" min={1} max={99} defaultValue={1} className="mt-2 w-full rounded-xl border border-[#dfe2da] px-3 py-2.5 text-sm"/></label>
            <label className="text-xs font-semibold">Valor (R$)<input name="price" required type="number" min={0} step="0.01" className="mt-2 w-full rounded-xl border border-[#dfe2da] px-3 py-2.5 text-sm" placeholder="0,00"/></label>
            <button type="submit" disabled={busy === "item"} className="mt-auto inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-[#171916] px-4 text-xs font-bold text-white disabled:opacity-40"><Plus size={15}/> Adicionar</button>
          </form> : null}
        </Panel>

        <Panel title="Historico de operacoes"><div className="space-y-4">{order.events.map(event =>
          <div key={event.id} className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#b89a35]"/><div><p className="text-sm font-semibold">{eventLabels[event.type] ?? event.type}</p><p className="mt-1 text-xs text-[#8c9188]">{event.actor.name} · {dateTime(event.createdAt)}</p></div></div>)}</div></Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Resumo financeiro"><div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-[#7e837a]">Subtotal</span><strong>{money(order.subtotalCents)}</strong></div>
          <div className="flex justify-between"><span className="text-[#7e837a]">Desconto</span><strong className="text-red-600">− {money(order.discountCents)}</strong></div>
          <div className="flex justify-between border-t border-[#e7e9e3] pt-4 text-lg"><span>Total</span><strong>{money(order.totalCents)}</strong></div>
          {order.discountReason ? <p className="rounded-lg bg-[#f5f6f2] p-3 text-xs text-[#73786f]">Motivo: {order.discountReason}</p> : null}
        </div>
        {open && admin ? <form onSubmit={applyDiscount} className="mt-5 space-y-3 border-t border-[#e7e9e3] pt-5">
          <label className="block text-xs font-semibold">Desconto (R$)<input name="discount" required type="number" min={0} step="0.01" defaultValue={(order.discountCents / 100).toFixed(2)} className="mt-2 w-full rounded-xl border border-[#dfe2da] px-3 py-2.5 text-sm"/></label>
          <label className="block text-xs font-semibold">Motivo<input name="reason" required minLength={3} maxLength={300} defaultValue={order.discountReason ?? ""} className="mt-2 w-full rounded-xl border border-[#dfe2da] px-3 py-2.5 text-sm"/></label>
          <button type="submit" disabled={busy === "discount"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe2da] px-4 py-3 text-xs font-bold disabled:opacity-40"><BadgePercent size={15}/> Aplicar desconto</button>
        </form> : null}</Panel>

        <Panel title="Registro de pagamento presencial" description={order.status === "CLOSED" ? "Informe como o cliente ja pagou diretamente ao estabelecimento. O sistema nao cobra nem gera PIX." : "Encerre a comanda para registrar o pagamento feito no estabelecimento."}
          right={<CreditCard size={18} className="text-[#8b9087]"/>}>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-[#f5f6f2] p-3"><span className="text-[#898e85]">Total</span><p className="mt-1 font-bold">{money(payments?.totalCents ?? order.totalCents)}</p></div>
            <div className="rounded-xl bg-[#f5f6f2] p-3"><span className="text-[#898e85]">Recebido</span><p className="mt-1 font-bold">{money(payments?.paidCents ?? 0)}</p></div>
            <div className="rounded-xl bg-[#f5f6f2] p-3"><span className="text-[#898e85]">Restante</span><p className="mt-1 font-bold">{money(payments?.remainingCents ?? order.totalCents)}</p></div>
          </div>
          {payments?.payments.length ? <div className="mt-4 divide-y divide-[#eceee8]">{payments.payments.map(payment => <div key={payment.id} className="flex items-center justify-between gap-3 py-3">
            <div><p className="text-xs font-bold">{methodLabels[payment.method] ?? payment.method} · {money(payment.amountCents)}</p><p className="mt-1 text-[11px] text-[#8c9188]">{payment.status === "VOIDED" ? `Estornado: ${payment.voidReason}` : `${payment.receivedBy.name} · ${dateTime(payment.createdAt)}`}</p></div>
            {admin && payment.status === "CONFIRMED" ? <button type="button" disabled={busy === payment.id} onClick={() => void voidPayment(payment.id)} className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-40">Estornar</button> : null}
          </div>)}</div> : null}
          {order.status === "CLOSED" && (payments?.remainingCents ?? order.totalCents) > 0 ? <form onSubmit={receivePayment} className="mt-5 space-y-3 border-t border-[#e7e9e3] pt-5">
            {paymentParts.map((part, index) => <fieldset key={index} className="grid gap-2 rounded-xl border border-[#e6e8e1] p-3 sm:grid-cols-[1fr_1fr_auto]">
              <legend className="px-1 text-[11px] font-bold">Parte {index + 1}</legend>
              <label className="text-[11px] font-semibold">Meio<select value={part.method} onChange={event => updatePaymentPart(index, { method: event.target.value })} className="mt-1.5 w-full rounded-lg border border-[#dfe2da] bg-white px-2.5 py-2 text-xs">{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-[11px] font-semibold">Valor (R$)<input required type="number" min={0.01} step="0.01" value={part.amount} onChange={event => updatePaymentPart(index, { amount: event.target.value })} className="mt-1.5 w-full rounded-lg border border-[#dfe2da] px-2.5 py-2 text-xs"/></label>
              {paymentParts.length > 1 ? <button type="button" aria-label={`Remover parte ${index + 1}`} onClick={() => setPaymentParts(current => current.filter((_, position) => position !== index))} className="mt-auto rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={15}/></button> : null}
              <label className="text-[11px] font-semibold sm:col-span-3">Referencia opcional<input value={part.reference} onChange={event => updatePaymentPart(index, { reference: event.target.value })} maxLength={120} className="mt-1.5 w-full rounded-lg border border-[#dfe2da] px-2.5 py-2 text-xs" placeholder="NSU, codigo PIX ou observacao"/></label>
            </fieldset>)}
            <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => setPaymentParts(current => [...current, { ...emptyPayment }])} disabled={paymentParts.length >= 10} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold hover:bg-[#f3f4ef] disabled:opacity-40"><Plus size={14}/> Dividir pagamento</button><span className="text-xs text-[#7e837a]">Informado: <strong>{money(paymentParts.reduce((total, part) => total + Math.round(Number(part.amount || 0) * 100), 0))}</strong></span></div>
            <button type="submit" disabled={busy === "payment"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#171916] px-4 py-3 text-xs font-bold text-white disabled:opacity-40"><CreditCard size={15}/> Registrar pagamento ja realizado</button>
          </form> : null}
          {order.status === "CLOSED" && payments?.remainingCents === 0 ? <p className="mt-4 rounded-xl bg-[#edf2e9] p-3 text-center text-xs font-bold text-[#486044]">Comanda integralmente recebida.</p> : null}
        </Panel>

        <Panel title="Andamento"><div className="grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-[#f5f6f2] p-3"><span className="text-[#888d84]">Check-in</span><p className="mt-1 font-bold">{dateTime(order.checkedInAt)}</p></div><div className="rounded-xl bg-[#f5f6f2] p-3"><span className="text-[#888d84]">Inicio</span><p className="mt-1 font-bold">{dateTime(order.startedAt)}</p></div></div>
          <div className="mt-5 space-y-2">{order.status === "CHECKED_IN" ? <button type="button" disabled={Boolean(busy)} onClick={() => void action("start", "Atendimento iniciado.")} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#171916] px-4 py-3 text-xs font-bold text-white disabled:opacity-40"><Play size={15}/> Iniciar atendimento</button> : null}
            {order.status === "IN_PROGRESS" ? <button type="button" disabled={Boolean(busy)} onClick={() => void action("close", "Comanda encerrada.")} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#171916] px-4 py-3 text-xs font-bold text-white disabled:opacity-40"><Check size={15}/> Encerrar comanda</button> : null}
            {open && admin ? <button type="button" disabled={Boolean(busy)} onClick={() => void action("cancel", "Comanda cancelada.")} className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"><X size={15}/> Cancelar comanda</button> : null}</div>
          {order.closedAt ? <p className="mt-4 flex items-center gap-2 text-xs text-[#777c73]"><Clock3 size={14}/> Encerrada em {dateTime(order.closedAt)}</p> : null}
        </Panel>
      </div>
    </div>
  </div>;
}
