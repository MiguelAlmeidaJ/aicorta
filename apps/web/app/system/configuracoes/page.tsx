"use client";
import { useState, type ChangeEvent } from "react";
import {
  ArrowUpRight, Check, CheckCircle2, ChevronRight, CloudUpload,
  Eye, ImageIcon, Palette, RotateCcw, Save,
  ShieldCheck, Smartphone, Sparkles, Upload, X,
} from "lucide-react";
import { apiJson, mutation } from "../../../lib/api";
import { assetUrl, BrandArtwork, defaultBrand, useBrand, type BrandConfig } from "../../../components/brand/brand-provider";

type Slot = "logo" | "dark" | "favicon";
type PaletteKey = "black" | "navy" | "gold" | "silver";
const slots: { id: Slot; title: string; detail: string; label: string }[] = [
  { id: "logo", title: "Logo principal", detail: "Fundos claros, login e páginas públicas", label: "01" },
  { id: "dark", title: "Versão negativa", detail: "Sidebar, menu escuro e painéis", label: "02" },
  { id: "favicon", title: "Favicon", detail: "Abas do navegador e favoritos", label: "03" },
];
const swatches: { key: PaletteKey; title: string; purpose: string }[] = [
  { key: "black", title: "Preto", purpose: "Base da marca" },
  { key: "navy", title: "Azul-marinho", purpose: "Institucional" },
  { key: "gold", title: "Dourado", purpose: "Destaques" },
  { key: "silver", title: "Cinza-prata", purpose: "Neutro" },
];
const outline = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#e7e7e4] bg-white px-4 text-xs font-bold text-[#22231f] transition hover:border-[#c8c9c2] hover:bg-[#f8f8f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2c225] disabled:cursor-not-allowed disabled:opacity-40";
const solid = "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#161713] px-5 text-xs font-bold text-white transition hover:bg-[#393a34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2c225] disabled:cursor-not-allowed disabled:opacity-40";

function imageCheck(file: File) {
  if (file.size > 400 * 1024) return "O arquivo ultrapassa 400 KB.";
  const type = file.type === "image/vnd.microsoft.icon" ? "image/x-icon" : file.type;
  if (!["image/png", "image/jpeg", "image/webp", "image/x-icon"].includes(type)) {
    return "Formato inválido. Use PNG, JPG, WEBP ou ICO.";
  }
  return "";
}

async function asDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result).replace(
      /^data:image\/vnd\.microsoft\.icon;/, "data:image/x-icon;"));
    reader.readAsDataURL(file);
  });
}

function Artwork({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  return src ? <BrandArtwork src={src} alt={alt} className={className}/> :
    <span className="text-4xl font-black tracking-[-.08em] text-current">AI<span className="text-[#f2c225]">Corta</span></span>;
}

export default function SystemBrandSettings() {
  const { brand, reload } = useBrand();
  const revision = [brand.name, brand.black, brand.navy, brand.gold, brand.silver,
    brand.assets.logo, brand.assets.dark, brand.assets.favicon].join(":");
  return <SystemBrandSettingsEditor key={revision} brand={brand} reload={reload}/>;
}

function SystemBrandSettingsEditor({ brand, reload }: {
  brand: BrandConfig;
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<BrandConfig>(brand);
  const [selected, setSelected] = useState<Partial<Record<Slot, string>>>({});
  const [fileNames, setFileNames] = useState<Partial<Record<Slot, string>>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSlot, setSavingSlot] = useState<Slot | null>(null);
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("dark");

  const colorsChanged = draft.name !== brand.name ||
    swatches.some(s => draft[s.key].toLowerCase() !== brand[s.key].toLowerCase());

  function announce(message: string) { setError(""); setNotice(message); }

  async function savePalette() {
    setSaving(true); setError(""); setNotice("");
    try {
      await apiJson<BrandConfig>("/branding", mutation("PATCH", {
        name: draft.name, black: draft.black, navy: draft.navy, gold: draft.gold, silver: draft.silver,
      }));
      await reload();
      announce("Identidade e cores publicadas com sucesso.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar as cores."); }
    finally { setSaving(false); }
  }

  async function pick(slot: Slot, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(""); setNotice("");
    const validation = imageCheck(file);
    if (validation) { setError(validation); return; }
    try {
      const data = await asDataUrl(file);
      setSelected(current => ({ ...current, [slot]: data }));
      setFileNames(current => ({ ...current, [slot]: file.name }));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler a imagem."); }
  }

  async function publishAsset(slot: Slot) {
    const data = selected[slot];
    if (!data) return;
    setSavingSlot(slot); setError(""); setNotice("");
    try {
      await apiJson<BrandConfig>(`/branding/assets/${slot}`, mutation("PUT", { dataUrl: data }));
      await reload();
      setSelected(prev => ({ ...prev, [slot]: undefined }));
      setFileNames(prev => ({ ...prev, [slot]: undefined }));
      announce("Arquivo atualizado em toda a plataforma.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar o arquivo."); }
    finally { setSavingSlot(null); }
  }

  async function removeAsset(slot: Slot) {
    if (!window.confirm("Remover esta imagem da plataforma?")) return;
    setSavingSlot(slot); setError(""); setNotice("");
    try {
      await apiJson(`/branding/assets/${slot}`, { method: "DELETE" });
      await reload();
      setSelected(prev => ({ ...prev, [slot]: undefined }));
      announce("Imagem removida.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível remover."); }
    finally { setSavingSlot(null); }
  }

  const img = (slot: Slot) => selected[slot] ?? assetUrl(brand.assets[slot]);
  const heroImage = previewMode === "dark" ? img("dark") : img("logo");

  return <div className="space-y-7 pb-16">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[.04em] text-[#90918b]">
        <span>SYSTEM</span><ChevronRight size={13}/><span>CONFIGURAÇÕES</span>
        <ChevronRight size={13}/><span className="text-[#262721]">IDENTIDADE</span>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-[#e9e9e4] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#6b6d65]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#d4a629]"/> Brand Studio
      </div>
    </div>

    <section className="relative overflow-hidden rounded-[28px] bg-[#101110] p-6 text-[#fafaf8] sm:p-9 lg:p-11">
      <div className="pointer-events-none absolute -right-24 -top-44 h-[430px] w-[430px] rounded-full border border-[#ffffff12]"/>
      <div className="pointer-events-none absolute -right-8 -top-24 h-[340px] w-[340px] rounded-full border border-[#ffffff0d]"/>
      <div className="pointer-events-none absolute bottom-0 right-0 h-1 w-2/5 bg-[var(--brand-gold)]"/>
      <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1fr_.9fr]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-[#dad9d1]">
            <Sparkles size={13} className="text-[var(--brand-gold)]"/> Sua identidade, seu sistema
          </div>
          <h1 className="max-w-lg text-4xl font-bold leading-[1.05] tracking-[-.06em] sm:text-[46px]">
            Uma marca forte.<br/><span className="text-[var(--brand-gold)]">Em cada detalhe.</span>
          </h1>
          <p className="mt-5 max-w-md text-[13px] leading-6 text-[#afafa7]">
            Organize a identidade visual da plataforma. Cada alteração é refletida
            nos espaços que levam o nome AICorta.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 text-[11px] text-[#d2d1cb]">
            <span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-[var(--brand-gold)]"/> Edição exclusiva SYSTEM</span>
            <span className="h-1 w-1 rounded-full bg-[#6a6b64]"/>
            <span>Atualização global</span>
          </div>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/[.04] p-3 shadow-[0_22px_50px_#00000032]">
          <div className="mb-3 flex items-center justify-between px-2 pt-1">
            <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#aaa99f]"><Eye size={13}/> Prévia de aplicação</span>
            <div className="flex rounded-lg bg-black/40 p-1">
              {(["dark", "light"] as const).map(mode => <button key={mode} type="button"
                onClick={() => setPreviewMode(mode)}
                className={`rounded-md px-3 py-1.5 text-[10px] font-bold transition ${previewMode === mode ? "bg-[#f6f5f0] text-[#171713]" : "text-[#b5b4ad] hover:text-white"}`}>
                {mode === "dark" ? "Escuro" : "Claro"}
              </button>)}
            </div>
          </div>
          <div className={`flex h-[210px] items-center justify-center overflow-hidden rounded-xl px-7 py-8 transition-colors sm:h-[240px]
            ${previewMode === "dark" ? "bg-[var(--brand-navy)]" : "bg-[#f7f7f4] text-[#111]"}`}>
            <Artwork src={heroImage} alt="Prévia da identidade AICorta" className="h-full w-full"/>
          </div>
          <div className="flex items-center justify-between px-2 pb-1 pt-3 text-[10px] text-[#a3a49c]">
            <span>Pré-visualização da marca</span><span>{previewMode === "dark" ? "Fundo institucional" : "Fundo claro"}</span>
          </div>
        </div>
      </div>
    </section>

    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-[.20em] text-[#979a91]">01 / Biblioteca</p>
        <h2 className="mt-2 text-[24px] font-bold tracking-[-.045em] text-[#181915]">Arquivos de marca</h2>
        <p className="mt-1 text-xs text-[#93968f]">Três formatos de aplicação. Selecione um arquivo e publique cada versão.</p></div>
      <p className="rounded-full border border-[#e5e6e0] bg-white px-3 py-1.5 text-[11px] font-medium text-[#82867e]">PNG, JPG, WEBP ou ICO · até 400 KB</p>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      {slots.slice(0, 2).map(slot => {
        const source = img(slot.id);
        const configured = !!brand.assets[slot.id];
        return <article key={slot.id} className="overflow-hidden rounded-[22px] border border-[#e6e7e1] bg-white shadow-[0_3px_12px_#00000005]">
          <div className="flex items-start justify-between gap-3 px-5 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f5f0] text-[11px] font-bold text-[#72756d]">{slot.label}</span>
              <div><h3 className="text-sm font-bold tracking-tight">{slot.title}</h3>
                <p className="mt-1 text-[11px] text-[#92968e]">{slot.detail}</p></div>
            </div>
            <span className={`mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold
              ${configured ? "bg-[#eef0e9] text-[#545b46]" : "bg-[#f4f4f1] text-[#999c93]"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${configured ? "bg-[#a5ad80]" : "bg-[#bec0b9]"}`}/>
              {configured ? "Publicado" : "Pendente"}
            </span>
          </div>
          <div className={`relative mx-5 flex h-[238px] items-center justify-center overflow-hidden rounded-[15px] px-8 py-7 sm:mx-6
            ${slot.id === "dark" ? "bg-[var(--brand-navy)]" : "bg-[#f7f7f4]"}`}>
            <div className={`pointer-events-none absolute left-4 top-4 rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[.1em]
              ${slot.id === "dark" ? "border-white/15 text-white/50" : "border-black/10 text-black/40"}`}>Prévia</div>
            {source ? <BrandArtwork src={source} alt={slot.title} className="h-full w-full"/> :
              <div className={`flex flex-col items-center gap-3 ${slot.id === "dark" ? "text-white/60" : "text-[#a5a9a0]"}`}>
                <ImageIcon size={27} strokeWidth={1.5}/><span className="text-xs">Nenhuma imagem enviada</span>
              </div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[#585c54]">{fileNames[slot.id] ?? (configured ? "Imagem publicada" : "Sem arquivo")}</p>
              <p className="mt-1 text-[10px] text-[#a2a59c]">{selected[slot.id] ? "Pronto para publicação" : "Proporção livre · transparência recomendada"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className={outline + " cursor-pointer"}><Upload size={15}/> Escolher
                <input aria-label={`Selecionar ${slot.title}`} type="file" className="sr-only"
                  accept=".png,.jpg,.jpeg,.webp,.ico,image/png,image/jpeg,image/webp,image/x-icon"
                  onChange={e => void pick(slot.id, e)}/>
              </label>
              {selected[slot.id] && <button type="button" disabled={savingSlot !== null}
                onClick={() => void publishAsset(slot.id)} className={solid}>
                <Save size={15}/>{savingSlot === slot.id ? "Enviando" : "Publicar"}
              </button>}
              {configured && <button type="button" disabled={savingSlot !== null}
                aria-label={`Remover ${slot.title}`} title="Remover imagem" onClick={() => void removeAsset(slot.id)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e7e7e3] text-[#898c84] hover:bg-[#f6f6f3]">
                <RotateCcw size={15}/>
              </button>}
              {selected[slot.id] && <button type="button" title="Descartar seleção" aria-label="Descartar seleção"
                onClick={() => setSelected(v => ({ ...v, [slot.id]: undefined }))}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#888c82] hover:bg-[#f5f5f1]"><X size={16}/></button>}
            </div>
          </div>
        </article>;
      })}
    </div>

    <div className="grid gap-4 lg:grid-cols-[.75fr_1.25fr]">
      <article className="flex flex-col rounded-[22px] border border-[#e6e7e1] bg-white p-6">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] font-bold tracking-[.18em] text-[#a1a39d]">03 / ÍCONE</p>
            <h3 className="mt-2 text-base font-bold">Favicon da plataforma</h3>
            <p className="mt-1 text-xs text-[#93968e]">Um detalhe que acompanha sua marca em cada aba.</p>
          </div>
          <Smartphone size={21} className="text-[#8f9389]"/>
        </div>
        <div className="my-6 flex items-center gap-4 rounded-2xl bg-[#f7f7f4] p-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[16px] border border-[#e5e6e1] bg-white p-3 shadow-sm">
            {img("favicon") ? <BrandArtwork src={img("favicon")!} alt="Favicon" className="h-full w-full"/> :
              <ImageIcon size={22} className="text-[#9b9e96]"/>}
          </span>
          <div className="min-w-0"><p className="truncate text-[12px] font-semibold">{fileNames.favicon ?? (brand.assets.favicon ? "Favicon publicado" : "Aguardando arquivo")}</p>
            <p className="mt-1 text-[11px] text-[#959990]">Recomendado: quadrado, 64 × 64 ou maior</p></div>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <label className={outline + " cursor-pointer"}><CloudUpload size={15}/> Escolher
            <input aria-label="Selecionar favicon" type="file" className="sr-only"
              accept=".png,.jpg,.jpeg,.webp,.ico,image/png,image/jpeg,image/webp,image/x-icon"
              onChange={e => void pick("favicon", e)}/>
          </label>
          {selected.favicon && <button type="button" disabled={savingSlot !== null}
            onClick={() => void publishAsset("favicon")} className={solid}>Publicar</button>}
          {brand.assets.favicon && <button type="button" aria-label="Remover favicon"
            onClick={() => void removeAsset("favicon")} className={outline}><RotateCcw size={15}/></button>}
        </div>
      </article>

      <article className="rounded-[22px] border border-[#e6e7e1] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-[10px] font-bold tracking-[.18em] text-[#a1a39d]">02 / CORES</p>
            <h3 className="mt-2 text-base font-bold">Paleta da marca</h3>
            <p className="mt-1 text-xs text-[#93968e]">Identidade fiel ao manual AICorta.</p></div>
          <Palette size={22} className="text-[#979b91]"/>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {swatches.map(swatch => <label key={swatch.key} className="group cursor-pointer">
            <div className="relative h-20 overflow-hidden rounded-xl border border-black/5"
              style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(draft[swatch.key]) ? draft[swatch.key] : defaultBrand[swatch.key] }}>
              <input aria-label={`Selecionar cor ${swatch.title}`} type="color" value={/^#[0-9a-f]{6}$/i.test(draft[swatch.key]) ? draft[swatch.key] : defaultBrand[swatch.key]}
                onChange={e => setDraft(v => ({ ...v, [swatch.key]: e.target.value.toUpperCase() }))}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"/>
              <span className="pointer-events-none absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-sm transition group-hover:opacity-100">
                <Palette size={12}/></span>
            </div>
            <span className="mt-2 block text-[11px] font-bold">{swatch.title}</span>
            <input aria-label={`Cor hexadecimal ${swatch.title}`} value={draft[swatch.key]}
              onChange={e => setDraft(v => ({ ...v, [swatch.key]: e.target.value }))}
              maxLength={7} className="mt-1 w-full bg-transparent font-mono text-[10px] uppercase text-[#999b93] outline-none focus:text-[#2b2e25]"/>
            <span className="mt-1 block text-[10px] text-[#a3a69e]">{swatch.purpose}</span>
          </label>)}
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-[#eeeeea] pt-5">
          <label className="flex-1 text-[11px] font-bold text-[#5e625a]">Nome da marca
            <input value={draft.name} onChange={e => setDraft(v => ({ ...v, name: e.target.value }))}
              maxLength={50} className="mt-2 w-full max-w-[250px] rounded-xl border border-[#e4e5df] bg-[#fafaf8] px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-[#85877b]"/>
          </label>
          <button type="button" onClick={() => void savePalette()} disabled={saving || !draft.name.trim() || !colorsChanged}
            className={solid}><Save size={15}/>{saving ? "Salvando..." : "Salvar cores"}</button>
        </div>
      </article>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6e7df] bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f8f4e6] text-[#aa8b30]"><ShieldCheck size={17}/></span>
        <p className="text-xs leading-5 text-[#7c8078]"><strong className="text-[#32352d]">Publicação protegida.</strong> Apenas o SYSTEM pode alterar as imagens e cores. As fontes de demonstração não são incorporadas ao produto.</p>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#96998f]">
        AICorta Studio <ArrowUpRight size={14}/></span>
    </div>
    {error && <div role="alert" className="fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 rounded-xl border border-red-200 bg-white px-5 py-4 text-sm font-medium text-red-700 shadow-xl">
      <X size={17} className="mt-0.5 shrink-0"/>{error}
      <button aria-label="Fechar erro" onClick={() => setError("")} className="ml-auto"><X size={15}/></button>
    </div>}
    {notice && <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-md items-center gap-3 rounded-xl border border-[#e6e0c7] bg-[#1b1c19] px-5 py-4 text-sm font-medium text-white shadow-xl">
      <Check size={18} className="text-[#f2c225]"/>{notice}
      <button aria-label="Fechar notificação" onClick={() => setNotice("")} className="ml-auto"><X size={15}/></button>
    </div>}
  </div>;
}
