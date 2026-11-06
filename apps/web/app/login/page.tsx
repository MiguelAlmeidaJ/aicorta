"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    try {
      const response = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      if (!response.ok) throw new Error("Não foi possível entrar. Verifique as credenciais.");
      // Tokens não são persistidos até introduzirmos sessão com cookies HttpOnly no backend.
      setMessage("Login validado pela API. Área autenticada será disponibilizada na próxima etapa.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Erro ao entrar"); }
  }
  return <main className="auth"><Link href="/" className="brand">✂ AICorta</Link><h1>Entrar</h1><p>Use usuário, e-mail ou WhatsApp.</p><form onSubmit={submit}><label>Identificador<input required value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="usuário, e-mail ou +5511999999999" /></label><label>Senha<input required type="password" value={password} onChange={e => setPassword(e.target.value)} /></label><button type="submit">Entrar</button></form><p role="status">{message}</p><Link href="/cadastro">Criar minha barbearia</Link></main>;
}
