"use client";
import { Suspense, FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const response = await fetch(`${API}/auth/reset-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setOk(response.ok);
    setMessage(response.ok ? "Senha alterada! Entre com sua nova senha." : "Link inválido ou expirado. Solicite outro.");
  }
  return <main className="auth"><Link href="/" className="brand">✂ AICorta</Link><h1>Redefinir senha</h1>
    {!token ? <p>Link inválido. Solicite uma nova recuperação.</p> : <form onSubmit={submit}>
    <label>Nova senha<input type="password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button type="submit">Salvar nova senha</button></form>}
    <p role="status">{message}</p><Link href={ok ? "/login" : "/esqueci-senha"}>{ok ? "Ir para login" : "Solicitar novo link"}</Link></main>;
}
export default function ResetPage() { return <Suspense fallback={<main className="auth">Carregando...</main>}><ResetForm/></Suspense>; }
