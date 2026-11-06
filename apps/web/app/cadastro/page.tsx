"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
export default function RegisterPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setStatus("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const response = await fetch(`${API}/auth/register`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!response.ok) { const error = await response.json(); throw new Error(Array.isArray(error.message) ? error.message.join(", ") : error.message ?? "Falha no cadastro"); }
      router.replace("/painel");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Erro no cadastro"); }
  }
  return <main className="auth"><Link href="/" className="brand">✂ AICorta</Link><h1>Cadastre sua barbearia</h1><p>Comece criando seu usuário administrador e estabelecimento.</p><form onSubmit={submit}>
    <label>Nome completo<input name="name" required minLength={2} /></label>
    <label>Usuário<input name="username" required pattern="[a-z0-9._-]{3,30}" placeholder="miguel" /></label>
    <label>E-mail<input name="email" type="email" required /></label>
    <label>WhatsApp (DDD + celular)<input name="whatsapp" required placeholder="32999999999" inputMode="tel" /></label>
    <label>Senha<input name="password" type="password" required minLength={10} /></label>
    <label>Nome da barbearia<input name="businessName" required minLength={2} /></label>
    <label>Endereço curto (slug)<input name="businessSlug" required pattern="[a-z0-9-]{3,50}" placeholder="barbearia-do-centro" /></label>
    <button type="submit">Criar barbearia</button>
  </form><p role="status">{status}</p><Link href="/login">Já tenho conta</Link></main>;
}
