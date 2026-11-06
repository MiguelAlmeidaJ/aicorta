"use client";
import { BrandLogo } from "../../components/brand/brand-provider";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      let result = await fetch(`${API}/invitations/accept`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (result.status === 401) {
        const refresh = await fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" });
        if (!refresh.ok) { setMessage("Faça login na conta que recebeu o convite."); return; }
        result = await fetch(`${API}/invitations/accept`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token.trim() }),
        });
      }
      if (result.ok) { router.replace("/painel"); return; }
      setMessage(result.status === 403 ? "Entre usando o e-mail que recebeu o convite." : "Convite inválido, já utilizado ou expirado.");
    } catch { setMessage("Não foi possível conectar à API."); }
    finally { setBusy(false); }
  }
  return <main className="auth">
    <Link href="/" className="brand"><BrandLogo className="h-12 max-w-[230px]"/></Link>
    <h1>Aceitar convite</h1>
    <p>Entre com sua conta AICorta e informe o código recebido do estabelecimento.</p>
    <form onSubmit={submit}>
      <label>Código do convite
        <input required minLength={32} value={token} onChange={event => setToken(event.target.value)} />
      </label>
      <button type="submit" disabled={busy}>{busy ? "Confirmando..." : "Aceitar convite"}</button>
    </form>
    <p role="status">{message}</p>
    <Link href="/login">Entrar na conta</Link>
  </main>;
}
