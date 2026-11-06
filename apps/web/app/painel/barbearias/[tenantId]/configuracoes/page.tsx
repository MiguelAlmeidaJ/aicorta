"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
type Settings = { id: string; name: string; slug: string; status: string; billingDueDay: number };

export default function TenantSettingsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const [value, setValue] = useState<Settings | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    async function load() {
      let response = await fetch(`${API}/tenants/${tenantId}/settings`, { credentials: "include" });
      if (response.status === 401) {
        const refresh = await fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" });
        if (refresh.ok) response = await fetch(`${API}/tenants/${tenantId}/settings`, { credentials: "include" });
      }
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) throw new Error("Sem permissão para configurar a barbearia");
      if (active) setValue(await response.json());
    }
    void load().catch(e => { if (active) setStatus(e instanceof Error ? e.message : "Erro"); });
    return () => { active = false; };
  }, [tenantId, router]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value || saving) return;
    setSaving(true); setStatus("");
    try {
      const response = await fetch(`${API}/tenants/${tenantId}/settings`, { method: "PATCH",
        credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value.name, slug: value.slug }) });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message ?? "Falha ao salvar");
      }
      setValue(await response.json());
      setStatus("Configurações atualizadas.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }
  return <main className="shell">
    <header className="nav"><Link href="/painel" className="brand">✂ AICorta</Link><Link href="/painel">Voltar</Link></header>
    <section className="booking-wrap"><span className="eyebrow">Administração</span>
      <h1>Configurações da barbearia</h1>
      {value && <form className="booking-steps" onSubmit={save}>
        <label>Nome da barbearia<input required minLength={2} value={value.name}
          onChange={e => setValue({ ...value, name: e.target.value })}/></label>
        <label>Endereço curto (slug)
          <input required minLength={3} maxLength={50}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={value.slug} onChange={e => setValue({ ...value, slug: e.target.value.toLowerCase() })}/>
          <small>Somente letras minúsculas, números e hífens. Define o link público da barbearia.</small>
        </label>
        <p>Vencimento mensal: dia <strong>{value.billingDueDay}</strong> (definido pelo SYSTEM).</p>
        <p>Link atual: <Link href={`/b/${value.slug}`}>/b/{value.slug}</Link></p>
        <button disabled={saving}>{saving ? "Salvando..." : "Salvar configurações"}</button>
      </form>}
      <p role="status">{status}</p>
    </section>
  </main>;
}
