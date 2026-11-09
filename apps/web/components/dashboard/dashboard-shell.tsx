"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRightLeft, CalendarDays, ChevronDown, ChevronRight, ClipboardList,
  ImageIcon, LayoutDashboard, ListChecks, Menu, Scissors, Settings2, ShieldCheck,
  UsersRound, UserRoundPlus, WalletCards, X, type LucideIcon,
} from "lucide-react";
import { apiJson } from "../../lib/api";
import { BrandLogo } from "../brand/brand-provider";
import { UserMenu } from "../auth/user-menu";

type Membership = { tenantId: string; role: string; tenant: { name: string; slug: string; status: string } };
type Profile = { id: string; name: string; username: string; avatarUrl: string | null; globalRole: string; memberships: Membership[] };
type Item = { title: string; href: string; icon: LucideIcon; exact?: boolean };

export function DashboardShell({ children, mode, tenantId }: {
  children: ReactNode; mode: "system" | "tenant"; tenantId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [error, setError] = useState("");
  const membership = profile?.memberships.find(item => item.tenantId === tenantId);
  const base = mode === "system" ? "/system" : `/painel/barbearias/${tenantId}`;

  useEffect(() => {
    let alive = true;
    apiJson<Profile>("/auth/me").then(result => {
      if (!alive) return;
      if (mode === "system" && result.globalRole !== "SYSTEM") {
        router.replace("/painel"); return;
      }
      if (mode === "tenant" && !result.memberships.some(m =>
        m.tenantId === tenantId && ["ADMIN", "EMPLOYEE"].includes(m.role) && m.tenant.status === "ACTIVE")) {
        router.replace("/painel"); return;
      }
      setProfile(result);
      setBusy(false);
    }).catch(() => {
      if (alive) { setError("Não foi possível carregar sua sessão."); setBusy(false); }
    });
    return () => { alive = false; };
  }, [mode, tenantId, router]);

  function closeNavigation() {
    setMobileOpen(false);
    setShowSwitch(false);
  }

  const systemItems: Item[] = [
    { title: "Visão geral", href: "/system", icon: LayoutDashboard, exact: true },
    { title: "Barbearias", href: "/system/barbearias", icon: Scissors },
    { title: "Convites", href: "/system/convites", icon: UserRoundPlus },
    { title: "Identidade visual", href: "/system/configuracoes", icon: Settings2, exact: true },
    { title: "Padronização de imagens", href: "/system/configuracoes/imagens", icon: ImageIcon },
  ];
  const tenantItems: Item[] = [
    { title: "Visão geral", href: base, icon: LayoutDashboard, exact: true },
    { title: "Agenda", href: base + "/agenda", icon: CalendarDays },
    { title: "Atendimentos", href: base + "/atendimentos", icon: ListChecks },
    { title: "Caixa", href: base + "/caixa", icon: WalletCards },
    { title: "Serviços", href: base + "/servicos", icon: Scissors },
    { title: "Equipe", href: base + "/equipe", icon: UsersRound },
    { title: "Clientes", href: base + "/clientes", icon: ClipboardList },
    { title: "Configurações", href: base + "/configuracoes", icon: Settings2 },
  ];
  const items = mode === "system" ? systemItems : tenantItems.filter(item =>
    membership?.role === "ADMIN" || !["Serviços", "Equipe", "Configurações"].includes(item.title));
  const current = items.find(item => item.exact ? pathname === item.href : pathname.startsWith(item.href + "/") || pathname === item.href);
  const currentTitle = pathname.endsWith("/minha-conta") ? "Minha conta" : current?.title ?? "Painel";
  const availableMemberships = profile?.memberships.filter(m =>
    ["ADMIN", "EMPLOYEE"].includes(m.role) && m.tenant.status === "ACTIVE") ?? [];
  const canSwitchWorkspace = availableMemberships.length > 1;

  if (busy) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f4]">
    <div className="flex items-center gap-3 text-sm font-medium text-[#747a71]">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#dedfd9] border-t-[#121310]"/>
      Preparando seu espaço...
    </div>
  </div>;
  if (!profile) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f7f4]">
    <p className="text-sm text-[#777c73]">{error || "Acesso indisponível."}</p>
    <Link href="/admin/login" className="rounded-xl bg-[#161715] px-5 py-3 text-sm font-semibold text-white">Entrar novamente</Link>
  </div>;

  const links = <nav aria-label="Navegação principal" className="space-y-1">
    {items.map(item => {
      const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
        onClick={closeNavigation}
        className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-[13px] font-medium transition
          ${active ? "bg-[#24241e] text-[#f6f5ef] ring-1 ring-[#f2c225]/20"
          : "text-[#999d96] hover:bg-white/[.055] hover:text-[#f5f6f2]"}`}>
        {active && <span className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-[var(--brand-gold)]"/>}
        <item.icon size={18} strokeWidth={active ? 2.15 : 1.75} className={active ? "text-[var(--brand-gold)]" : ""}/>
        <span className="flex-1">{item.title}</span>
        {active && <ChevronRight size={14} className="opacity-60"/>}
      </Link>;
    })}
  </nav>;

  const sidebar = <div className="flex h-full min-h-0 flex-col">
    <Link href="/painel" className="group flex min-h-[105px] shrink-0 items-center border-b border-white/[.08] px-6 py-5">
      <BrandLogo dark className="h-[70px] w-[204px] origin-left transition group-hover:opacity-90"/>
    </Link>
    <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#777d74]">Menu principal</p>
      {links}
    </div>
    <div className="shrink-0 border-t border-white/[.08] px-7 py-5 text-[11px] text-[#747a72]">Versão {process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0"}</div>
  </div>;

  return <div className="min-h-screen bg-[#f6f7f4] text-[#161815]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] bg-[#0b0c0a] xl:block">{sidebar}</aside>
    {mobileOpen && <div className="fixed inset-0 z-50 xl:hidden">
      <button aria-label="Fechar navegação" className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)}/>
      <aside className="relative h-full w-[270px] bg-[#0b0c0a] shadow-2xl">
        <button aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white"><X size={20}/></button>
        {sidebar}
      </aside>
    </div>}
    <div className="min-h-screen xl:pl-[264px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#ecece7] bg-[#f8f8f5]/95 px-5 backdrop-blur-lg sm:px-8 lg:px-12">
        <div className="flex items-center gap-4">
          <button aria-label="Abrir menu" onClick={() => setMobileOpen(true)} className="rounded-xl border border-[#e2e4de] bg-white p-2.5 xl:hidden"><Menu size={20}/></button>
          <div className="hidden items-center gap-2 text-xs text-[#9a9e96] sm:flex">
            <span>{mode === "system" ? "Plataforma" : "Minha barbearia"}</span>
            <ChevronRight size={15}/>
            <span className="font-semibold text-[#333630]">{currentTitle}</span>
          </div>
          <span className="text-sm font-bold sm:hidden">{currentTitle}</span>
          {canSwitchWorkspace ? <div className="relative">
            <button type="button" aria-haspopup="menu" aria-expanded={showSwitch}
              onClick={() => setShowSwitch(value => !value)}
              className="flex max-w-56 items-center gap-2 rounded-xl border border-[#e4e6df] bg-white px-3 py-2 text-xs font-semibold text-[#40443d] transition hover:border-[#cfd2ca]">
              {mode === "system" ? <ShieldCheck size={15}/> : <Scissors size={15}/>}
              <span className="hidden truncate md:inline">{mode === "system" ? "AICorta Platform" : membership?.tenant.name ?? "Barbearia"}</span>
              <ChevronDown size={14} className="shrink-0 text-[#92978e]"/>
            </button>
            {showSwitch && <div role="menu" className="absolute right-0 top-[calc(100%+.5rem)] w-64 space-y-1 rounded-xl border border-[#e3e5df] bg-white p-2 shadow-xl md:left-0 md:right-auto">
              {profile.globalRole === "SYSTEM" && <Link role="menuitem" href="/system" onClick={closeNavigation}
                className="flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium text-[#3d413a] hover:bg-[#f2f3ef]"><ShieldCheck size={15}/> Administração global</Link>}
              {availableMemberships.map(m =>
                <Link role="menuitem" href={`/painel/barbearias/${m.tenantId}`} key={m.tenantId} onClick={closeNavigation}
                  className="flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium text-[#3d413a] hover:bg-[#f2f3ef]">
                  <ArrowRightLeft size={15}/><span className="truncate">{m.tenant.name}</span>
                </Link>)}
            </div>}
          </div> : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-[#e7e9e3] bg-white px-3.5 py-2 text-[11px] font-semibold text-[#70766d] sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5d8062]"/> Ambiente beta
          </span>
          <UserMenu profile={profile} loginHref="/admin/login"/>
        </div>
      </header>
      <main className="mx-auto max-w-[1560px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</main>
      <footer className="mx-auto max-w-[1560px] px-5 pb-8 text-[11px] text-[#a2a69f] sm:px-8 lg:px-10">© AICorta · Painel administrativo</footer>
    </div>
  </div>;
}
