"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, CirclePause, ClipboardCheck, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { apiJson } from "../../lib/api";
import { EmptyState, InlineLink, PageHeader, Panel, shortDate, StatCard, StatusPill } from "../../components/dashboard/ui";

type Tenant = { id: string; name: string; slug: string; status: string; createdAt: string;
  billingDueDay: number; owner: { name: string; email: string } };
type Data = { tenants: number; active: number; suspended: number; users: number; pendingInvites: number; recent: Tenant[] };

export default function SystemHome() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let alive = true;
    apiJson<Data>("/system/dashboard").then(value => { if (alive) setData(value); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);
  return <>
    <PageHeader kicker="Administração global / Overview" title="Visão geral da plataforma"
      description="Acompanhe as barbearias, o acesso à plataforma e o onboarding de novos parceiros."
      action={<Link href="/system/convites" className="inline-flex items-center gap-2 rounded-xl bg-[#171916] px-5 py-3 text-sm font-semibold text-white hover:bg-[#353732]">
        <Plus size={17}/> Novo convite
      </Link>}/>
    {error && <p role="alert" className="mb-6 rounded-xl bg-[#f6e8e6] px-4 py-3 text-sm text-[#93483f]">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <StatCard dark icon={Building2} label="Total de barbearias" value={data?.tenants ?? "—"} note="Estabelecimentos cadastrados"/>
      <StatCard icon={ShieldCheck} label="Barbearias ativas" value={data?.active ?? "—"} note="Com acesso liberado"/>
      <StatCard icon={CirclePause} label="Acesso suspenso" value={data?.suspended ?? "—"} note="Estabelecimentos suspensos"/>
      <StatCard icon={UsersRound} label="Usuários da plataforma" value={data?.users ?? "—"} note="Contas de usuários"/>
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Panel title="Barbearias recentes" description="Últimos estabelecimentos adicionados à plataforma"
        right={<Link href="/system/barbearias"><InlineLink>Ver todas</InlineLink></Link>}>
        {!data ? <p className="py-10 text-center text-sm text-[#92968e]">Carregando dados...</p> :
          data.recent.length === 0 ? <EmptyState icon={Building2} title="Nenhuma barbearia ainda"
            description="Crie um convite para começar a cadastrar estabelecimentos."/> :
          <div className="divide-y divide-[#f1f2ee]">
            {data.recent.map(tenant => <div key={tenant.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2f3ef] text-[#777c74]"><Building2 size={19}/></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#20221f]">{tenant.name}</p>
                <p className="mt-1 truncate text-xs text-[#989d94]">{tenant.owner.name} · {shortDate(tenant.createdAt)}</p>
              </div>
              <StatusPill status={tenant.status}/>
            </div>)}
          </div>}
      </Panel>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[22px] bg-[#191b18] p-7 text-white">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border-[30px] border-white/[.04]"/>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><ClipboardCheck size={21}/></span>
          <p className="mt-8 text-sm text-[#abb0a7]">Convites aguardando cadastro</p>
          <p className="mt-2 text-5xl font-bold tracking-[-.06em]">{data?.pendingInvites ?? "—"}</p>
          <Link href="/system/convites" className="mt-7 inline-flex items-center gap-2 text-xs font-semibold text-white hover:underline">
            Gerenciar convites <ArrowRight size={15}/>
          </Link>
        </section>
        <Panel title="Operação" description="Ações frequentes">
          <div className="space-y-2">
            <Link href="/system/barbearias" className="flex items-center justify-between rounded-xl bg-[#f6f7f4] p-4 text-sm font-semibold hover:bg-[#ecede9]">
              Gerenciar acesso das barbearias <ArrowRight size={17}/>
            </Link>
            <Link href="/system/convites" className="flex items-center justify-between rounded-xl bg-[#f6f7f4] p-4 text-sm font-semibold hover:bg-[#ecede9]">
              Emitir convite de proprietário <ArrowRight size={17}/>
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  </>;
}
