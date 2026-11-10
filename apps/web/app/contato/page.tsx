"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Mail, Send } from "lucide-react";
import { PublicHeader } from "../../components/public/public-header";
import { PublicFooter } from "../../components/public/public-footer";
import { apiJson, mutation } from "../../lib/api";

type ContactSubject =
  | "Quero usar o AICorta"
  | "Dúvida sobre agendamento"
  | "Suporte à plataforma"
  | "Parceria ou comercial"
  | "Outro assunto";
type ContactData = {
  name: string; email: string; whatsapp: string;
  subject: ContactSubject; description: string; website: string;
};
const subjects: ContactSubject[] = [
  "Quero usar o AICorta", "Dúvida sobre agendamento",
  "Suporte à plataforma", "Parceria ou comercial", "Outro assunto",
];
const initial: ContactData = {
  name: "", email: "", whatsapp: "", subject: "Quero usar o AICorta",
  description: "", website: "",
};
const inputStyle = "mt-2 h-12 w-full rounded-xl border border-[#dfe4dc] bg-white px-4 text-[13px] text-[#262d25] outline-none transition focus:border-[#677862] focus:ring-2 focus:ring-[#677862]/10 placeholder:text-[#a0a89d]";

function whatsappMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  const isMobile = digits.length > 10;
  const part = isMobile ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, part)}-${digits.slice(part)}`;
}

export default function ContactPage() {
  const [values, setValues] = useState<ContactData>(initial);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function update(patch: Partial<ContactData>) {
    setValues(current => ({ ...current, ...patch }));
    if (error) setError("");
    if (success) setSuccess("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    if (values.whatsapp.replace(/\D/g, "").length < 10) {
      setError("Informe um número de WhatsApp com DDD."); return;
    }
    setSending(true); setError(""); setSuccess("");
    try {
      const response = await apiJson<{ message: string }>("/public/contact", mutation("POST", {
        ...values,
        name: values.name.trim(),
        email: values.email.trim(),
        description: values.description.trim(),
      }));
      setSuccess(response.message);
      setValues(initial);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "";
      setError(detail.includes("indisponível") || detail.includes("Não foi possível enviar")
        ? detail : "Não conseguimos enviar sua mensagem. Confira os campos e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return <main className="min-h-dvh bg-[#f7f8f5] text-[#252b23]">
    <PublicHeader active="contato"/>
    <div className="mx-auto w-full max-w-[1120px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
      <div className="max-w-[760px]">
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#998257]">Contato</p>
        <h1 className="mt-3 text-[clamp(2.1rem,4.2vw,3.4rem)] font-semibold tracking-[-.055em]">Fale com o AICorta</h1>
        <p className="mt-3 max-w-[630px] text-[14px] leading-7 text-[#788174]">
          Quer utilizar o AICorta na sua barbearia ou precisa de suporte? Preencha o formulário e envie sua mensagem para nossa equipe.
        </p>
      </div>

      <div id="para-barbearias" className="mt-9 grid scroll-mt-8 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(275px,.85fr)] lg:items-start">
        <section aria-labelledby="contact-form-title" className="rounded-[19px] border border-[#e0e5dc] bg-white p-5 shadow-[0_9px_35px_rgba(22,29,19,.035)] sm:p-8">
          <div className="border-b border-[#e8ebe5] pb-5">
            <h2 id="contact-form-title" className="text-[19px] font-semibold tracking-[-.025em]">Envie sua mensagem</h2>
            <p className="mt-1 text-[12px] text-[#8b9488]">Os campos marcados com * são obrigatórios.</p>
          </div>
          {success ? <div role="status" className="mt-5 flex items-start gap-3 rounded-xl border border-[#d7e8d5] bg-[#f1f7ef] p-4 text-[13px] leading-6 text-[#42653d]">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0"/><span>{success}</span>
          </div> : null}
          {error ? <div role="alert" className="mt-5 rounded-xl border border-[#f0d9d6] bg-[#fff3f1] px-4 py-3 text-[13px] leading-6 text-[#a0443c]">{error}</div> : null}
          <form onSubmit={submit} className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-[12px] font-semibold text-[#515c4e]">Nome completo *
                <input required minLength={2} maxLength={100} autoComplete="name" value={values.name}
                  onChange={event => update({name: event.target.value})}
                  placeholder="Seu nome" className={inputStyle}/>
              </label>
              <label className="block text-[12px] font-semibold text-[#515c4e]">E-mail *
                <input required type="email" maxLength={254} autoComplete="email" value={values.email}
                  onChange={event => update({email: event.target.value})}
                  placeholder="voce@exemplo.com" className={inputStyle}/>
              </label>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-[12px] font-semibold text-[#515c4e]">WhatsApp (DDD + número) *
                <input required type="tel" inputMode="tel" autoComplete="tel-national"
                  minLength={14} maxLength={15} value={values.whatsapp}
                  onChange={event => update({whatsapp: whatsappMask(event.target.value)})}
                  placeholder="(32) 99999-9999" className={inputStyle}/>
              </label>
              <label className="block text-[12px] font-semibold text-[#515c4e]">Assunto *
                <select required value={values.subject}
                  onChange={event => update({subject: event.target.value as ContactSubject})}
                  className={inputStyle + " cursor-pointer"}>
                  {subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-[12px] font-semibold text-[#515c4e]">Descrição *
              <textarea required minLength={10} maxLength={3000} rows={6}
                value={values.description} onChange={event => update({description:event.target.value})}
                placeholder="Conte um pouco sobre o que você precisa..."
                className="mt-2 block min-h-[145px] w-full resize-y rounded-xl border border-[#dfe4dc] bg-white p-4 text-[13px] leading-6 text-[#262d25] outline-none transition focus:border-[#677862] focus:ring-2 focus:ring-[#677862]/10 placeholder:text-[#a0a89d]"/>
            </label>
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>Site <input tabIndex={-1} autoComplete="off" name="website"
                value={values.website} onChange={event=>update({website:event.target.value})}/></label>
            </div>
            <div className="flex flex-col gap-4 border-t border-[#ebeee8] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[380px] text-[11px] leading-5 text-[#8b9588]">
                Seus dados serão usados para responder à solicitação. Consulte a{" "}
                <Link href="/politica-de-privacidade" className="font-semibold text-[#4a5d47] underline underline-offset-2">Política de Privacidade</Link>.
              </p>
              <button type="submit" disabled={sending}
                className="inline-flex min-h-[47px] w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1e241e] px-6 text-[13px] font-semibold text-white transition hover:bg-[#394238] disabled:cursor-wait disabled:opacity-60 sm:w-auto">
                {sending ? "Enviando..." : "Enviar mensagem"}<Send size={16}/>
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-5">
          <div className="rounded-[18px] border border-[#e1e6dd] bg-white p-6">
            <span className="text-[10px] font-bold uppercase tracking-[.15em] text-[#a18a5c]">Para barbearias</span>
            <h2 className="mt-3 text-[20px] font-semibold leading-snug tracking-[-.035em]">Quer usar o AICorta no seu estabelecimento?</h2>
            <p className="mt-3 text-[13px] leading-6 text-[#808a7c]">
              Selecione o assunto <strong className="font-semibold text-[#4c584a]">Quero usar o AICorta</strong> e conte sobre sua barbearia.
              Nossa equipe recebe a solicitação por e-mail.
            </p>
          </div>
          <div className="rounded-[18px] border border-[#e1e6dd] bg-white p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f3ed] text-[#52624e]"><Mail size={19}/></span>
            <h2 className="mt-4 text-[17px] font-semibold">Sobre agendamentos</h2>
            <p className="mt-2 text-[13px] leading-6 text-[#808a7c]">
              Para consultar ou cancelar uma reserva, acesse seus agendamentos. Para dúvidas específicas do atendimento,
              fale diretamente com a barbearia.
            </p>
            <Link href="/meus-agendamentos" className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold text-[#334230] hover:underline">
              Meus agendamentos <ArrowRight size={16}/>
            </Link>
          </div>
        </aside>
      </div>
    </div>
    <PublicFooter/>
  </main>;
}
