"use client";

import { BrandLogo } from "../../components/brand/brand-provider";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Eye, EyeOff, LockKeyhole,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const inputClass =
  "mt-2 block h-11 w-full min-w-0 rounded-[10px] border border-[#dfe2dc] bg-[#fbfcfa] px-3.5 text-[14px] text-[#151714] outline-none transition placeholder:text-[#a3a8a0] hover:border-[#bdc2b9] focus:border-[#171917] focus:bg-white focus:ring-2 focus:ring-[#171917]/[0.055] disabled:opacity-60";
const labelClass = "block min-w-0 text-[12px] font-semibold text-[#373c35]";

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? "(" + digits : "";
  if (digits.length <= 7) return "(" + digits.slice(0, 2) + ") " + digits.slice(2);
  return "(" + digits.slice(0, 2) + ") " + digits.slice(2, 7) + "-" + digits.slice(7);
}

function RegistrationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f5f6f3] px-4 py-8 text-[#171917] sm:px-6 sm:py-12">
      <div className="w-full max-w-[580px]">{children}</div>
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
    <div className="overflow-hidden rounded-[22px] border border-[#e5e7e1] bg-white shadow-[0_16px_55px_rgba(15,20,15,0.045)] sm:rounded-[24px]">
      <div className="px-6 pt-8 sm:px-10 sm:pt-10">
        <Link href="/" className="inline-flex items-center" aria-label="Voltar ao início do AICorta">
          <BrandLogo className="h-10 max-w-[166px]"/>
        </Link>
        <h1 className="mt-8 text-[27px] font-bold leading-tight tracking-[-0.042em] text-[#151715] sm:text-[32px]">
          Cadastrar barbearia
        </h1>
        <p className="mt-3 max-w-[430px] text-[13px] leading-[1.7] text-[#757b74] sm:text-[14px]">
          Preencha os dados abaixo para ativar seu convite e configurar seu estabelecimento.
        </p>
      </div>

      {checking ? (
        <div role="status" aria-live="polite" className="mx-6 my-8 flex items-center gap-3 rounded-xl bg-[#f5f6f3] px-4 py-5 text-sm text-[#60675d] sm:mx-10">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#bec3b9] border-t-[#181a17]"/> Validando seu convite...
        </div>
      ) : !valid ? (
        <div className="px-6 pb-8 pt-7 sm:px-10">
          <div className="rounded-2xl border border-[#e5e8e0] bg-[#f6f7f4] p-5">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#343a32]"><LockKeyhole size={19}/></div>
            <h2 className="text-base font-bold">Cadastro disponível por convite</h2>
            <p className="mt-2 text-sm leading-6 text-[#747c70]">A criação de barbearias é liberada pelo administrador do AICorta. Utilize o link recebido para continuar.</p>
            {status && <p role="alert" className="mt-4 rounded-lg bg-[#fcefee] p-3 text-[13px] text-[#9d403d]">{status}</p>}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="px-6 pb-8 pt-7 sm:px-10 sm:pb-10">
          <h2 className="border-b border-[#eceee9] pb-3 text-[13px] font-bold text-[#252a25]">Dados do responsável</h2>

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

          <h2 className="mb-5 mt-8 border-b border-[#eceee9] pb-3 text-[13px] font-bold text-[#252a25]">Dados da barbearia</h2>
          <label className={labelClass}>Nome da barbearia
            <input className={inputClass} name="businessName" required minLength={2} maxLength={100} placeholder="Ex.: Barbearia Central"/>
          </label>
          <div className="mt-3">
            <p className="text-[11px] leading-5 text-[#858c82]">O endereço da página pública e as demais configurações poderão ser definidos depois, no painel.</p>
          </div>

          {status && <p role="alert" aria-live="polite" className="mt-5 rounded-xl border border-[#f2d9d5] bg-[#fff2f0] p-3.5 text-[12px] leading-5 text-[#9b403a]">{status}</p>}

          <button type="submit" disabled={busy}
            className="mt-7 flex h-[49px] w-full items-center justify-center gap-2 rounded-xl bg-[#151715] px-5 text-[13px] font-bold text-white transition hover:bg-[#333631] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#151715] disabled:cursor-wait disabled:opacity-60">
            {busy ? "Criando sua barbearia..." : "Criar minha barbearia"}
          </button>
        </form>
      )}
      <div className="border-t border-[#edf0eb] px-6 py-5 text-center text-[12px] text-[#81877f] sm:px-10">
        Já tem uma conta? <Link href="/login" className="font-semibold text-[#202520] underline-offset-4 hover:underline">Entrar no AICorta</Link>
      </div>
    </div>
  </RegistrationShell>;
}

export default function RegisterPage() {
  return <Suspense fallback={<RegistrationShell><div role="status" className="rounded-[24px] border border-[#e3e5df] bg-white p-10 text-center text-sm text-[#72786f]">Preparando seu cadastro...</div></RegistrationShell>}><InviteRegistration/></Suspense>;
}
