"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import { Check, ImageUp, RotateCcw, Save, ShieldCheck, UploadCloud } from "lucide-react";
import { apiJson, mutation } from "../../../lib/api";
import {
  PageHeader, Panel, fieldClass, primaryButton, secondaryButton,
} from "../../../components/dashboard/ui";
import { assetUrl, defaultBrand, useBrand, type BrandConfig } from "../../../components/brand/brand-provider";

type Slot = "logo" | "dark" | "favicon";
type PaletteKey = "black" | "navy" | "gold" | "silver";
const assetFields: { slot: Slot; title: string; description: string; background: string; kind: string }[] = [
  { slot: "logo", title: "Logo principal", description: "Usada em páginas claras, login e área pública", background: "bg-white", kind: "Recomendado: PNG transparente" },
  { slot: "dark", title: "Logo para fundo escuro", description: "Usada na sidebar e em superfícies pretas", background: "bg-[#050A30]", kind: "Recomendado: PNG transparente" },
  { slot: "favicon", title: "Favicon", description: "Ícone da aba do navegador", background: "bg-[#f2f3f0]", kind: "Recomendado: imagem quadrada" },
];
const palette: { key: PaletteKey; title: string; hint: string }[] = [
  { key: "black", title: "Preto principal", hint: "Navegação e elementos de destaque" },
  { key: "navy", title: "Azul-marinho", hint: "Cor institucional secundária" },
  { key: "gold", title: "Dourado", hint: "Destaques e identidade da marca" },
  { key: "silver", title: "Cinza-prata", hint: "Superfícies e elementos neutros" },
];
function validateFile(file: File): string | null {
  if (file.size > 400 * 1024) return "O arquivo ultrapassa 400 KB.";
  const mime = file.type === "image/vnd.microsoft.icon" ? "image/x-icon" : file.type;
  if (!["image/png", "image/jpeg", "image/webp", "image/x-icon"].includes(mime))
    return "Use uma imagem PNG, JPG, WEBP ou ICO.";
  return null;
}
async function readImage(file: File) {
  const result = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
  return result.replace(/^data:image\/vnd\.microsoft\.icon;/, "data:image/x-icon;");
}
export default function SystemBrandSettings() {
  const { brand, reload } = useBrand();
  const [draft, setDraft] = useState<BrandConfig>(defaultBrand);
  const [previews, setPreviews] = useState<Partial<Record<Slot, string>>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [workingSlot, setWorkingSlot] = useState<Slot | null>(null);
  useEffect(() => { setDraft(brand); }, [brand]);

  function update(key: PaletteKey, value: string) {
    setDraft(current => ({ ...current, [key]: value }));
  }
  async function save() {
    setBusy(true); setMessage(""); setError("");
    try {
      await apiJson<BrandConfig>("/branding", mutation("PATCH", {
        name: draft.name, black: draft.black, navy: draft.navy,
        gold: draft.gold, silver: draft.silver,
      }));
      await reload();
      setMessage("Identidade visual atualizada em toda a plataforma.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  async function upload(slot: Slot) {
    const dataUrl = previews[slot];
    if (!dataUrl) return;
    setWorkingSlot(slot); setMessage(""); setError("");
    try {
      await apiJson<BrandConfig>(`/branding/assets/${slot}`, mutation("PUT", { dataUrl }));
      await reload();
      setPreviews(current => ({ ...current, [slot]: undefined }));
      setMessage("Imagem salva e aplicada à plataforma.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao enviar a imagem."); }
    finally { setWorkingSlot(null); }
  }
  async function remove(slot: Slot) {
    if (!window.confirm("Remover esta imagem e voltar ao logo padrão?")) return;
    setWorkingSlot(slot); setMessage(""); setError("");
    try {
      await apiJson<BrandConfig>(`/branding/assets/${slot}`, { method: "DELETE" });
      await reload();
      setPreviews(current => ({ ...current, [slot]: undefined }));
      setMessage("Imagem removida.");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao remover."); }
    finally { setWorkingSlot(null); }
  }
  async function selectFile(slot: Slot, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    const issue = validateFile(file);
    if (issue) { setError(issue); event.target.value = ""; return; }
    try {
      const url = await readImage(file);
      setPreviews(current => ({ ...current, [slot]: url }));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler a imagem."); }
    event.target.value = "";
  }

  return <>
    <PageHeader kicker="SYSTEM / Aparência" title="Identidade visual"
      description="Centralize a marca AICorta. Logotipos, favicon e cores publicados aqui são aplicados às páginas e painéis."/>
    {error && <p role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-[#e6e3d4] bg-[#faf8eb] px-5 py-4 text-sm text-[#6b5b21]">
      <Check size={17}/>{message}
    </p>}
    <div className="grid gap-6 xl:grid-cols-[1.12fr_.88fr]">
      <div className="space-y-6">
        <Panel title="Arquivos de marca" description="Três versões para diferentes contextos de exibição">
          <div className="space-y-6">
            {assetFields.map(item => {
              const current = assetUrl(brand.assets[item.slot]);
              const preview = previews[item.slot] ?? current;
              return <section key={item.slot} className="rounded-2xl border border-[#e8e9e4] p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div><h3 className="text-sm font-bold">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#898d85]">{item.description}</p></div>
                  {current && <span className="shrink-0 rounded-full bg-[#f4f1e3] px-2.5 py-1 text-[10px] font-semibold text-[#8b761e]">Configurado</span>}
                </div>
                <div className={`flex h-40 items-center justify-center rounded-xl border border-[#e9eae5] p-6 ${item.background}`}>
                  {preview ? <img alt={`Prévia de ${item.title}`} src={preview} className="max-h-full max-w-full object-contain"/> :
                    <div className="text-center"><ImageUp className={`mx-auto mb-2 ${item.slot === "dark" ? "text-white/50" : "text-[#969b92]"}`} size={30}/>
                      <p className={`text-xs ${item.slot === "dark" ? "text-white/70" : "text-[#9ca199]"}`}>Nenhuma imagem enviada</p></div>}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label className={secondaryButton + " cursor-pointer"}>
                    <UploadCloud size={16}/> Escolher arquivo
                    <input type="file" className="sr-only" accept=".png,.jpg,.jpeg,.webp,.ico,image/png,image/jpeg,image/webp,image/x-icon"
                      onChange={e => void selectFile(item.slot, e)}/>
                  </label>
                  {previews[item.slot] && <button className={primaryButton} type="button"
                    disabled={workingSlot !== null} onClick={() => void upload(item.slot)}>
                    <Save size={15}/>{workingSlot === item.slot ? "Enviando..." : "Salvar imagem"}
                  </button>}
                  {current && <button type="button" className={secondaryButton} disabled={workingSlot !== null}
                    onClick={() => void remove(item.slot)}><RotateCcw size={15}/> Remover</button>}
                </div>
                <p className="mt-3 text-[11px] text-[#9ba097]">{item.kind} · PNG, JPG, WEBP ou ICO · Até 400 KB</p>
              </section>;
            })}
          </div>
        </Panel>
      </div>
      <div className="space-y-6">
        <Panel title="Identidade e paleta" description="Baseada no manual de identidade visual AICorta">
          <div className="space-y-5">
            <label className="block text-xs font-semibold text-[#596056]">Nome da marca
              <input className={fieldClass + " mt-2"} maxLength={50} value={draft.name}
                onChange={e => setDraft(current => ({ ...current, name: e.target.value }))}/>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              {palette.map(color => <label key={color.key} className="block text-xs font-semibold text-[#596056]">
                {color.title}
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#e2e4de] p-2.5">
                  <input type="color" aria-label={color.title} value={draft[color.key]}
                    onChange={e => update(color.key, e.target.value.toUpperCase())}
                    className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent"/>
                  <input className="min-w-0 flex-1 bg-transparent text-xs font-semibold uppercase outline-none"
                    aria-label={`Hexadecimal da cor ${color.title}`} value={draft[color.key]}
                    onChange={e => update(color.key, e.target.value)} maxLength={9}/>
                </div>
                <span className="mt-1.5 block text-[11px] font-normal text-[#969b93]">{color.hint}</span>
              </label>)}
            </div>
            <button className={primaryButton + " w-full"} type="button" disabled={busy || !draft.name.trim()}
              onClick={() => void save()}><Save size={16}/>{busy ? "Salvando..." : "Publicar identidade visual"}</button>
          </div>
        </Panel>
        <Panel title="Orientações da marca" description="Referência do material enviado">
          <div className="space-y-3 text-xs leading-6 text-[#777d73]">
            <p><strong className="text-[#292b27]">Cores oficiais:</strong> preto #000000, marinho #050A30, dourado #F2C225 e cinza #D9D9D9.</p>
            <p><strong className="text-[#292b27]">Tipografia:</strong> o manual indica Angel Band, Stanford Breath e Montserrat.</p>
            <p>As versões demonstrativas de Angel Band e Stanford Breath enviadas permitem apenas uso pessoal. Não serão incorporadas à aplicação comercial sem licença adequada.</p>
            <p className="flex items-start gap-2 rounded-xl bg-[#f5f6f2] p-4"><ShieldCheck size={17} className="mt-1 shrink-0"/>
              Os arquivos são armazenados no banco e as alterações exigem uma sessão SYSTEM.</p>
          </div>
        </Panel>
      </div>
    </div>
  </>;
}
