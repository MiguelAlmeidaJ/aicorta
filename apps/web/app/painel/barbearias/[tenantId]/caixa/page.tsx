"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Banknote, LockKeyhole, RefreshCw, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiJson, mutation } from "../../../../../lib/api";
import { money, PageHeader, Panel, secondaryButton } from "../../../../../components/dashboard/ui";

type Movement = {
  id: string; type: string; amountCents: number; reason: string | null; createdAt: string;
  actor: { name: string }; payment: { method: string } | null;
};
type CashSession = {
  id: string; status: string; openingBalanceCents: number; expectedBalanceCents: number;
  countedBalanceCents: number | null; differenceCents: number | null; openedAt: string; closedAt: string | null;
  openingNotes: string | null; closingNotes: string | null;
  openedBy: { name: string }; closedBy: { name: string } | null; movements?: Movement[];
};
type Profile = { memberships: { tenantId: string; role: string }[] };

const movementLabels: Record<string, string> = {
  OPENING_BALANCE: "Saldo inicial", PAYMENT: "Pagamento presencial registrado", WITHDRAWAL: "Sangria",
  SUPPLY: "Suprimento", REFUND: "Estorno",
};
const methodLabels: Record<string, string> = {
  CASH: "Dinheiro", PIX: "PIX do estabelecimento", DEBIT_CARD: "Debito na maquininha", CREDIT_CARD: "Credito na maquininha", OTHER: "Outro presencial",
};
function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
}
function cents(value: FormDataEntryValue | null) {
  return Math.round(Number(value ?? 0) * 100);
}
function CashStat({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return <article className="rounded-[22px] border border-[#e9eae5] bg-white p-5">
    <div className="flex items-center justify-between"><p className="text-xs text-[#81867d]">{label}</p><Icon size={17} className="text-[#8c9188]"/></div>
    <p className="mt-5 text-2xl font-bold">{money(value)}</p>
  </article>;
}

export default function CashPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [current, setCurrent] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [admin, setAdmin] = useState(false);
  const [version, setVersion] = useState(1);
  const [loaded, setLoaded] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loading = version !== loaded;

  useEffect(() => {
    let active = true;
    Promise.all([
      apiJson<CashSession | null>(`/tenants/${tenantId}/cash-sessions/current`),
      apiJson<CashSession[]>(`/tenants/${tenantId}/cash-sessions?take=30`),
      apiJson<Profile>("/auth/me"),
    ]).then(([session, sessions, profile]) => {
      if (!active) return;
      setCurrent(session); setHistory(sessions);
      setAdmin(profile.memberships.some(item => item.tenantId === tenantId && item.role === "ADMIN"));
      setError("");
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Nao foi possivel carregar o caixa.");
    }).finally(() => { if (active) setLoaded(version); });
    return () => { active = false; };
  }, [tenantId, version]);

  const totals = useMemo(() => {
    const result = { payments: 0, supplies: 0, withdrawals: 0, refunds: 0 };
    for (const item of current?.movements ?? []) {
      if (item.type === "PAYMENT") result.payments += item.amountCents;
      if (item.type === "SUPPLY") result.supplies += item.amountCents;
      if (item.type === "WITHDRAWAL") result.withdrawals += item.amountCents;
      if (item.type === "REFUND") result.refunds += item.amountCents;
    }
    return result;
  }, [current]);

  async function openCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    setBusy("open"); setError(""); setNotice("");
    try {
      await apiJson(`/tenants/${tenantId}/cash-sessions/open`, mutation("POST", {
        openingBalanceCents: cents(data.get("openingBalance")), notes: String(data.get("notes") ?? ""),
      }));
      form.reset(); setNotice("Caixa aberto."); setVersion(value => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Nao foi possivel abrir o caixa."); }
    finally { setBusy(""); }
  }

  async function addMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    setBusy("movement"); setError(""); setNotice("");
    try {
      await apiJson(`/tenants/${tenantId}/cash-sessions/current/movements`, mutation("POST", {
        type: String(data.get("type")), amountCents: cents(data.get("amount")), reason: String(data.get("reason") ?? ""),
      }));
      form.reset(); setNotice("Movimento registrado."); setVersion(value => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Nao foi possivel registrar o movimento."); }
    finally { setBusy(""); }
  }

  async function closeCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    setBusy("close"); setError(""); setNotice("");
    try {
      await apiJson(`/tenants/${tenantId}/cash-sessions/current/close`, mutation("PATCH", {
        countedBalanceCents: cents(data.get("countedBalance")), notes: String(data.get("notes") ?? ""),
      }));
      form.reset(); setNotice("Caixa fechado."); setVersion(value => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Nao foi possivel fechar o caixa."); }
    finally { setBusy(""); }
  }

  return <>
    <PageHeader kicker="Operacao / Financeiro" title="Caixa e pagamentos presenciais"
      description="Registre pagamentos feitos diretamente no comercio. O AICorta nao gera PIX, nao cobra cartoes e nao opera a maquininha."
      action={<button type="button" onClick={() => setVersion(value => value + 1)} className={secondaryButton}><RefreshCw size={16}/> Atualizar</button>}/>
    {error ? <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
    {notice ? <div role="status" className="mb-5 rounded-xl border border-[#dfe5d8] bg-[#edf2e9] p-4 text-sm text-[#486044]">{notice}</div> : null}

    {loading && !current ? <p className="py-16 text-center text-sm text-[#878c83]">Carregando caixa...</p> : current ? <>
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CashStat label="Saldo esperado" value={current.expectedBalanceCents} icon={WalletCards}/>
        <CashStat label="Pagamentos registrados" value={totals.payments} icon={Banknote}/>
        <CashStat label="Suprimentos" value={totals.supplies} icon={ArrowDownToLine}/>
        <CashStat label="Sangrias" value={totals.withdrawals} icon={ArrowUpFromLine}/>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="Extrato do caixa" description={`Aberto por ${current.openedBy.name} em ${dateTime(current.openedAt)}`}>
          {current.movements?.length ? <div className="divide-y divide-[#eceee8]">{current.movements.map(item => {
            const negative = ["WITHDRAWAL", "REFUND"].includes(item.type);
            return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div><p className="text-sm font-bold">{movementLabels[item.type] ?? item.type}{item.payment ? ` · ${methodLabels[item.payment.method] ?? item.payment.method}` : ""}</p>
                <p className="mt-1 text-xs text-[#888d84]">{item.reason || "Sem observacao"} · {item.actor.name} · {dateTime(item.createdAt)}</p></div>
              <strong className={negative ? "text-red-600" : "text-[#242720]"}>{negative ? "− " : "+ "}{money(item.amountCents)}</strong>
            </div>;
          })}</div> : <p className="py-8 text-center text-sm text-[#8d9289]">Nenhum movimento registrado.</p>}
        </Panel>
        <div className="space-y-6">
          {admin ? <Panel title="Sangria ou suprimento" description="Somente administradores podem movimentar dinheiro manualmente.">
            <form onSubmit={addMovement} className="space-y-3">
              <label className="block text-xs font-semibold">Tipo<select name="type" className="mt-2 w-full rounded-xl border border-[#dfe2da] bg-white px-3 py-2.5 text-sm"><option value="WITHDRAWAL">Sangria</option><option value="SUPPLY">Suprimento</option></select></label>
              <label className="block text-xs font-semibold">Valor (R$)<input name="amount" required type="number" min={0.01} step="0.01" className="mt-2 w-full rounded-xl border border-[#dfe2da] px-3 py-2.5 text-sm"/></label>
              <label className="block text-xs font-semibold">Motivo<input name="reason" required minLength={3} maxLength={300} className="mt-2 w-full rounded-xl border border-[#dfe2da] px-3 py-2.5 text-sm"/></label>
              <button type="submit" disabled={busy === "movement"} className="inline-flex w-full items-center justify-center rounded-xl bg-[#171916] px-4 py-3 text-xs font-bold text-white disabled:opacity-40">Registrar movimento</button>
            </form>
          </Panel> : null}
          {admin ? <Panel title="Fechar caixa" description={`Saldo esperado em dinheiro: ${money(current.expectedBalanceCents)}`}>
            <form onSubmit={closeCash} className="space-y-3">
              <label className="block text-xs font-semibold">Valor contado (R$)<input name="countedBalance" required type="number" min={0} step="0.01" className="mt-2 w-full rounded-xl border border-[#dfe2da] px-3 py-2.5 text-sm"/></label>
              <label className="block text-xs font-semibold">Observacao<input name="notes" maxLength={500} className="mt-2 w-full rounded-xl border border-[#dfe2da] px-3 py-2.5 text-sm"/></label>
              <button type="submit" disabled={busy === "close"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"><LockKeyhole size={15}/> Fechar caixa</button>
            </form>
          </Panel> : null}
        </div>
      </div>
    </> : <Panel title="Abrir caixa" description="Informe o dinheiro disponivel no inicio do turno.">
      <form onSubmit={openCash} className="max-w-lg space-y-4">
        <label className="block text-xs font-semibold">Saldo inicial (R$)<input name="openingBalance" required type="number" min={0} step="0.01" defaultValue="0.00" className="mt-2 w-full rounded-xl border border-[#dfe2da] px-3 py-2.5 text-sm"/></label>
        <label className="block text-xs font-semibold">Observacao<input name="notes" maxLength={500} className="mt-2 w-full rounded-xl border border-[#dfe2da] px-3 py-2.5 text-sm"/></label>
        <button type="submit" disabled={busy === "open"} className="inline-flex items-center gap-2 rounded-xl bg-[#171916] px-5 py-3 text-xs font-bold text-white disabled:opacity-40"><WalletCards size={16}/> Abrir caixa</button>
      </form>
    </Panel>}

    <div className="mt-6"><Panel title="Fechamentos anteriores" description="Diferencas ficam registradas para conferencia.">
      {history.filter(item => item.status === "CLOSED").length ? <div className="divide-y divide-[#eceee8]">{history.filter(item => item.status === "CLOSED").map(item => <div key={item.id} className="grid gap-3 py-4 text-sm sm:grid-cols-4">
        <div><span className="text-xs text-[#898e85]">Abertura</span><p className="mt-1 font-semibold">{dateTime(item.openedAt)}</p></div>
        <div><span className="text-xs text-[#898e85]">Esperado</span><p className="mt-1 font-semibold">{money(item.expectedBalanceCents)}</p></div>
        <div><span className="text-xs text-[#898e85]">Contado</span><p className="mt-1 font-semibold">{money(item.countedBalanceCents ?? 0)}</p></div>
        <div><span className="text-xs text-[#898e85]">Diferenca</span><p className={`mt-1 font-bold ${(item.differenceCents ?? 0) < 0 ? "text-red-600" : "text-[#3f5940]"}`}>{money(item.differenceCents ?? 0)}</p></div>
      </div>)}</div> : <p className="py-6 text-center text-sm text-[#8d9289]">Nenhum fechamento anterior.</p>}
    </Panel></div>
  </>;
}
