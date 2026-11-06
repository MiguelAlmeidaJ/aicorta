"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { BrandLogo } from "../../components/brand/brand-provider";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

async function responseMessage(response: Response, fallback: string) {
  const problem = await response.json().catch(() => null) as { message?: string | string[] } | null;
  return Array.isArray(problem?.message) ? problem.message.join("; ") : problem?.message ?? fallback;
}

function ClientRegistration() {
  const router = useRouter();
  const inviteToken = useSearchParams().get("invite")?.trim() ?? "";
  const [username, setUsername] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const registration = await fetch(`${API}/auth/register-client`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, username, whatsapp: whatsapp.replace(/\D/g, "") }),
      });
      if (!registration.ok) throw new Error(await responseMessage(registration, "Não foi possível criar a conta"));

      if (inviteToken) {
        const acceptance = await fetch(`${API}/invitations/accept`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteToken }),
        });
        if (!acceptance.ok) {
          setStatus(`Conta criada, mas o convite não pôde ser aceito: ${await responseMessage(acceptance, "convite inválido")}`);
          return;
        }
        router.replace("/painel");
        return;
      }
      router.replace("/meus-agendamentos");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível criar a conta");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth">
    <Link href="/" className="brand"><BrandLogo className="h-12 max-w-[230px]"/></Link>
    <h1>{inviteToken ? "Criar conta e aceitar convite" : "Criar conta de cliente"}</h1>
    <p>{inviteToken ? "Cadastre-se com o mesmo e-mail que recebeu o convite." : "Crie sua conta para reservar horários nas barbearias do AICorta."}</p>
    <form onSubmit={submit}>
      <label>Nome completo<input name="name" required minLength={2} maxLength={100} autoComplete="name"/></label>
      <label>Usuário
        <input required pattern="[a-z0-9]{3,30}" autoComplete="username" value={username}
          onChange={event => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30))}/>
        <small>Apenas letras minúsculas e números, de 3 a 30 caracteres.</small>
      </label>
      <label>E-mail<input name="email" type="email" required autoComplete="email"/></label>
      <label>WhatsApp
        <input required type="tel" inputMode="numeric" autoComplete="tel" value={whatsapp}
          onChange={event => setWhatsapp(maskPhone(event.target.value))}
          pattern="\([0-9]{2}\) [0-9]{5}-[0-9]{4}" placeholder="(32) 99999-9999"/>
      </label>
      <label>Senha<input name="password" type="password" required minLength={10} autoComplete="new-password"/></label>
      <button type="submit" disabled={busy}>{busy ? "Criando conta..." : "Criar minha conta"}</button>
    </form>
    <p role="status" aria-live="polite">{status}</p>
    <Link href="/login">Já tenho uma conta</Link>
  </main>;
}

export default function ClientRegistrationPage() {
  return <Suspense fallback={<main className="auth">Carregando cadastro...</main>}><ClientRegistration/></Suspense>;
}
