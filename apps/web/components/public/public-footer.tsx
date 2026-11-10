"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "../brand/brand-provider";

const navigation = [
  { label: "Início", href: "/" },
  { label: "Mapa", href: "/mapa" },
  { label: "Contato", href: "/contato" },
  { label: "Meus agendamentos", href: "/meus-agendamentos" },
];
const policies = [
  { label: "Privacidade e LGPD", href: "/politica-de-privacidade" },
  { label: "Política de cookies", href: "/politica-de-cookies" },
  { label: "Termos de uso", href: "/termos-de-uso" },
];

export function PublicFooter() {
  return <footer className="border-t border-[#e5e8e1] bg-white text-[#252b24]">
    <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-9 sm:grid-cols-[minmax(0,1.4fr)_1fr_1fr] sm:gap-10 sm:px-8 sm:py-11 lg:gap-16">
      <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
        <Link href="/" aria-label="AICorta — início" className="inline-flex items-center">
          <BrandLogo className="h-[54px] max-w-[190px] object-contain sm:h-[62px] sm:max-w-[215px]"/>
        </Link>
        <p className="mt-3 max-w-[265px] text-[12px] leading-5 text-[#858d80]">
          Gestão para barbearias e agendamentos sem complicação.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-8 sm:contents">
        <nav aria-label="Menu do rodapé" className="min-w-0">
          <h2 className="text-[11px] font-bold uppercase tracking-[.15em] text-[#9b8357]">Menu</h2>
          <ul className="mt-3 space-y-2">
            {navigation.map(item => <li key={item.href}>
              <Link href={item.href} className="text-[12px] leading-5 text-[#626c60] transition hover:text-[#222a21] hover:underline hover:underline-offset-4">{item.label}</Link>
            </li>)}
          </ul>
        </nav>
        <nav aria-label="Políticas do AICorta" className="min-w-0">
          <h2 className="text-[11px] font-bold uppercase tracking-[.15em] text-[#9b8357]">Políticas</h2>
          <ul className="mt-3 space-y-2">
            {policies.map(item => <li key={item.href}>
              <Link href={item.href} className="text-[12px] leading-5 text-[#626c60] transition hover:text-[#222a21] hover:underline hover:underline-offset-4">{item.label}</Link>
            </li>)}
          </ul>
        </nav>
      </div>
    </div>
    <div className="border-t border-[#edf0eb] bg-[#f8f9f6]">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-2 px-5 py-4 text-center sm:px-8 lg:flex-row lg:text-left">
        <p className="text-[11px] leading-5 text-[#778074]">
          AiCorta sistema de barbearias © {new Date().getFullYear()} - Todos os direitos reservados
        </p>
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] leading-5 text-[#818b7f] lg:justify-end">
          <span>Desenvolvido por</span>
          <a href="https://www.nivel3ti.com.br" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#424c40] hover:underline hover:underline-offset-2">
            Nivel 3 TI <ArrowUpRight size={11}/>
          </a>
          <span aria-hidden="true" className="text-[#b2b9ae]">|</span>
          <span>Dev -</span>
          <a href="https://instagram.com/miguelalmeida.dev" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#424c40] hover:underline hover:underline-offset-2">
            Miguel Almeida <ArrowUpRight size={11}/>
          </a>
        </p>
      </div>
    </div>
  </footer>;
}
