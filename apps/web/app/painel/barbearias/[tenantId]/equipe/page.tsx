"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Search, UserPlus, UsersRound } from "lucide-react";
import { apiJson, mutation } from "../../../../../lib/api";
import { EmptyState, fieldClass, PageHeader, Panel, primaryButton, secondaryButton, StatusPill } from "../../../../../components/dashboard/ui";

type Member = {
  id: string; isActive: boolean; role: string;
  user: { name: string; email: string; username: string; whatsapp: string };
};
type Lookup = {
  exists: boolean; email: string; canLink?: boolean; reason?: string | null;
  user?: { name: string; email: string; username: string };
  membership?: { role: string; isActive: boolean } | null;
};
const emptyAccount = { name: "", username: "", whatsapp: "", password: "" };

export default function TeamPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [account, setAccount] = useState(emptyAccount);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    apiJson<Member[]>(`/tenants/${tenantId}/employees`).then(staff => {
      if (active) setMembers(staff);
    }).catch(loadError => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Erro ao carregar equipe");
    });
    return () => { active = false; };
  }, [tenantId]);

  function changeEmail(value: string) {
    setEmail(value); setLookup(null); setAccount(emptyAccount); setError(""); setMessage("");
  }

  async function searchAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSearching(true); setError(""); setMessage("");
    try {
      const result = await apiJson<Lookup>(`/tenants/${tenantId}/employees/lookup?email=${encodeURIComponent(email.trim())}`);
      setLookup(result);
    } catch (searchError) {
      setLookup(null);
      setError(searchError instanceof Error ? searchError.message : "Não foi possível procurar o e-mail.");
    } finally { setSearching(false); }
  }

  async function addEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lookup || (lookup.exists && !lookup.canLink)) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = lookup.exists ? { email: lookup.email } : { email: lookup.email, ...account };
      const created = await apiJson<Member>(`/tenants/${tenantId}/employees`, mutation("POST", payload));
      setMembers(current => [created, ...current.filter(item => item.id !== created.id)]);
      setMessage(lookup.exists ? `${created.user.name} foi vinculado à equipe.` :
        `Acesso de ${created.user.name} criado e vinculado à equipe.`);
      setEmail(""); setLookup(null); setAccount(emptyAccount);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível adicionar o profissional.");
    } finally { setSaving(false); }
  }

  async function deactivate(member: Member) {
    if (!window.confirm(`Desativar acesso de ${member.user.name}?`)) return;
    setError(""); setMessage("");
    try {
      await apiJson(`/tenants/${tenantId}/employees/${member.id}/deactivate`, { method: "PATCH" });
      setMembers(current => current.map(item => item.id === member.id ? { ...item, isActive: false } : item));
      setMessage("Acesso do colaborador desativado.");
    } catch (deactivateError) {
      setError(deactivateError instanceof Error ? deactivateError.message : "Falha ao desativar");
    }
  }

  return <>
    <PageHeader kicker="Gestão / Pessoas" title="Equipe"
      description="Cadastre profissionais ou vincule uma conta existente diretamente à barbearia."/>
    {error ? <p role="alert" className="mb-5 rounded-xl bg-[#faeeee] p-4 text-sm text-[#a14740]">{error}</p> : null}
    {message ? <p role="status" className="mb-5 rounded-xl bg-[#eaf1e8] p-4 text-sm text-[#48654b]">{message}</p> : null}
    <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <Panel title="Profissionais" description={`${members.length} colaborador(es)`}>
        {members.length === 0 ? <EmptyState icon={UsersRound} title="Nenhum funcionário vinculado"
          description="Procure uma conta por e-mail ou crie o primeiro acesso da equipe."/> :
        <div className="divide-y divide-[#f0f1ed]">{members.map(member =>
          <div key={member.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eff0ec] text-sm font-bold">
              {member.user.name.trim().charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{member.user.name}</p>
              <p className="mt-1 truncate text-xs text-[#92978f]">{member.user.email} · @{member.user.username}</p></div>
            <StatusPill status={member.isActive ? "ACTIVE" : "SUSPENDED"}/>
            {member.isActive ? <button type="button" className={secondaryButton} onClick={() => void deactivate(member)}>Desativar</button> : null}
          </div>)}</div>}
      </Panel>

      <Panel title="Adicionar profissional" description="Comece procurando o e-mail da pessoa">
        <form onSubmit={searchAccount} className="space-y-4">
          <label className="block text-xs font-semibold text-[#596057]">E-mail do profissional
            <input className={fieldClass + " mt-2"} type="email" required autoComplete="email" value={email}
              placeholder="profissional@email.com" onChange={event => changeEmail(event.target.value)}/>
          </label>
          <button type="submit" className={secondaryButton + " w-full"} disabled={searching || !email.trim()}>
            <Search size={16}/>{searching ? "Procurando..." : "Procurar conta"}
          </button>
        </form>

        {lookup ? <form onSubmit={addEmployee} className="mt-6 border-t border-[#eceee8] pt-6">
          {lookup.exists && lookup.user ? <div className="rounded-xl border border-[#e1e4dc] bg-[#f7f8f4] p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#586057]"><CheckCircle2 size={18}/></span>
              <div className="min-w-0"><p className="text-sm font-bold">{lookup.user.name}</p>
                <p className="mt-1 truncate text-xs text-[#777d74]">@{lookup.user.username} · {lookup.user.email}</p>
                <p className="mt-3 text-xs leading-5 text-[#777d74]">{lookup.canLink
                  ? lookup.membership?.role === "CLIENT" ? "Conta de cliente encontrada. O vínculo será alterado para profissional." :
                    lookup.membership?.role === "EMPLOYEE" ? "Funcionário inativo encontrado. O acesso será reativado." :
                    "Conta encontrada e pronta para ser vinculada."
                  : lookup.reason}</p></div>
            </div>
          </div> : <div className="space-y-4">
            <p className="text-xs leading-5 text-[#777d74]">Nenhuma conta encontrada. Preencha os dados para criar o acesso do profissional.</p>
            <label className="block text-xs font-semibold text-[#596057]">Nome completo
              <input required minLength={2} maxLength={100} autoComplete="name" className={fieldClass + " mt-2"}
                value={account.name} onChange={event => setAccount(current => ({ ...current, name: event.target.value }))}/>
            </label>
            <label className="block text-xs font-semibold text-[#596057]">Nome de usuário
              <input required minLength={3} maxLength={30} pattern="[a-z0-9]+" autoComplete="username" className={fieldClass + " mt-2"}
                value={account.username} onChange={event => setAccount(current => ({ ...current,
                  username: event.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") }))}/>
            </label>
            <label className="block text-xs font-semibold text-[#596057]">WhatsApp
              <input required inputMode="tel" autoComplete="tel" className={fieldClass + " mt-2"} placeholder="(32) 99999-9999"
                value={account.whatsapp} onChange={event => setAccount(current => ({ ...current, whatsapp: event.target.value }))}/>
            </label>
            <label className="block text-xs font-semibold text-[#596057]">Senha inicial
              <input required type="password" minLength={10} maxLength={128} autoComplete="new-password" className={fieldClass + " mt-2"}
                value={account.password} onChange={event => setAccount(current => ({ ...current, password: event.target.value }))}/>
            </label>
          </div>}
          {lookup.exists && !lookup.canLink ? null : <button type="submit" className={primaryButton + " mt-5 w-full"} disabled={saving}>
            <UserPlus size={17}/>{saving ? "Salvando..." : lookup.exists ? "Vincular à equipe" : "Criar acesso e adicionar"}
          </button>}
        </form> : <p className="mt-5 border-t border-[#eceee8] pt-5 text-xs leading-5 text-[#8b9088]">
          A busca é exata e não exibe uma lista de usuários. Se não houver conta, o cadastro será feito aqui mesmo.
        </p>}
      </Panel>
    </div>
  </>;
}
