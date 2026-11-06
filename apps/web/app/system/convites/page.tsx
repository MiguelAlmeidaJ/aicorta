"use client";
import { FormEvent, useEffect, useState } from "react";
import { Check, Copy, Link2, Plus, Ticket, Trash2 } from "lucide-react";
import { apiJson, mutation } from "../../../lib/api";
import { EmptyState, PageHeader, Panel, primaryButton, secondaryButton, shortDate, StatusPill, fieldClass } from "../../../components/dashboard/ui";
type Invite = { id: string; referenceName: string; billingDueDay: number; expiresAt: string;
  consumedAt: string | null; revokedAt: string | null; createdAt: string };
type Issued = { registrationUrl: string };

export default function SystemInvites() {
  const [referenceName, setReferenceName] = useState("");
  const [billingDueDay, setBillingDueDay] = useState(10);
  const [items, setItems] = useState<Invite[]>([]);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => apiJson<Invite[]>("/auth/owner-invites").then(setItems);
  useEffect(() => { void load().catch(() => setStatus("Não foi possível carregar os convites.")); }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setLink(""); setStatus(""); setCopied(false);
    try {
      const invite = await apiJson<Issued>("/auth/owner-invites", mutation("POST", { referenceName, billingDueDay }));
      setLink(invite.registrationUrl);
      setReferenceName("");
      setStatus("Convite criado. Copie o link e compartilhe com o proprietário.");
      await load();
    } catch (e) { setStatus(e instanceof Error ? e.message : "Não foi possível criar o convite."); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (!window.confirm("Tem certeza que deseja revogar este convite?")) return;
    try {
      await apiJson(`/auth/owner-invites/${id}/revoke`, { method: "PATCH" });
      setStatus("Convite revogado."); await load();
    } catch(e) { setStatus(e instanceof Error ? e.message : "Falha ao revogar"); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { setStatus("Não foi possível copiar. Selecione o link manualmente."); }
  }
  const pending = items.filter(i => !i.consumedAt && !i.revokedAt && new Date(i.expiresAt) > new Date()).length;
  return <>
    <PageHeader kicker="Plataforma / Onboarding" title="Convites de proprietários"
      description="Controle quem pode cadastrar uma barbearia. Cada convite é individual, temporário e de uso único."/>
    <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
      <Panel title="Gerar novo convite" description="Disponível apenas para usuários SYSTEM">
        <form onSubmit={create} className="space-y-5">
          <label className="block text-xs font-semibold text-[#545a51]">Nome de referência
            <input className={fieldClass + " mt-2"} required minLength={2} maxLength={100}
              placeholder="Ex.: João Miguel • Barbearia Central"
              value={referenceName} onChange={e => setReferenceName(e.target.value)}/>
          </label>
          <label className="block text-xs font-semibold text-[#545a51]">Dia mensal de vencimento
            <input className={fieldClass + " mt-2"} required type="number" min={1} max={31}
              value={billingDueDay} onChange={e => setBillingDueDay(Number(e.target.value))}/>
          </label>
          <p className="rounded-xl bg-[#f5f6f2] p-3 text-xs leading-5 text-[#777c74]">O vencimento será associado à barbearia. A cobrança automática será implementada no módulo financeiro.</p>
          <button type="submit" disabled={busy} className={primaryButton + " w-full"}>
            <Plus size={17}/>{busy ? "Gerando..." : "Gerar link de cadastro"}
          </button>
        </form>
        {link && <div className="mt-6 rounded-xl border border-[#d8e0d7] bg-[#f2f6f0] p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold text-[#476349]"><Link2 size={16}/> Link gerado — exibido uma única vez</p>
          <input readOnly aria-label="Link de convite" className={fieldClass} value={link} onFocus={e => e.currentTarget.select()}/>
          <button className={secondaryButton + " mt-3 w-full"} onClick={() => void copy()}>
            {copied ? <Check size={16}/> : <Copy size={16}/>}{copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>}
        {status && <p role="status" className="mt-4 text-xs leading-5 text-[#777c74]">{status}</p>}
      </Panel>
      <Panel title="Histórico de convites" description={`${pending} convite(s) pendente(s)`}>
        {items.length === 0 ? <EmptyState icon={Ticket} title="Nenhum convite ainda"
          description="Crie o primeiro convite para permitir o cadastro de uma barbearia."/> :
        <div className="divide-y divide-[#eff0eb]">
          {items.map(item => {
            const state = item.consumedAt ? "Utilizado" : item.revokedAt ? "Revogado" :
              new Date(item.expiresAt) <= new Date() ? "Expirado" : "Pendente";
            return <div key={item.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1f2ee] text-[#777e72]"><Ticket size={19}/></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.referenceName}</p>
                <p className="mt-1 text-xs text-[#9b9f97]">Dia {item.billingDueDay} · Expira {shortDate(item.expiresAt)}</p>
              </div>
              <StatusPill status={state}/>
              {state === "Pendente" && <button aria-label="Revogar convite" title="Revogar convite"
                onClick={() => void revoke(item.id)} className="rounded-lg p-2 text-[#91968c] transition hover:bg-[#f8eaea] hover:text-red-600"><Trash2 size={17}/></button>}
            </div>;
          })}
        </div>}
      </Panel>
    </div>
  </>;
}
