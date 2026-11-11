"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ScrollText, Search } from "lucide-react";
import { apiJson } from "../../../lib/api";
import { PageHeader } from "../../../components/dashboard/ui";

type AuditEvent = {
  id: string; action: string; source: string; targetType: string; targetId: string | null;
  createdAt: string; details: unknown;
  actor: { id: string; name: string; username: string; globalRole: string } | null;
};
const labels: Record<string, string> = {
  MANAGER_CREATED: "Manager cadastrado",
  MANAGER_ACTIVATED: "Manager reativado",
  MANAGER_DEACTIVATED: "Manager desativado",
  TENANT_CREATED: "Barbearia cadastrada",
  TENANT_SUSPENDED: "Barbearia suspensa",
  TENANT_ACTIVATED: "Barbearia reativada",
  OWNER_INVITE_CREATED: "Convite emitido",
  OWNER_INVITE_REVOKED: "Convite revogado",
  CONFIG_UPDATED: "Mensalidade configurada",
  COMPETENCY_CREATED: "Mensalidade gerada",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  AUTO_SUSPENDED: "Suspensão automática",
  AUTO_REACTIVATED: "Reativação automática",
};

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { setEvents(await apiJson<AuditEvent[]>("/system/audit?take=100")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar auditoria."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => events.filter(event => [
    event.action, labels[event.action] ?? "", event.targetType,
    event.targetId ?? "", event.actor?.name ?? "", event.actor?.username ?? "",
  ].some(value => value.toLowerCase().includes(query.toLowerCase().trim()))), [events, query]);

  return <div className="space-y-6 pb-12">
    <PageHeader kicker="PLATAFORMA / SEGURANÇA" title="Auditoria"
      description="Histórico das principais ações administrativas e das movimentações de mensalidades. Acesso exclusivo do SYSTEM."/>
    <section className="overflow-hidden rounded-[22px] border border-[#e5e8e0] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eceee9] px-5 py-5 sm:px-7">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold"><ScrollText size={18}/> Registro de atividades</h2>
          <p className="mt-1 text-xs text-[#879186]">Até 100 eventos recentes, ordenados do mais novo para o mais antigo.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#dde3d9] px-3 sm:w-[220px] sm:flex-none">
            <Search size={15} className="shrink-0 text-[#849080]"/>
            <input value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Buscar atividade" aria-label="Buscar atividade"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"/>
          </label>
          <button type="button" onClick={() => void load()} disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dde3d9] px-3 text-xs font-semibold disabled:opacity-50">
            <RefreshCw size={15}/> Atualizar
          </button>
        </div>
      </div>
      {error && <p role="alert" className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {busy ? <p className="p-9 text-center text-sm text-[#8c958a]">Carregando registros...</p> :
        filtered.length === 0 ? <p className="p-12 text-center text-sm text-[#8c958a]">Nenhum registro encontrado.</p> :
        <div className="divide-y divide-[#eff1ec]">
          {filtered.map(event => <article key={event.source + event.id}
            className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:gap-5 sm:px-7">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#242b22]">{labels[event.action] ?? event.action}</p>
              <p className="mt-1 text-[12px] text-[#737e71]">
                {event.actor ? `${event.actor.name} (@${event.actor.username}) · ${event.actor.globalRole}` : "Sistema automático"}
              </p>
              <p className="mt-1 break-all text-[11px] text-[#9ca599]">
                {event.targetType}{event.targetId ? ` · ${event.targetId}` : ""}
              </p>
            </div>
            <div className="text-[11px] text-[#849080] sm:text-right">
              <time dateTime={event.createdAt}>
                {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short",
                  timeZone: "America/Sao_Paulo" }).format(new Date(event.createdAt))}
              </time>
              <p className="mt-1 font-semibold">{event.source === "BILLING" ? "Mensalidades" : "Plataforma"}</p>
            </div>
          </article>)}
        </div>}
    </section>
    <p className="text-xs leading-5 text-[#8c958a]">
      Os registros de auditoria são restritos ao SYSTEM. Operações anteriores à ativação desta funcionalidade
      podem não aparecer no histórico da plataforma.
    </p>
  </div>;
}
