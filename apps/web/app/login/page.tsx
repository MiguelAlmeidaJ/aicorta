"use client";
import { BrandLogo } from "../../components/brand/brand-provider";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setLoading(true);
    try {
      const response = await fetch(`${API}/auth/login`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
      if (!response.ok) throw new Error("Não foi possível entrar. Verifique as credenciais.");
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/painel");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Erro ao entrar"); }
    finally { setLoading(false); }
  }
  return <main className="auth"><Link href="/" className="brand"><BrandLogo className="h-12 max-w-[230px]"/></Link><h1>Entrar</h1><p>Use usuário, e-mail ou WhatsApp.</p><form onSubmit={submit}><label>Identificador<input required value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="usuário, e-mail ou 32999999999" /></label><label>Senha<input required type="password" value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={loading} type="submit">{loading ? "Entrando..." : "Entrar"}</button></form><p role="status">{message}</p><p>Cadastro de barbearias disponível somente pelo link de convite do AICorta.</p><p><Link href="/esqueci-senha">Esqueci minha senha</Link></p></main>;
}
