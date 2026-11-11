"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ShieldCheck, UserRoundPlus, UserRoundX, RefreshCw } from "lucide-react";
import { apiJson, mutation } from "../../../lib/api";
import { PageHeader, Panel, fieldClass, primaryButton, secondaryButton } from "../../../components/dashboard/ui";

type Manager = {
  id: string; name: string; username: string; email: string; whatsapp: string;
  isActive: boolean; createdAt: string;
};
type ManagerInput = { name: string; username: string; email: string; whatsapp: string; password: string };
const empty: ManagerInput = { name: "", username: "", email: "", whatsapp: "", password: "" };

function phoneMask(input: string) {
  const d = input.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  const separator = d.length > 10 ? 7 : 6;
  return `(${d.slice(0,2)}) ${d.slice(2,separator)}-${d.slice(separator)}`;
}

export default function ManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [draft, setDraft] = useState<ManagerInput>(empty);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => setManagers(await apiJson<Manager[]>("/system/managers")), []);
  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : "Falha ao carregar.")); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    setCreating(true); setError(""); setMessage("");
    try {
      await apiJson("/system/managers", mutation("POST", draft));
      setDraft(empty);
      setMessage("Conta MANAGER criada. Entregue as credenciais por um canal seguro.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a conta.");
    } finally { setCreating(false); }
  }

  async function updateStatus(manager: Manager) {
    const active = !manager.isActive;
    if (!window.confirm(active
      ? `Reativar o acesso de ${manager.name}?`
      : `Desativar o acesso de ${manager.name}? As sessões serão encerradas.`)) return;
    setBusy(manager.id); setError(""); setMessage("");
    try {
      await apiJson(`/system/managers/${manager.id}/status`, mutation("PATCH", { active: String(active) }));
      await load();
      setMessage(active ? "Manager reativado." : "Manager desativado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao alterar acesso.");
    } finally { setBusy(null); }
  }

  return <div className="space-y-6 pb-12">
    <PageHeader kicker="PLATAFORMA / ACESSOS" title="Managers"
      description="Crie operadores da plataforma. Os managers podem administrar barbearias, mensalidades e convites, sem acesso às configurações exclusivas do SYSTEM."/>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {message && <div role="status" className="rounded-xl border border-[#dce6d8] bg-[#f1f7ef] p-4 text-sm text-[#41613d]">{message}</div>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.85fr)]">
      <Panel title="Usuários gerenciais" description={`${managers.length} conta(s) MANAGER cadastrada(s)`}>
        {managers.length === 0 ? <div className="py-12 text-center text-sm text-[#91998d]">Nenhum manager cadastrado.</div> :
        <div className="divide-y divide-[#edeFE9]">
          {managers.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <strong className="text-sm">{item.name}</strong>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.isActive ?
                  "bg-[#eef4ea] text-[#456640]" : "bg-[#f4efea] text-[#98705a]"}`}>
                  {item.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#7f887d]">@{item.username} · {item.email}</p>
            </div>
            <button type="button" disabled={busy !== null} onClick={() => void updateStatus(item)}
              className={secondaryButton + " shrink-0 disabled:opacity-50"}>
              {item.isActive ? <UserRoundX size={15}/> : <RefreshCw size={15}/>}
              {busy === item.id ? "Salvando..." : item.isActive ? "Desativar" : "Reativar"}
            </button>
          </div>)}
        </div>}
      </Panel>
      <Panel title="Adicionar manager" description="Somente o SYSTEM pode cadastrar ou desativar gerentes.">
        <form onSubmit={create} className="space-y-4">
          {([
            ["name","Nome completo","text","Nome do responsável"],
            ["username","Usuário","text","usuariosemacentos"],
            ["email","E-mail","email","contato@exemplo.com"],
            ["whatsapp","WhatsApp","tel","(32) 99999-9999"],
            ["password","Senha inicial","password","Mínimo de 12 caracteres"],
          ] as const).map(([key,label,type,placeholder]) => <label key={key} className="block text-xs font-semibold text-[#5d675a]">
            {label}
            <input required autoComplete="off" type={type} placeholder={placeholder}
              minLength={key === "password" ? 12 : undefined}
              value={draft[key]}
              onChange={event => setDraft(current => ({ ...current,
                [key]: key === "whatsapp" ? phoneMask(event.target.value) :
                  key === "username" ? event.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") :
                  event.target.value,
              }))} className={fieldClass + " mt-2 w-full"}/>
          </label>)}
          <div className="flex gap-2 rounded-xl bg-[#f5f6f2] p-3 text-[11px] leading-5 text-[#7b8577]">
            <ShieldCheck size={17} className="shrink-0"/>
            <p>A senha não é enviada por e-mail nem exibida novamente. Oriente o manager a trocá-la após o primeiro acesso.</p>
          </div>
          <button type="submit" disabled={creating} className={primaryButton + " w-full justify-center disabled:opacity-50"}>
            <UserRoundPlus size={16}/> {creating ? "Criando..." : "Criar manager"}
          </button>
        </form>
      </Panel>
    </div>
  </div>;
}
