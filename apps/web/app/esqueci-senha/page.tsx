"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await fetch(`${API}/auth/forgot-password`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    });
    setStatus(result.ok ? "Se o e-mail estiver cadastrado, você receberá instruções." : "Não foi possível processar sua solicitação agora.");
  }
  return <main className="auth"><Link href="/" className="brand">✂ AICorta</Link><h1>Recuperar senha</h1>
  <p>Enviaremos um link para seu e-mail cadastrado.</p>
  <form onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
  <button type="submit">Enviar instruções</button></form><p role="status">{status}</p><Link href="/login">Voltar ao login</Link></main>;
}
