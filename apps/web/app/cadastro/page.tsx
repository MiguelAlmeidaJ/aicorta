"use client";
import { BrandLogo } from "../../components/brand/brand-provider";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? "(" + digits : "";
  if (digits.length <= 7) return "(" + digits.slice(0, 2) + ") " + digits.slice(2);
  return "(" + digits.slice(0, 2) + ") " + digits.slice(2, 7) + "-" + digits.slice(7);
}

function InviteRegistration() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [valid, setValid] = useState(false);
  const [checking, setChecking] = useState(Boolean(token));
  const [status, setStatus] = useState("");
  const [username, setUsername] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
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

  return <main className="auth">
    <Link href="/" className="brand"><BrandLogo className="h-12 max-w-[230px]"/></Link>
    <h1>Cadastrar barbearia</h1>
    {checking && <p>Validando seu convite...</p>}
    {!checking && !valid && <p>O cadastro de barbearias acontece somente por convite do administrador da plataforma.</p>}
    {valid && <>
      <p>Preencha os dados da sua conta e da barbearia para ativar o convite.</p>
      <form onSubmit={submit}>
        <label>Nome completo<input name="name" required minLength={2} maxLength={100}/></label>
        <label>Usuário
          <input name="username" required pattern="[a-z0-9]{3,30}" title="Use apenas letras minúsculas sem acentos e números" 
            autoComplete="username" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30))}
            placeholder="joaomiguel"/>
          <small>Apenas letras sem acentos e números, de 3 a 30 caracteres.</small>
        </label>
        <label>E-mail<input name="email" type="email" required autoComplete="email"/></label>
        <label>WhatsApp (DDD + celular)
          <input name="whatsapp" required type="tel" inputMode="numeric" placeholder="(32) 99999-9999"
            value={whatsapp} onChange={e => setWhatsapp(maskPhone(e.target.value))}
            pattern="\([0-9]{2}\) [0-9]{5}-[0-9]{4}" title="Informe DDD e celular com 11 dígitos"/>
        </label>
        <label>Senha<input name="password" type="password" required minLength={10} autoComplete="new-password"/></label>
        <label>Nome da barbearia<input name="businessName" required minLength={2}/></label>
        <p>O endereço de acesso da barbearia será configurado posteriormente no painel.</p>
        <button type="submit" disabled={busy}>{busy ? "Criando..." : "Criar minha barbearia"}</button>
      </form>
    </>}
    <p role="status">{status}</p>
    <Link href="/login">Já tenho conta</Link>
  </main>;
}
export default function RegisterPage() {
  return <Suspense fallback={<main className="auth">Carregando convite...</main>}><InviteRegistration/></Suspense>;
}
