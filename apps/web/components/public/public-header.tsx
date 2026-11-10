"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { BrandLogo } from "../brand/brand-provider";
import { apiFetch } from "../../lib/api";

type Session = { globalRole: string; memberships: Array<{ tenantId: string; role: string; tenant: { status: string } }> };
type Access = { client: string; barber: string };
const guest: Access = { client: "/login", barber: "/admin/login" };

export function PublicHeader({ active = "inicio" }: { active?: "inicio" | "mapa" | "contato" }) {
  const [access, setAccess] = useState<Access>(guest);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let live = true;
    apiFetch("/auth/me").then(async result => {
      if (!live || !result.ok) return;
      const session = await result.json() as Session;
      const membership = session.memberships.find(item =>
        ["ADMIN", "EMPLOYEE"].includes(item.role) && item.tenant.status === "ACTIVE");
      if (!live) return;
      setAccess({
        client: "/meus-agendamentos",
        barber: session.globalRole === "SYSTEM" ? "/system"
          : membership ? `/painel/barbearias/${membership.tenantId}` : "/admin/login",
      });
    }).catch(() => null);
    return () => { live = false; };
  }, []);

  const navLinks = [
    { label: "Início", href: "/", id: "inicio" },
    { label: "Mapa", href: "/mapa", id: "mapa" },
    { label: "Contato", href: "/contato", id: "contato" },
  ] as const;
  const itemClass = (id: string) =>
    `rounded-lg px-3 py-2 text-[13px] font-medium transition hover:text-[#141713] ${id === active ? "text-[#141713]" : "text-[#7a8077]"}`;

  return <header className="relative z-30 border-b border-[#e9eae5] bg-white">
    <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8 lg:h-[88px]">
      <Link href="/" aria-label="AICorta, página inicial" className="flex min-w-0 shrink-0 items-center">
        <BrandLogo className="h-12 max-w-[145px] sm:h-14 sm:max-w-[180px]"/>
      </Link>
      <nav aria-label="Navegação principal" className="hidden items-center gap-1 lg:flex">
        {navLinks.map(item => <Link key={item.id} href={item.href}
          aria-current={active === item.id ? "page" : undefined} className={itemClass(item.id)}>{item.label}</Link>)}
      </nav>
      <div className="hidden items-center gap-2 lg:flex">
        <Link href={access.client} className="rounded-xl px-3.5 py-3 text-[12px] font-semibold text-[#454b43] hover:bg-[#f5f6f2]">Entrar como Cliente</Link>
        <Link href={access.barber} className="inline-flex items-center gap-2 rounded-xl bg-[#1b1d19] px-4 py-3 text-[12px] font-semibold text-white hover:bg-[#33372f]">
          Entrar como Barbeiro <ArrowUpRight size={15}/>
        </Link>
      </div>
      <button type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuOpen} aria-controls="public-mobile-menu" onClick={() => setMenuOpen(v => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e6e9e2] text-[#20241f] lg:hidden">
        {menuOpen ? <X size={21}/> : <Menu size={21}/>}
      </button>
    </div>
    {menuOpen && <nav id="public-mobile-menu" aria-label="Menu mobile"
      className="absolute inset-x-0 top-full border-b border-[#e8ebe4] bg-white px-5 pb-5 pt-2 shadow-xl lg:hidden">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-1">
        {navLinks.map(item => <Link onClick={() => setMenuOpen(false)} key={item.id}
          aria-current={active === item.id ? "page" : undefined} href={item.href}
          className="rounded-lg px-3 py-3 text-sm font-semibold text-[#343a33] hover:bg-[#f6f7f3]">{item.label}</Link>)}
        <div className="mt-2 grid gap-2 border-t border-[#eceee9] pt-4 sm:grid-cols-2">
          <Link href={access.client} className="rounded-xl border border-[#dde1d8] px-4 py-3 text-center text-sm font-semibold">Entrar como Cliente</Link>
          <Link href={access.barber} className="rounded-xl bg-[#1b1d19] px-4 py-3 text-center text-sm font-semibold text-white">Entrar como Barbeiro</Link>
        </div>
      </div>
    </nav>}
  </header>;
}
