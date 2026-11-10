import Link from "next/link";
import { ArrowRight, Mail, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { PublicHeader } from "../../components/public/public-header";
import { PublicFooter } from "../../components/public/public-footer";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";
const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "") ?? "";

export default function ContactPage() {
  return <main className="min-h-dvh bg-[#f6f6f3] text-[#1d211c]">
    <PublicHeader active="contato"/>
    <section className="mx-auto max-w-[1120px] px-5 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-20">
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#9c8253]">Central de contato</p>
      <h1 className="mt-4 max-w-[700px] text-[clamp(2.4rem,5vw,4.1rem)] font-semibold leading-[1.12] tracking-[-.06em]">Como podemos ajudar?</h1>
      <p className="mt-5 max-w-[650px] text-[15px] leading-7 text-[#7c8378]">
        Encontre o melhor canal de atendimento para sua dúvida, seja sobre uma reserva ou sobre o acesso à plataforma.
      </p>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <article className="flex flex-col rounded-2xl border border-[#e3e7df] bg-white p-6 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1f3ee] text-[#4e5e4c]"><MapPin size={22}/></span>
          <h2 className="mt-6 text-[20px] font-semibold tracking-tight">Sobre seu agendamento</h2>
          <p className="mt-3 flex-1 text-[13px] leading-6 text-[#818a7e]">
            Para confirmar endereço, disponibilidade e detalhes do atendimento, consulte a página da barbearia.
            Para acompanhar ou cancelar reservas, acesse sua área de cliente.
          </p>
          <Link href="/meus-agendamentos" className="mt-7 inline-flex items-center gap-2 text-[13px] font-semibold text-[#262d24] hover:underline">
            Acessar meus agendamentos <ArrowRight size={16}/>
          </Link>
        </article>
        <article className="flex flex-col rounded-2xl border border-[#e3e7df] bg-white p-6 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f1f3ee] text-[#4e5e4c]"><ShieldCheck size={22}/></span>
          <h2 className="mt-6 text-[20px] font-semibold tracking-tight">Suporte ao AICorta</h2>
          <p className="mt-3 text-[13px] leading-6 text-[#818a7e]">
            Dúvidas sobre acesso, utilização da plataforma ou cadastro de estabelecimentos?
            Entre em contato pelos canais oficiais disponíveis.
          </p>
          {supportEmail || supportPhone ? <div className="mt-6 space-y-2">
            {supportEmail && <a href={`mailto:${supportEmail}`} className="flex items-center gap-3 rounded-xl border border-[#e5e8e1] px-4 py-3 text-sm font-medium hover:bg-[#f8faf6]">
              <Mail size={17} className="text-[#6b7667]"/><span className="min-w-0 break-all">{supportEmail}</span>
            </a>}
            {supportPhone && <a href={`https://wa.me/${supportPhone}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-[#e5e8e1] px-4 py-3 text-sm font-medium hover:bg-[#f8faf6]">
              <MessageCircle size={17} className="text-[#6b7667]"/> Conversar pelo WhatsApp
            </a>}
          </div> : <p className="mt-6 rounded-xl bg-[#f5f6f2] px-4 py-3 text-[12px] leading-5 text-[#8b9388]">
            Os canais públicos de suporte ainda não foram configurados. Se recebeu um convite para a plataforma,
            utilize o contato informado pelo responsável pelo convite.
          </p>}
        </article>
      </div>
    </section>
    <PublicFooter/>
  </main>;
}
