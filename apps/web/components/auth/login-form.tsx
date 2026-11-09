"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { API_URL } from "../../lib/api";
import { BrandLogo } from "../brand/brand-provider";

type Profile = {
  globalRole: string;
  memberships: Array<{ tenantId: string; role: string; tenant: { status: string } }>;
};

async function responseMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
  return Array.isArray(body?.message) ? body.message.join("; ") : body?.message ?? fallback;
}

export function LoginForm({ mode }: { mode: "client" | "admin" }) {
  const router = useRouter();
  const admin = mode === "admin";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setMessage(""); setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "Identificador ou senha inválidos."));
      const requested = new URLSearchParams(window.location.search).get("next");
      const safeNext = requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;
      if (!admin) { router.replace(safeNext ?? "/meus-agendamentos"); return; }

      const profileResponse = await fetch(`${API_URL}/auth/me`, { credentials: "include", cache: "no-store" });
      if (!profileResponse.ok) throw new Error("Não foi possível validar o acesso administrativo.");
      const profile = await profileResponse.json() as Profile;
      if (profile.globalRole === "SYSTEM") { router.replace(safeNext ?? "/system"); return; }
      const membership = profile.memberships.find(item =>
        ["ADMIN", "EMPLOYEE"].includes(item.role) && item.tenant.status === "ACTIVE");
      if (!membership) {
        await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => null);
        throw new Error("Esta conta não possui acesso a um painel administrativo.");
      }
      router.replace(safeNext ?? `/painel/barbearias/${membership.tenantId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally { setLoading(false); }
  }

  return <main className="flex min-h-dvh items-center justify-center bg-[#f5f5f1] px-4 py-8 sm:px-6">
    <section className="w-full max-w-[480px] rounded-[28px] border border-[#dedfd9] bg-white px-6 py-8 shadow-[0_24px_70px_rgba(22,24,20,0.08)] sm:px-10 sm:py-10">
      <header>
        <div className="flex items-center justify-between gap-6">
          <Link href="/" aria-label="Voltar ao início" className="inline-flex">
            <BrandLogo className="h-11 w-[150px] sm:h-12 sm:w-[165px]"/>
          </Link>
          <span className="rounded-full border border-[#e0e1dc] bg-[#f6f6f2] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-[#73786f]">
            {admin ? "Painel" : "Cliente"}
          </span>
        </div>
        <div className="mt-10">
          <h1 className="text-[34px] font-semibold leading-tight tracking-[-.045em] text-[#121411] sm:text-[38px]">
            {admin ? "Acesso administrativo" : "Entre na sua conta"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#747970]">
            {admin ? "Gerencie a agenda, a equipe e a operação da sua barbearia." :
              "Acompanhe seus horários e faça novos agendamentos."}
          </p>
        </div>
      </header>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block text-xs font-semibold text-[#353934]">Usuário, e-mail ou WhatsApp
          <input required autoComplete="username" value={identifier} onChange={event => setIdentifier(event.target.value)}
            placeholder="Digite seu identificador"
            className="mt-2.5 w-full rounded-xl border border-[#d5d8d1] bg-[#fbfbf9] px-4 py-3.5 text-sm text-[#171916] outline-none transition placeholder:text-[#adb1aa] focus:border-[#5f645d] focus:bg-white focus:ring-2 focus:ring-black/[.04]"/>
        </label>
        <label className="block text-xs font-semibold text-[#353934]">Senha
          <span className="relative mt-2.5 block">
            <input required autoComplete="current-password" type={showPassword ? "text" : "password"}
              value={password} onChange={event => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[#d5d8d1] bg-[#fbfbf9] px-4 py-3.5 pr-12 text-sm text-[#171916] outline-none transition focus:border-[#5f645d] focus:bg-white focus:ring-2 focus:ring-black/[.04]"/>
            <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword(value => !value)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#858a81] hover:text-[#22241f]">
              {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>
          </span>
        </label>
        <div className="flex justify-end">
          <Link href="/esqueci-senha" className="text-xs font-medium text-[#61675f] underline-offset-4 hover:underline">Esqueci minha senha</Link>
        </div>
        <button disabled={loading} type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#111310] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#2b2e29] disabled:cursor-wait disabled:opacity-60">
          <span>{loading ? "Validando acesso..." : admin ? "Acessar painel" : "Entrar"}</span>
          {!loading && <ArrowRight size={17}/>}
        </button>
      </form>
      <p role={message ? "alert" : undefined} aria-live="polite" className="mt-5 min-h-5 text-sm text-[#a4433c]">{message}</p>
      <div className="mt-5 border-t border-[#e3e4df] pt-6 text-center text-sm text-[#747a70]">
        {admin ? <p>Procurando seus agendamentos? <Link href="/login" className="font-semibold text-[#20221e] underline-offset-4 hover:underline">Entrar como cliente</Link></p> :
          <div className="space-y-3"><p>Ainda não tem conta? <Link href="/cadastro-cliente" className="font-semibold text-[#20221e] underline-offset-4 hover:underline">Criar conta</Link></p>
            <p><Link href="/admin/login" className="text-xs font-medium underline-offset-4 hover:underline">Acessar o painel da barbearia</Link></p></div>}
      </div>
      <Link href="/" className="mt-8 block text-center text-xs font-medium text-[#777c74] transition hover:text-[#171916]">Voltar para o site</Link>
    </section>
  </main>;
}
