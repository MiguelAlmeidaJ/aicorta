"use client";

/* eslint-disable @next/next/no-img-element -- imagens globais servidas pela API */
import { useCallback, useState } from "react";
import { Check, ImageIcon, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { API_URL, apiJson, mutation } from "../../../../lib/api";
import { useBrand } from "../../../../components/brand/brand-provider";
import { TenantCoverCrop } from "../../../../components/tenants/tenant-cover-crop";
import { ServiceImageCrop } from "../../../../components/services/service-image-crop";

type Slot = "establishment" | "service" | "avatar";
type Editor = { slot: Slot; title: string; description: string; format: string; wide?: boolean; round?: boolean };
const editors: Editor[] = [
  { slot: "establishment", title: "Capa de estabelecimento", description: "Usada na busca e na página pública quando a barbearia não possui capa própria.", format: "1280 × 520 · até 500 KB", wide: true },
  { slot: "service", title: "Imagem de serviço", description: "Aplicada aos serviços que ainda não receberam uma imagem específica.", format: "1080 × 1080 · até 500 KB" },
  { slot: "avatar", title: "Imagem de perfil", description: "Avatar exibido para usuários que ainda não adicionaram sua própria foto.", format: "1080 × 1080 · até 500 KB", round: true },
];

export default function DefaultImagesPage() {
  const { brand, reload } = useBrand();
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  return <div className="space-y-7 pb-14">
    <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#979b91]">Sistema / Configurações</p><h1 className="mt-2 text-4xl font-bold tracking-[-.055em]">Padronização de imagens</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#7d8379]">Defina a apresentação padrão da plataforma. Imagens enviadas pelos estabelecimentos e usuários sempre têm prioridade.</p></div>
    <div className="rounded-2xl border border-[#e5e7df] bg-[#171916] px-5 py-4 text-white"><div className="flex items-center gap-3"><ShieldCheck size={19} className="text-[#efc524]"/><div><p className="text-sm font-bold">Fallback global protegido</p><p className="mt-1 text-xs text-white/60">Somente usuários SYSTEM podem publicar ou remover estas imagens.</p></div></div></div>
    <div className="space-y-5">{editors.map(editor => <DefaultImageEditor key={editor.slot} editor={editor} current={brand.defaultImages[editor.slot]} onReload={reload} onNotice={message => { setError(""); setNotice(message); }} onError={message => { setNotice(""); setError(message); }}/>)}</div>
    {error ? <div role="alert" className="fixed bottom-5 right-5 z-50 rounded-xl border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-xl">{error}</div> : null}
    {notice ? <div role="status" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-[#171916] px-5 py-4 text-sm text-white shadow-xl"><Check size={17} className="text-[#efc524]"/>{notice}</div> : null}
  </div>;
}

function DefaultImageEditor({ editor, current, onReload, onNotice, onError }: {
  editor: Editor; current: string | null; onReload: () => Promise<void>; onNotice: (message: string) => void; onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(!current); const [dataUrl, setDataUrl] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const change = useCallback((value: string | null) => setDataUrl(value), []);
  async function publish() {
    if (!dataUrl) return; setSaving(true);
    try { await apiJson(`/branding/assets/${editor.slot}`, mutation("PUT", { dataUrl })); await onReload(); setDataUrl(null); setEditing(false); onNotice(`${editor.title} atualizada.`); }
    catch (reason) { onError(reason instanceof Error ? reason.message : "Não foi possível publicar a imagem."); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!window.confirm(`Remover ${editor.title.toLowerCase()}?`)) return; setSaving(true);
    try { await apiJson(`/branding/assets/${editor.slot}`, { method: "DELETE" }); await onReload(); setDataUrl(null); setEditing(true); onNotice(`${editor.title} removida.`); }
    catch (reason) { onError(reason instanceof Error ? reason.message : "Não foi possível remover a imagem."); }
    finally { setSaving(false); }
  }
  return <article className="overflow-hidden rounded-[22px] border border-[#e3e5de] bg-white"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eceee8] px-6 py-5"><div><h2 className="text-lg font-bold">{editor.title}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#858b81]">{editor.description}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#a0a49b]">{editor.format}</p></div><ImageIcon className="text-[#92978d]"/></div>
    <div className="p-6">{current && !editing ? <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]"><div className={`overflow-hidden bg-[#eef0ea] ${editor.wide ? "rounded-xl" : editor.round ? "mx-auto h-48 w-48 rounded-full" : "mx-auto aspect-square w-64 rounded-xl"}`}><img src={`${API_URL}${current}`} alt={editor.title} className="h-full w-full object-cover"/></div><div className="flex flex-wrap gap-2 lg:flex-col"><button type="button" onClick={() => setEditing(true)} className="flex items-center justify-center gap-2 rounded-xl border border-[#dfe2da] px-4 py-3 text-xs font-bold hover:bg-[#f5f6f2]"><RefreshCw size={15}/> Substituir</button><button type="button" disabled={saving} onClick={() => void remove()} className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-red-700 hover:bg-red-50"><Trash2 size={15}/> Remover</button></div></div> : <div>{editor.wide ? <TenantCoverCrop onChange={change}/> : <ServiceImageCrop onChange={change}/>}<div className="mt-5 flex flex-wrap justify-end gap-2">{current ? <button type="button" onClick={() => { setEditing(false); setDataUrl(null); }} className="rounded-xl px-4 py-3 text-xs font-bold">Cancelar</button> : null}<button type="button" disabled={!dataUrl || saving} onClick={() => void publish()} className="flex items-center gap-2 rounded-xl bg-[#171916] px-5 py-3 text-xs font-bold text-white disabled:opacity-40"><Save size={15}/>{saving ? "Publicando..." : "Publicar padrão"}</button></div></div>}</div>
  </article>;
}
