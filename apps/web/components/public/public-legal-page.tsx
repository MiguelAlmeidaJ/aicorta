import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";

export type LegalSection = { heading: string; body: string[] };
export function PublicLegalPage({ eyebrow, title, intro, sections }: {
  eyebrow: string; title: string; intro: string; sections: LegalSection[];
}) {
  return <main className="flex min-h-dvh flex-col bg-[#f7f8f5] text-[#252b23]">
    <PublicHeader/>
    <div className="mx-auto w-full max-w-[940px] flex-1 px-5 pb-20 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#758071] hover:text-[#303a2e]">
        <ArrowLeft size={15}/> Voltar ao início
      </Link>
      <div className="mt-10 border-b border-[#dfe5dc] pb-10">
        <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-[#947c50]"><FileText size={15}/>{eyebrow}</p>
        <h1 className="mt-4 text-[clamp(2.2rem,4.5vw,3.4rem)] font-semibold tracking-[-.06em]">{title}</h1>
        <p className="mt-5 max-w-[720px] text-[14px] leading-7 text-[#737e70]">{intro}</p>
      </div>
      <div className="mt-9 space-y-8 rounded-[22px] border border-[#e4e9df] bg-white px-6 py-9 sm:px-11 sm:py-12">
        {sections.map((section,index)=><section key={section.heading}>
          <h2 className="flex items-start gap-3 text-[17px] font-semibold tracking-[-.025em]">
            <span className="mt-0.5 text-[11px] font-bold text-[#b09564]">{String(index+1).padStart(2,"0")}</span>
            {section.heading}
          </h2>
          <div className="mt-3 space-y-3 pl-7">
            {section.body.map(paragraph=><p key={paragraph} className="text-[13px] leading-7 text-[#677266]">{paragraph}</p>)}
          </div>
        </section>)}
        <div className="rounded-xl bg-[#f4f6f1] px-5 py-4 text-[12px] leading-6 text-[#697468]">
          Dúvidas sobre este documento? Utilize os canais oficiais disponíveis na página de{" "}
          <Link href="/contato" className="font-semibold text-[#303d30] underline underline-offset-4">Contato</Link>.
        </div>
      </div>
    </div>
    <PublicFooter/>
  </main>;
}
