"use client";

import { BrandLogo } from "../../components/brand/brand-provider";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, ChevronRight,
  Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const inputClass =
  "mt-2 block h-12 w-full min-w-0 rounded-xl border border-[#dfe2dc] bg-[#fbfcfa] px-4 text-[14px] text-[#151714] shadow-sm shadow-black/[0.015] outline-none transition placeholder:text-[#a3a8a0] hover:border-[#c6cac2] focus:border-[#171917] focus:bg-white focus:ring-[3px] focus:ring-[#171917]/[0.07] disabled:opacity-60";
const labelClass = "block min-w-0 text-[12px] font-semibold text-[#373c35]";

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? "(" + digits : "";
  if (digits.length <= 7) return "(" + digits.slice(0, 2) + ") " + digits.slice(2);
  return "(" + digits.slice(0, 2) + ") " + digits.slice(2, 7) + "-" + digits.slice(7);
}

function RegistrationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#f3f4f0] text-[#151715] lg:grid lg:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
      <aside className="relative isolate overflow-hidden bg-[#151715] text-white lg:flex lg:min-h-dvh lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-52 h-[460px] w-[460px] rounded-full border border-white/[0.06] lg:h-[700px] lg:w-[700px]"/>
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-56 -left-52 hidden h-[560px] w-[560px] rounded-full border border-white/[0.06] lg:block"/>
        <div className="relative mx-auto flex w-full max-w-[590px] items-center justify-between px-6 py-5 sm:px-10 lg:px-12 lg:pt-12">
          <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-black tracking-[-0.045em] text-white" aria-label="AICorta, voltar ao início">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-[#f2c225]"><Sparkles size={19}/></span>
            AICORTA<span className="text-[#f2c225]">.</span>
          </Link>
          <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">
            Acesso por convite
          </span>
        </div>

        <div className="relative mx-auto w-full max-w-[590px] px-6 pb-7 pt-5 sm:px-10 lg:px-12 lg:py-16">
          <div className="mb-6 hidden h-12 w-12 items-center justify-center rounded-2xl border border-[#f2c225]/25 bg-[#f2c225]/10 text-[#f2c225] lg:flex">
            <Building2 size={24}/>
          </div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#e6c75d]">Seu negócio começa aqui</p>
          <h2 className="max-w-[500px] text-[clamp(2rem,4vw,3.85rem)] font-extrabold leading-[1.08] tracking-[-0.065em]">
            Mais organização.<br/><span className="text-[#b3b9ae]">Mais tempo para</span><br className="hidden lg:block"/> o que importa.
          </h2>
          <p className="mt-5 max-w-[420px] text-[13px] leading-6 text-[#b6bbb4] lg:text-[15px] lg:leading-7">
            Centralize sua agenda, equipe e atendimentos em um só lugar. Configure sua barbearia e comece a trabalhar com mais tranquilidade.
          </p>
          <div className="mt-11 hidden space-y-7 lg:block">
            {[
              ["01", "Crie seu acesso", "Seus dados ficam vinculados ao convite."],
              ["02", "Cadastre a barbearia", "Dê um nome ao seu estabelecimento."],
              ["03", "Personalize seu espaço", "Serviços, equipe e horários no painel."],
            ].map(([number, title, subtitle], index) => (
              <div key={number} className="flex items-start gap-4">
                <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold " + (index === 0 ? "bg-[#f2c225] text-[#171715]" : "border border-white/15 bg-white/[0.05] text-[#b2b8ae]")}>{number}</span>
                <div><p className="text-[14px] font-semibold">{title}</p><p className="mt-1 text-[12px] text-white/45">{subtitle}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto hidden w-full max-w-[590px] items-center gap-2 px-12 pb-12 text-xs text-white/45 lg:flex">
          <ShieldCheck size={16} className="text-[#e6c75d]"/> Seu estabelecimento, seus dados, seu controle.
        </div>
      </aside>

      <section className="flex min-w-0 items-start justify-center px-4 py-6 sm:px-8 sm:py-10 lg:min-h-dvh lg:items-center lg:px-10 lg:py-14 xl:px-16">
        <div className="w-full max-w-[660px]">{children}</div>
      </section>
    </main>
  );
}

function InviteRegistration() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [valid, setValid] = useState(false);
  const [checking, setChecking] = useState(Boolean(token));
  const [status, setStatus] = useState("");
  const [username, setUsername] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) return;
    fetch(`${API}/auth/owner-invites/verify?token=${encodeURIComponent(token)}`)
      .then(async response => {
        if (!response.ok) throw new Error("Convite inválido, expirado ou já utilizado.");
        return response.json();
      })
      .then(() => { if (active) setValid(true); })
      .catch(error => { if (active) setStatus(error instanceof Error ? error.message : "Convite inválido"); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || busy) return;
    setStatus(""); setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`${API}/auth/register`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, username, whatsapp: whatsapp.replace(/\D/g, ""), inviteToken: token }),
      });
      if (!response.ok) {
        const problem = await response.json();
        throw new Error(Array.isArray(problem.message) ? problem.message.join("; ") : problem.message ?? "Falha no cadastro");
      }
      router.replace("/painel");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível cadastrar");
    } finally { setBusy(false); }
  }

  return <RegistrationShell>
    <div className="overflow-hidden rounded-[24px] border border-[#e3e5df] bg-white shadow-[0_22px_65px_rgba(18,22,16,0.055)] sm:rounded-[28px]">
      <div className="px-5 pt-7 sm:px-9 sm:pt-9 xl:px-11 xl:pt-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" aria-label="Voltar ao início" className="inline-flex items-center rounded-lg p-1 text-[#777d74] transition hover:bg-[#f3f4f0] hover:text-[#151715] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"><ArrowLeft size={19}/></Link>
          <BrandLogo className="h-9 max-w-[146px] sm:h-10 sm:max-w-[170px]"/>
        </div>
        <div className="mt-8 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eceee8] text-[#30382e]"><BadgeCheck size={15}/></span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#737c70]">Cadastro de estabelecimento</span>
        </div>
        <h1 className="mt-3 text-[29px] font-extrabold leading-[1.13] tracking-[-0.055em] text-[#161815] sm:text-[36px]">Vamos criar sua barbearia.</h1>
        <p className="mt-3 max-w-[490px] text-[13px] leading-6 text-[#7b8178] sm:text-[14px]">
          Primeiro, precisamos conhecer você e seu negócio. Leva só alguns minutos.
        </p>
      </div>

      {checking ? (
        <div role="status" aria-live="polite" className="mx-5 my-8 flex items-center gap-3 rounded-xl bg-[#f5f6f3] px-4 py-5 text-sm text-[#60675d] sm:mx-9 xl:mx-11">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#bec3b9] border-t-[#181a17]"/> Validando seu convite...
        </div>
      ) : !valid ? (
        <div className="px-5 pb-8 pt-7 sm:px-9 xl:px-11">
          <div className="rounded-2xl border border-[#e5e8e0] bg-[#f6f7f4] p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#343a32]"><LockKeyhole size={19}/></div>
            <h2 className="text-base font-bold">Cadastro disponível por convite</h2>
            <p className="mt-2 text-sm leading-6 text-[#747c70]">A criação de barbearias é liberada pelo administrador do AICorta. Utilize o link recebido para continuar.</p>
            {status && <p role="alert" className="mt-4 rounded-lg bg-[#fcefee] p-3 text-[13px] text-[#9d403d]">{status}</p>}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="px-5 pb-7 pt-8 sm:px-9 sm:pb-9 xl:px-11 xl:pb-10">
          <div className="flex items-center gap-3 border-b border-[#edf0e9] pb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0f2ed] text-[#3d473b]"><UserRound size={17}/></span>
            <div><h2 className="text-sm font-bold">Seus dados</h2><p className="text-[11px] text-[#939a90]">Informações da conta administradora</p></div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <label className={labelClass}>Nome completo
              <input className={inputClass} name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Como podemos chamar você?"/>
            </label>
            <label className={labelClass}>Nome de usuário
              <input className={inputClass} name="username" required minLength={3} maxLength={30} pattern="[a-z0-9]{3,30}"
                title="Apenas letras minúsculas sem acentos e números" autoComplete="username"
                value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30))}
                placeholder="ex.: joaomiguel"/>
              <span className="mt-1.5 block text-[10px] font-normal leading-4 text-[#92988f]">Letras e números, sem espaços ou acentos.</span>
            </label>
            <label className={labelClass}>E-mail
              <input className={inputClass} name="email" type="email" required autoComplete="email" placeholder="voce@exemplo.com"/>
            </label>
            <label className={labelClass}>WhatsApp
              <input className={inputClass} name="whatsapp" required type="tel" inputMode="numeric" autoComplete="tel-national"
                placeholder="(32) 99999-9999" value={whatsapp} onChange={e => setWhatsapp(maskPhone(e.target.value))}
                pattern="\([0-9]{2}\) [0-9]{5}-[0-9]{4}" title="Informe DDD e celular com 11 dígitos"/>
            </label>
            <div className="sm:col-span-2">
              <label htmlFor="owner-password" className={labelClass}>Crie uma senha</label>
              <div className="relative">
                <input id="owner-password" className={inputClass + " pr-14"} name="password"
                  type={showPassword ? "text" : "password"} required minLength={10}
                  autoComplete="new-password" placeholder="No mínimo 10 caracteres"/>
                <button type="button" onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword}
                  className="absolute right-2 top-[calc(50%+4px)] flex h-9 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#8b9188] transition hover:bg-[#eef0eb] hover:text-[#151715] focus-visible:outline-2 focus-visible:outline-black">
                  {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>
            </div>
          </div>

          <div className="mb-5 mt-8 flex items-center gap-3 border-b border-[#edf0e9] pb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0f2ed] text-[#3d473b]"><Building2 size={17}/></span>
            <div><h2 className="text-sm font-bold">Sua barbearia</h2><p className="text-[11px] text-[#939a90]">Vamos dar um nome ao seu espaço</p></div>
          </div>
          <label className={labelClass}>Nome da barbearia
            <input className={inputClass} name="businessName" required minLength={2} maxLength={100} placeholder="Ex.: Barbearia Central"/>
          </label>
          <div className="mt-4 flex gap-2.5 rounded-xl border border-[#e8ebe4] bg-[#f7f8f5] px-3.5 py-3">
            <Check size={16} className="mt-0.5 shrink-0 text-[#687966]"/>
            <p className="text-[11px] leading-5 text-[#737d71]">O endereço da página pública e as demais configurações poderão ser definidos depois, no painel.</p>
          </div>

          {status && <p role="alert" aria-live="polite" className="mt-5 rounded-xl border border-[#f2d9d5] bg-[#fff2f0] p-3.5 text-[12px] leading-5 text-[#9b403a]">{status}</p>}

          <button type="submit" disabled={busy}
            className="mt-7 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#151715] px-5 text-[13px] font-bold text-white transition hover:bg-[#333631] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#151715] disabled:cursor-wait disabled:opacity-60">
            {busy ? "Criando sua barbearia..." : "Criar minha barbearia"}
            {!busy && <ArrowRight size={18}/>}
          </button>
          <p className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] text-[#92998e]">
            <ShieldCheck size={14}/> Seus dados são usados para configurar sua conta.
          </p>
        </form>
      )}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-[#edf0e9] bg-[#fbfcfa] px-5 py-5 text-[12px] sm:flex-row sm:px-9 xl:px-11">
        <span className="text-[#8b9288]">Já tem uma conta no AICorta?</span>
        <Link href="/login" className="inline-flex items-center gap-1.5 font-bold text-[#222620] transition hover:underline">
          Entrar na minha conta <ChevronRight size={15}/>
        </Link>
      </div>
    </div>
    <p className="mt-5 text-center text-[11px] text-[#93998f]">AICorta · Gestão inteligente para barbearias</p>
  </RegistrationShell>;
}

export default function RegisterPage() {
  return <Suspense fallback={<RegistrationShell><div role="status" className="rounded-[24px] border border-[#e3e5df] bg-white p-10 text-center text-sm text-[#72786f]">Preparando seu cadastro...</div></RegistrationShell>}><InviteRegistration/></Suspense>;
}
