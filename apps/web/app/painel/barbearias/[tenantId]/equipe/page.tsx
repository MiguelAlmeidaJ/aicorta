"use client";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Copy, Plus, UsersRound, UserRoundPlus } from "lucide-react";
import { apiJson, mutation } from "../../../../../lib/api";
import { EmptyState, fieldClass, PageHeader, Panel, primaryButton, secondaryButton, StatusPill } from "../../../../../components/dashboard/ui";

type Member = { id: string; isActive: boolean; role: string; user: { name: string; email: string; username: string; whatsapp: string } };
type Invite = { id: string; email: string; role: string; acceptedAt: string | null; revokedAt: string | null; expiresAt: string };
type Issued = { token: string; acceptanceUrl: string };
export default function TeamPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = async () => {
    const [staff, pending] = await Promise.all([
      apiJson<Member[]>(`/tenants/${tenantId}/employees`),
      apiJson<Invite[]>(`/tenants/${tenantId}/invitations`),
    ]);
    setMembers(staff); setInvites(pending);
  };
  useEffect(() => {
    let active = true;
    Promise.all([
      apiJson<Member[]>(`/tenants/${tenantId}/employees`),
      apiJson<Invite[]>(`/tenants/${tenantId}/invitations`),
    ]).then(([staff, pending]) => {
      if (!active) return;
      setMembers(staff); setInvites(pending);
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Erro ao carregar equipe"); });
    return () => { active = false; };
  }, [tenantId]);
  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError(""); setMessage(""); setInviteLink("");
    try {
      const created = await apiJson<Issued>(`/tenants/${tenantId}/invitations`, mutation("POST",
        { email, role: "EMPLOYEE" }));
      setInviteLink(created.acceptanceUrl); setEmail(""); setMessage("Convite criado. Compartilhe o link para o profissional entrar ou criar a conta.");
      await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Erro ao convidar"); }
    finally { setSaving(false); }
  }
  async function deactivate(member: Member) {
    if (!window.confirm(`Desativar acesso de ${member.user.name}?`)) return;
    try {
      await apiJson(`/tenants/${tenantId}/employees/${member.id}/deactivate`, { method: "PATCH" });
      setMessage("Acesso do colaborador desativado."); await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Falha ao desativar"); }
  }
  return <>
    <PageHeader kicker="Gestão / Pessoas" title="Equipe"
      description="Gerencie os profissionais e convide colaboradores, mesmo que ainda não tenham conta."/>
    {error && <p role="alert" className="mb-5 rounded-xl bg-[#faeeee] p-4 text-sm text-[#a14740]">{error}</p>}
    {message && <p role="status" className="mb-5 rounded-xl bg-[#eaf1e8] p-4 text-sm text-[#48654b]">{message}</p>}
    <div className="grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
      <Panel title="Profissionais" description={`${members.length} colaborador(es)`}>
        {members.length === 0 ? <EmptyState icon={UsersRound} title="Nenhum funcionário vinculado"
          description="Convide sua equipe para compartilhar os agendamentos da barbearia."/> :
        <div className="divide-y divide-[#f0f1ed]">{members.map(member =>
          <div key={member.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eff0ec] text-sm font-bold">
              {member.user.name.trim().charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{member.user.name}</p>
              <p className="mt-1 truncate text-xs text-[#92978f]">{member.user.email}</p></div>
            <StatusPill status={member.isActive ? "ACTIVE" : "SUSPENDED"}/>
            {member.isActive && <button className={secondaryButton} onClick={() => void deactivate(member)}>Desativar</button>}
          </div>)}</div>}
      </Panel>
      <div className="space-y-6">
        <Panel title="Convidar profissional" description="Convite com token de uso único">
          <form onSubmit={invite} className="space-y-4">
            <label className="block text-xs font-semibold text-[#596057]">E-mail do profissional
              <input className={fieldClass + " mt-2"} type="email" required value={email}
                placeholder="profissional@email.com" onChange={e => setEmail(e.target.value)}/></label>
            <p className="text-xs leading-5 text-[#90958c]">Se ainda não tiver conta, o profissional poderá criá-la pelo próprio link.</p>
            <button className={primaryButton + " w-full"} disabled={saving}>
              <Plus size={17}/>{saving ? "Enviando..." : "Gerar convite"}
            </button>
          </form>
          {inviteLink && <div className="mt-5 rounded-xl bg-[#f1f4ef] p-4">
            <p className="mb-2 text-xs font-semibold">Link gerado (exibido uma vez)</p>
            <input value={inviteLink} readOnly onFocus={e => e.currentTarget.select()} className={fieldClass}/>
            <button className={secondaryButton + " mt-3 w-full"} onClick={() => void navigator.clipboard.writeText(inviteLink)}>
              <Copy size={15}/> Copiar link</button>
          </div>}
        </Panel>
        <Panel title="Convites recentes" description="Acompanhamento de aceites">
          {invites.length === 0 ? <EmptyState icon={UserRoundPlus} title="Nenhum convite"
            description="Os convites emitidos aparecerão aqui."/> :
            <div className="space-y-3">{invites.filter(item => item.role === "EMPLOYEE").slice(0, 6).map(item =>
              <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-[#636860]">{item.email}</span>
                <StatusPill status={item.acceptedAt ? "Utilizado" : item.revokedAt ? "Revogado" :
                  new Date(item.expiresAt) < new Date() ? "Expirado" : "Pendente"}/>
              </div>)}</div>}
        </Panel>
      </div>
    </div>
  </>;
}
