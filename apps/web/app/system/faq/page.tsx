"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, HelpCircle, Plus, Save, Trash2 } from "lucide-react";
import { apiJson, mutation } from "../../../lib/api";
import { PageHeader, primaryButton } from "../../../components/dashboard/ui";

type FaqItem = { id?: string; question: string; answer: string; isActive: boolean; position?: number };
export default function PlatformFaqSettings() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    apiJson<FaqItem[]>("/system/faq").then(setItems)
      .catch(() => setError("Não foi possível carregar as perguntas."))
      .finally(() => setLoading(false));
  }, []);
  function change(index: number, patch: Partial<FaqItem>) {
    setItems(current => current.map((item, i) => i === index ? { ...item, ...patch } : item));
    setDirty(true); setMessage("");
  }
  function move(index: number, delta: number) {
    const dest = index + delta;
    if (dest < 0 || dest >= items.length) return;
    setItems(current => {
      const next = [...current];
      [next[index], next[dest]] = [next[dest], next[index]];
      return next;
    }); setDirty(true); setMessage("");
  }
  async function save() {
    setError(""); setMessage("");
    if (items.some(item => item.question.trim().length < 5 || item.answer.trim().length < 5)) {
      setError("Cada pergunta e resposta precisa ter pelo menos cinco caracteres."); return;
    }
    setSaving(true);
    try {
      const result = await apiJson<FaqItem[]>("/system/faq", mutation("PUT", {
        items: items.map(item => ({
          question: item.question.trim(), answer: item.answer.trim(), isActive: item.isActive,
        })),
      }));
      setItems(result); setDirty(false);
      setMessage("Perguntas frequentes publicadas. A página inicial já pode exibi-las.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível publicar o FAQ.");
    } finally { setSaving(false); }
  }

  return <div className="space-y-6 pb-12">
    <PageHeader kicker="SYSTEM / Conteúdo público" title="Perguntas frequentes"
      description="Organize e publique as respostas exibidas na página inicial do AICorta."/>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-[#edf4ea] px-4 py-3 text-sm text-[#466144]">{message}</p>}
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e3e7df] bg-white p-5">
      <div><p className="text-sm font-semibold">Conteúdo da página pública</p>
        <p className="mt-1 text-xs text-[#858d82]">{items.length} perguntas cadastradas · {items.filter(item => item.isActive).length} publicadas</p></div>
      <button type="button" onClick={() => {
        if (items.length >= 20) { setError("Limite de 20 perguntas atingido."); return; }
        setItems(current => [...current, { question: "", answer: "", isActive: true }]); setDirty(true); setMessage("");
      }} className="inline-flex items-center gap-2 rounded-xl border border-[#dce2d8] px-4 py-3 text-xs font-semibold hover:bg-[#f6f7f3]">
        <Plus size={17}/> Adicionar pergunta
      </button>
    </div>
    {loading && <div className="rounded-2xl bg-white p-8 text-center text-sm text-[#7d857b]">Carregando perguntas...</div>}
    {!loading && !items.length && <div className="rounded-2xl border border-dashed border-[#dfe5da] bg-white p-10 text-center">
      <HelpCircle size={29} className="mx-auto text-[#a8afa3]"/>
      <p className="mt-3 text-sm font-semibold">Ainda não há perguntas cadastradas.</p>
      <p className="mt-1 text-xs text-[#879184]">Adicione dúvidas sobre a plataforma, reservas, acesso ou suporte.</p>
    </div>}
    <div className="space-y-4">{items.map((item, index) => <article key={item.id ?? `new-${index}`}
      className="rounded-2xl border border-[#e2e6de] bg-white p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f1f3ee] text-xs font-bold text-[#5d6759]">{String(index + 1).padStart(2, "0")}</span>
          <span className="text-xs font-semibold text-[#51594d]">Pergunta</span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.isActive ? "bg-[#edf4ea] text-[#507047]" : "bg-[#f2f2ef] text-[#999d93]"}`}>
            {item.isActive ? "Publicada" : "Oculta"}</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Mover pergunta para cima" disabled={index === 0} onClick={() => move(index,-1)} className="rounded-lg p-2 text-[#798277] hover:bg-[#f1f3ee] disabled:opacity-30"><ArrowUp size={17}/></button>
          <button type="button" aria-label="Mover pergunta para baixo" disabled={index === items.length - 1} onClick={() => move(index,1)} className="rounded-lg p-2 text-[#798277] hover:bg-[#f1f3ee] disabled:opacity-30"><ArrowDown size={17}/></button>
          <button type="button" aria-label={item.isActive ? "Ocultar pergunta" : "Publicar pergunta"} onClick={() => change(index, { isActive: !item.isActive })} className="rounded-lg p-2 text-[#798277] hover:bg-[#f1f3ee]">
            {item.isActive ? <Eye size={17}/> : <EyeOff size={17}/>}</button>
          <button type="button" aria-label="Excluir pergunta" onClick={() => {
            if (!window.confirm("Remover esta pergunta ao publicar as alterações?")) return;
            setItems(current => current.filter((_,i) => i !== index)); setDirty(true);
          }} className="rounded-lg p-2 text-[#9e6b67] hover:bg-red-50"><Trash2 size={17}/></button>
        </div>
      </div>
      <label className="block text-xs font-semibold text-[#4b5649]">Pergunta
        <input value={item.question} maxLength={220} onChange={e => change(index, { question: e.target.value })}
          placeholder="Ex.: Como posso reagendar um atendimento?"
          className="mt-2 h-12 w-full rounded-xl border border-[#dce1d8] bg-[#fcfdfa] px-4 text-sm outline-none focus:border-[#858f80]"/>
      </label>
      <label className="mt-4 block text-xs font-semibold text-[#4b5649]">Resposta
        <textarea rows={3} value={item.answer} maxLength={3000} onChange={e => change(index,{answer:e.target.value})}
          placeholder="Escreva uma resposta clara para seus clientes."
          className="mt-2 block w-full resize-y rounded-xl border border-[#dce1d8] bg-[#fcfdfa] p-4 text-sm leading-6 outline-none focus:border-[#858f80]"/>
      </label>
    </article>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e1e5dc] pt-5">
      <p className="text-xs text-[#8c9589]">{dirty ? "Existem alterações ainda não publicadas." : "Todas as alterações estão salvas."}</p>
      <button type="button" onClick={() => void save()} disabled={saving || loading || !dirty}
        className={primaryButton + " w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"}>
        <Save size={17}/>{saving ? "Publicando..." : "Publicar perguntas"}
      </button>
    </div>
  </div>;
}
