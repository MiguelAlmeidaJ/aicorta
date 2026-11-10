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
  return <footer className="border-t border-[#e4e7e0] bg-white text-[#242822]">
    <div className="mx-auto max-w-[1180px] px-5 pb-10 pt-14 sm:px-8 sm:pb-12 sm:pt-16">
      <div className="flex flex-col items-center text-center">
        <Link href="/" aria-label="AICorta — voltar ao início"
          className="flex min-h-[80px] items-center justify-center">
          <BrandLogo className="h-[75px] max-w-[245px] object-contain sm:h-[90px] sm:max-w-[305px]"/>
        </Link>
        <p className="mt-4 max-w-md text-[13px] leading-6 text-[#777e74]">
          Gestão inteligente para barbearias. Agendamento simples para quem cuida do seu estilo.
        </p>
        <div className="mt-5 h-px w-14 bg-[#d8b965]"/>
      </div>

      <div className="mx-auto mt-12 grid max-w-[730px] gap-10 border-t border-[#ebece8] pt-10 sm:grid-cols-2 sm:gap-24">
        <nav aria-label="Menu do rodapé" className="text-center sm:text-left">
          <h2 className="text-[11px] font-bold uppercase tracking-[.18em] text-[#8e7850]">Menu</h2>
          <ul className="mt-5 space-y-3">
            {navigation.map(item => <li key={item.href}>
              <Link href={item.href} className="inline-flex items-center gap-2 text-[13px] font-medium text-[#5c655a] transition hover:text-[#1f2820] hover:underline hover:underline-offset-4">
                {item.label}
              </Link>
            </li>)}
          </ul>
        </nav>
        <nav aria-label="Políticas e documentos legais" className="text-center sm:text-left">
          <h2 className="text-[11px] font-bold uppercase tracking-[.18em] text-[#8e7850]">Políticas</h2>
          <ul className="mt-5 space-y-3">
            {policies.map(item => <li key={item.href}>
              <Link href={item.href} className="inline-flex items-center gap-2 text-[13px] font-medium text-[#5c655a] transition hover:text-[#1f2820] hover:underline hover:underline-offset-4">
                {item.label}
              </Link>
            </li>)}
          </ul>
        </nav>
      </div>
    </div>
    <div className="border-t border-[#eceee8] bg-[#f7f8f5]">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-3 px-5 py-6 text-center sm:px-8">
        <p className="text-[12px] font-medium text-[#555e52]">
          AiCorta sistema de barbearias © {new Date().getFullYear()} - Todos os direitos reservados
        </p>
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12px] text-[#828a7e]">
          <span>Desenvolvido por</span>
          <a href="https://www.nivel3ti.com.br" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#3d483b] hover:underline hover:underline-offset-2">
            Nivel 3 TI <ArrowUpRight size={12}/>
          </a>
          <span aria-hidden="true" className="mx-1 text-[#b1b8ad]">|</span>
          <span>Dev -</span>
          <a href="https://instagram.com/miguelalmeida.dev" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[#3d483b] hover:underline hover:underline-offset-2">
            Miguel Almeida <ArrowUpRight size={12}/>
          </a>
        </p>
      </div>
    </div>
  </footer>;
}
