"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
type Profile = { id: string; name: string; username: string; globalRole: string; memberships: { tenantId: string; role: string; tenant: { name: string; slug: string; status: string } }[] };
export default function PanelPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        let response = await fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" });
        if (response.status === 401) {
          const renewed = await fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" });
          if (renewed.ok) response = await fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" });
        }
        if (!response.ok) { router.replace("/login"); return; }
        if (active) setProfile(await response.json());
      } catch { if (active) setError("Não foi possível carregar sua conta."); }
    }
    void load();
    return () => { active = false; };
  }, [router]);
  async function logout() {
    try { await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }); }
    finally { router.replace("/login"); }
  }
  return <main className="shell"><header className="nav"><Link href="/" className="brand">✂ AICorta</Link><button onClick={logout}>Sair</button></header>
    <section className="hero"><span className="eyebrow">Painel AICorta</span><h1>{profile ? `Olá, ${profile.name}` : "Carregando..."}</h1>
    {profile && <><p>Seu perfil: {profile.globalRole === "SYSTEM" ? "Sistema" : "Usuário"} · @{profile.username}</p>
      {profile.globalRole === "SYSTEM" && <p><Link href="/system/convites">Gerenciar convites de proprietários</Link></p>}<h2>Estabelecimentos</h2><p><Link href="/meus-agendamentos">Meus agendamentos</Link></p>{profile.memberships.length === 0 ? <p>Nenhum estabelecimento vinculado.</p> : <ul>{profile.memberships.map(m => <li key={m.tenantId}>{m.tenant.name} — {m.role} ({m.tenant.status}) · <Link href={"/b/" + m.tenant.slug}>Página de agendamentos</Link> {m.role === "ADMIN" && <> · <Link href={"/painel/barbearias/" + m.tenantId + "/configuracoes"}>Configurações</Link></>}</li>)}</ul>}</>}
    {error && <p role="alert">{error}</p>}</section></main>;
}
