"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
type Invite = { id: string; referenceName: string; billingDueDay: number;
  expiresAt: string; consumedAt: string | null; revokedAt: string | null; createdAt: string };
export default function SystemInvites() {
  const router = useRouter();
  const [referenceName, setReferenceName] = useState("");
  const [billingDueDay, setBillingDueDay] = useState(10);
  const [items, setItems] = useState<Invite[]>([]);
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const apiFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    let response = await fetch(`${API}${endpoint}`, { ...options, credentials: "include", cache: "no-store" });
    if (response.status === 401) {
      const refresh = await fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" });
      if (refresh.ok) response = await fetch(`${API}${endpoint}`, { ...options, credentials: "include", cache: "no-store" });
    }
    return response;
  }, []);

  const reload = useCallback(async () => {
    const response = await apiFetch("/auth/owner-invites");
    if (response.status === 401) { router.replace("/login"); return; }
    if (response.status === 403) { router.replace("/painel"); return; }
    if (!response.ok) throw new Error("Não foi possível carregar convites");
    setItems(await response.json());
  }, [apiFetch, router]);

  useEffect(() => { void reload().catch(() => setStatus("Não foi possível carregar os convites.")); }, [reload]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setLink(""); setStatus("");
    try {
      const response = await apiFetch("/auth/owner-invites", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceName, billingDueDay }) });
      if (!response.ok) throw new Error("Falha ao criar convite. Verifique seu acesso SYSTEM.");
      const invite = await response.json();
      setLink(invite.registrationUrl);
      setStatus("Convite criado. Copie o link e encaminhe ao proprietário.");
      setReferenceName("");
      await reload();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Erro"); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revogar este convite?")) return;
    const response = await apiFetch(`/auth/owner-invites/${id}/revoke`, { method: "PATCH" });
    setStatus(response.ok ? "Convite revogado." : "Não foi possível revogar.");
    await reload();
  }
  return <main className="shell">
    <header className="nav"><Link href="/painel" className="brand">✂ AICorta</Link><Link href="/painel">Voltar ao painel</Link></header>
    <section className="booking-wrap"><span className="eyebrow">SYSTEM · Onboarding</span>
      <h1>Convites para barbearias</h1>
      <p>Somente usuários SYSTEM podem emitir convites. O nome identifica o destinatário no controle interno; o vencimento define o dia mensal do tenant.</p>
      <form className="booking-steps" onSubmit={create}>
        <label>Nome de referência<input required minLength={2} maxLength={100}
          value={referenceName} onChange={e => setReferenceName(e.target.value)}
          placeholder="João · Barbearia Miguel do Corte"/></label>
        <label>Dia de vencimento mensal<input required type="number" min={1} max={31}
          value={billingDueDay} onChange={e => setBillingDueDay(Number(e.target.value))}/></label>
        <button disabled={busy}>{busy ? "Gerando..." : "Gerar link de cadastro"}</button>
      </form>
      {link && <section className="booking-item"><strong>Link gerado (exibido uma única vez)</strong>
        <input readOnly value={link} aria-label="Link para envio ao proprietário"/>
        <button onClick={() => void navigator.clipboard.writeText(link)}>Copiar link</button>
      </section>}
      <p role="status">{status}</p>
      <h2>Histórico de convites</h2>
      {items.map(item => <article key={item.id} className="booking-item">
        <strong>{item.referenceName}</strong>
        <p>Vencimento: dia {item.billingDueDay} · Expira: {new Date(item.expiresAt).toLocaleDateString("pt-BR")}</p>
        <p>{item.consumedAt ? "Utilizado" : item.revokedAt ? "Revogado" :
          new Date(item.expiresAt) <= new Date() ? "Expirado" : "Pendente"}</p>
        {!item.consumedAt && !item.revokedAt && new Date(item.expiresAt) > new Date() &&
          <button type="button" onClick={() => void revoke(item.id)}>Revogar convite</button>}
      </article>)}
    </section>
  </main>;
}
