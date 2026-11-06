"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, CalendarCheck2, CalendarClock, Scissors, UsersRound, Wallet, UserRound, Clock4, Check, ChevronRight, Sparkles } from "lucide-react";
import { apiJson } from "../../../../lib/api";
import { dateTime, EmptyState, InlineLink, money, PageHeader, Panel, StatCard, StatusPill } from "../../../../components/dashboard/ui";

type Booking = { id: string; startsAt: string; status: string; priceCents: number;
  client: { name: string }; service: { name: string }; employee: { user: { name: string } } };
type Dashboard = { tenant: { name: string; slug: string; status: string; billingDueDay: number; timezone: string };
  appointmentsToday: number; pending: number; team: number; clients: number; services: number;
  completedRevenueCents: number; upcoming: Booking[]; actorRole: string;
  setup: { services: boolean; shopHours: boolean; professionalHours: boolean; assignedServices: boolean } };

export default function TenantOverview() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    apiJson<Dashboard>(`/tenants/${tenantId}/dashboard`)
      .then(value => { if (alive) setData(value); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [tenantId]);
  const base = `/painel/barbearias/${tenantId}`;
  const checklist = data ? [
    { label: "Cadastrar seu primeiro serviço", done: data.setup.services, href: base + "/servicos" },
    { label: "Configurar horário da barbearia", done: data.setup.shopHours, href: base + "/agenda/configuracao" },
    { label: "Definir jornada dos profissionais", done: data.setup.professionalHours, href: base + "/agenda/configuracao" },
    { label: "Vincular serviços aos profissionais", done: data.setup.assignedServices, href: base + "/agenda/configuracao" },
  ] : [];
  const completed = checklist.filter(item => item.done).length;
  return <>
    <PageHeader kicker="Minha barbearia / Overview"
      title={data ? `Bem-vindo à ${data.tenant.name}` : "Seu negócio, em um só lugar."}
      description="Acompanhe sua operação, organize a equipe e mantenha sua agenda em dia."
      action={<Link href={base + "/agenda"}
        className="inline-flex items-center gap-2 rounded-xl bg-[#151715] px-5 py-3 text-sm font-semibold text-white hover:bg-[#343634]">
        <CalendarClock size={17}/> Ver agenda <ArrowRight size={16}/>
      </Link>}/>
    {error && <p role="alert" className="mb-5 rounded-xl bg-[#faeeee] p-4 text-sm text-[#a54c45]">{error}</p>}
    {data?.actorRole === "ADMIN" && completed < checklist.length && <section className="mb-7 overflow-hidden rounded-[22px] border border-[#e8e4d5] bg-[#fbfaf5]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ece9df] px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-[#1b1c18] p-2.5 text-[#f2c225]"><Sparkles size={20}/></span>
          <div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#9a8647]">Comece por aqui</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">Prepare sua barbearia para receber reservas</h2>
            <p className="mt-1 text-xs text-[#888a80]">Conclua estas etapas para abrir horários na página pública.</p>
          </div>
        </div>
        <div className="min-w-[150px]">
          <p className="mb-2 text-right text-xs font-bold text-[#4d5047]">{completed} de {checklist.length} etapas</p>
          <div className="h-2 overflow-hidden rounded-full bg-[#e8e7df]">
            <div className="h-full rounded-full bg-[#1b1c18] transition-all" style={{ width: `${completed / checklist.length * 100}%` }}/>
          </div>
        </div>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {checklist.map((step, i) => <Link key={i} href={step.href}
          className="flex items-center gap-3 rounded-xl border border-[#eeede5] bg-white p-4 transition hover:border-[#d1c79b] hover:shadow-sm">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold
            ${step.done ? "bg-[#e8ece5] text-[#586c52]" : "bg-[#f3f1e7] text-[#9e8b53]"}`}>
            {step.done ? <Check size={16}/> : String(i + 1).padStart(2, "0")}
          </span>
          <span className={`flex-1 text-[13px] font-semibold ${step.done ? "text-[#73796f]" : "text-[#23251f]"}`}>{step.label}</span>
          {!step.done && <ChevronRight size={16} className="text-[#989c91]"/>}
        </Link>)}
      </div>
    </section>}
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <StatCard dark icon={CalendarCheck2} label="Agendamentos de hoje"
        value={data?.appointmentsToday ?? "—"} note="Reservas não canceladas"/>
      <StatCard icon={Clock4} label="Aguardando confirmação"
        value={data?.pending ?? "—"} note="Agendamentos futuros pendentes"/>
      <StatCard icon={UsersRound} label="Clientes vinculados"
        value={data?.clients ?? "—"} note="Com acesso ativo à barbearia"/>
      <StatCard icon={Wallet} label="Faturamento concluído no mês"
        value={data ? money(data.completedRevenueCents) : "—"} note="Somente serviços concluídos"/>
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
      <Panel title="Próximos agendamentos" description="Reservas futuras pendentes e confirmadas"
        right={<Link href={base + "/agenda"}><InlineLink>Ver agenda</InlineLink></Link>}>
        {!data ? <p className="py-10 text-center text-sm text-[#989c94]">Carregando agenda...</p> :
        data.upcoming.length === 0 ? <EmptyState icon={CalendarClock} title="Sua agenda está livre"
          description="Os próximos agendamentos aparecerão aqui assim que forem recebidos."/> :
        <div className="divide-y divide-[#f0f1ed]">{data.upcoming.map(booking =>
          <div key={booking.id} className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1f2ee] text-[#787e75]"><CalendarClock size={19}/></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{booking.client.name}</p>
              <p className="mt-1 truncate text-xs text-[#959a91]">{booking.service.name} · {booking.employee.user.name}</p>
            </div>
            <div className="text-right"><p className="mb-1.5 text-xs font-semibold">{dateTime(booking.startsAt, data.tenant.timezone)}</p>
              <StatusPill status={booking.status}/></div>
          </div>)}</div>}
      </Panel>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[22px] bg-[#1b1d1a] p-7 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#979c93]">Meu estabelecimento</p>
          <p className="mt-7 text-3xl font-bold tracking-[-.05em]">{data?.tenant.name ?? "AICorta"}</p>
          <p className="mt-2 text-xs text-[#a2a79d]">/b/{data?.tenant.slug ?? "..."}</p>
          <div className="mt-7 flex items-center gap-3 border-t border-white/10 pt-5">
            <Scissors size={16}/><span className="text-sm">{data?.services ?? "—"} serviços ativos</span>
            <span className="mx-1 text-white/25">|</span>
            <UserRound size={16}/><span className="text-sm">{data?.team ?? "—"} profissionais</span>
          </div>
          {data && <Link href={`/b/${data.tenant.slug}`} className="mt-7 inline-flex items-center gap-2 text-xs font-semibold hover:underline">
            Abrir página pública <ArrowRight size={15}/>
          </Link>}
        </section>
        <Panel title="Acesso rápido" description="Gestão do dia a dia">
          <div className="space-y-2">
            {[
              { title: "Gerenciar serviços", href: base + "/servicos", icon: Scissors },
              { title: "Equipe e convites", href: base + "/equipe", icon: UsersRound },
              { title: "Configurações", href: base + "/configuracoes", icon: Clock4 },
            ].map(item => <Link href={item.href} key={item.href}
              className="flex items-center justify-between rounded-xl bg-[#f5f6f2] px-4 py-3.5 text-xs font-semibold transition hover:bg-[#eceee8]">
              <span className="flex items-center gap-2"><item.icon size={16}/>{item.title}</span><ArrowRight size={16}/>
            </Link>)}
          </div>
        </Panel>
      </div>
    </div>
  </>;
}
