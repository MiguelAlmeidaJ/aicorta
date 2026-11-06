"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExternalLink, Save, Settings2, ShieldCheck } from "lucide-react";
import { apiJson, mutation } from "../../../../../lib/api";
import { fieldClass, PageHeader, Panel, primaryButton, StatusPill } from "../../../../../components/dashboard/ui";

type Settings = { id: string; name: string; slug: string; status: string; billingDueDay: number; timezone: string };
export default function TenantSettingsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [value, setValue] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    apiJson<Settings>(`/tenants/${tenantId}/settings`)
      .then(data => { if (active) setValue(data); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [tenantId]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!value) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const saved = await apiJson<Settings>(`/tenants/${tenantId}/settings`,
        mutation("PATCH", { name: value.name, slug: value.slug }));
      setValue(saved); setMessage("Configurações salvas com sucesso.");
    } catch(e) { setError(e instanceof Error ? e.message : "Não foi possível salvar"); }
    finally { setSaving(false); }
  }
  return <>
    <PageHeader kicker="Gestão / Preferências" title="Configurações"
      description="Personalize a identidade e o endereço público da sua barbearia."/>
    {error && <p role="alert" className="mb-5 rounded-xl bg-[#faeeee] px-4 py-3 text-sm text-[#a84b46]">{error}</p>}
    {message && <p role="status" className="mb-5 rounded-xl bg-[#edf3eb] px-4 py-3 text-sm text-[#46634a]">{message}</p>}
    <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <Panel title="Informações da barbearia" description="Dados exibidos para seus clientes">
        {!value ? <p className="py-8 text-sm text-[#999d96]">Carregando configurações...</p> :
        <form onSubmit={save} className="space-y-6">
          <label className="block text-xs font-semibold text-[#52574f]">Nome da barbearia
            <input required minLength={2} maxLength={100} className={fieldClass + " mt-2"}
              value={value.name} onChange={e => setValue({ ...value, name: e.target.value })}/></label>
          <label className="block text-xs font-semibold text-[#52574f]">Endereço público (slug)
            <div className="mt-2 flex items-center overflow-hidden rounded-xl border border-[#e1e3dd] bg-white focus-within:border-[#111]">
              <span className="hidden border-r border-[#e8eae5] bg-[#f5f6f3] px-4 py-3 text-xs text-[#90948c] sm:block">/b/</span>
              <input required minLength={3} maxLength={50} pattern="[a-z0-9]+(-[a-z0-9]+)*"
                className="min-w-0 flex-1 bg-white px-4 py-3 text-sm outline-none" value={value.slug}
                onChange={e => setValue({ ...value, slug: e.target.value.toLowerCase() })}/>
            </div>
            <span className="mt-2 block text-xs font-normal text-[#999e95]">Letras minúsculas, números e hífens. Alterar o slug muda o link público da barbearia.</span>
          </label>
          <button disabled={saving} type="submit" className={primaryButton}>
            <Save size={17}/>{saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>}
      </Panel>
      <div className="space-y-6">
        <Panel title="Status do estabelecimento" description="Informações de acesso">
          {value && <div className="space-y-5">
            <div className="flex items-center justify-between"><p className="text-xs text-[#777c73]">Situação</p>
              <StatusPill status={value.status}/></div>
            <div className="flex items-center justify-between border-t border-[#f0f1ed] pt-4">
              <p className="text-xs text-[#777c73]">Dia de vencimento</p>
              <p className="text-sm font-bold">Dia {value.billingDueDay}</p>
            </div>
            <div className="flex items-center justify-between border-t border-[#f0f1ed] pt-4">
              <p className="text-xs text-[#777c73]">Fuso horário</p>
              <p className="text-xs font-semibold">{value.timezone}</p>
            </div>
            <p className="rounded-xl bg-[#f5f6f2] p-3 text-xs leading-5 text-[#858b81]">
              O dia de vencimento é gerenciado pela plataforma AICorta.
            </p>
          </div>}
        </Panel>
        <Panel title="Página pública" description="Compartilhe o endereço de agendamento">
          {value && <Link href={`/b/${value.slug}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-[#e4e6e0] bg-[#f9faf7] p-4 text-sm font-semibold transition hover:bg-[#eff1eb]">
            <span className="truncate">/b/{value.slug}</span><ExternalLink size={17}/>
          </Link>}
        </Panel>
      </div>
    </div>
  </>;
}
