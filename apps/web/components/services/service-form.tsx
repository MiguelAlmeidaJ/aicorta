"use client";

/* eslint-disable @next/next/no-img-element -- imagens autenticadas vêm da API configurável */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Save } from "lucide-react";
import { API_URL, apiJson, mutation } from "../../lib/api";
import { fieldClass, PageHeader, primaryButton, secondaryButton } from "../dashboard/ui";
import { ServiceImageCrop } from "./service-image-crop";

type Professional = {
  id: string; role: string; isOwner: boolean;
  user: { name: string; email: string };
};
type ServiceDetails = {
  id: string; name: string; description: string | null; durationMinutes: number; priceCents: number;
  professionalIds: string[]; imageUrl: string | null;
};

const priceText = (digits: string) => digits
  ? (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

export function ServiceForm({ tenantId, serviceId }: { tenantId: string; serviceId?: string }) {
  const router = useRouter();
  const editing = !!serviceId;
  const back = `/painel/barbearias/${tenantId}/servicos`;
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [priceDigits, setPriceDigits] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const handleImage = useCallback((dataUrl: string | null) => setImageDataUrl(dataUrl), []);

  useEffect(() => {
    let active = true;
    const professionalRequest = apiJson<Professional[]>(`/tenants/${tenantId}/services/professionals`);
    const serviceRequest = serviceId
      ? apiJson<ServiceDetails>(`/tenants/${tenantId}/services/manage/${serviceId}`) : Promise.resolve(null);
    Promise.all([professionalRequest, serviceRequest]).then(([available, service]) => {
      if (!active) return;
      setProfessionals(available);
      if (service) {
        setName(service.name); setDescription(service.description ?? "");
        setDurationMinutes(service.durationMinutes); setPriceDigits(String(service.priceCents));
        setSelected(service.professionalIds); setExistingImage(service.imageUrl);
      }
      setLoading(false);
    }).catch(loadError => {
      if (active) { setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o formulário."); setLoading(false); }
    });
    return () => { active = false; };
  }, [serviceId, tenantId]);

  function toggleProfessional(id: string) {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const priceCents = Number(priceDigits || "0");
    if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > 100000000) {
      setError("Informe um preço válido."); return;
    }
    setSaving(true);
    try {
      const payload = {
        name, description, durationMinutes, priceCents, professionalIds: selected,
        ...(imageDataUrl ? { imageDataUrl } : {}),
      };
      await apiJson(`/tenants/${tenantId}/services${serviceId ? `/${serviceId}` : ""}`,
        mutation(serviceId ? "PATCH" : "POST", payload));
      router.push(back);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o serviço.");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex min-h-72 items-center justify-center text-sm text-[#858b82]">Carregando serviço...</div>;

  return <>
    <PageHeader kicker="Gestão / Catálogo" title={editing ? "Editar serviço" : "Novo serviço"}
      description="Defina os dados comerciais, a foto e quem pode executar este atendimento."
      action={<Link href={back} className={secondaryButton}><ArrowLeft size={16}/> Voltar</Link>}/>
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="rounded-[20px] border border-[#e7e9e3] bg-white p-6 sm:p-8">
          <div className="mb-6"><h2 className="text-base font-bold">Informações do serviço</h2>
            <p className="mt-1 text-xs text-[#8b9088]">Dados exibidos para o cliente no momento da reserva.</p></div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#50564e] sm:col-span-2">Nome do serviço
              <input className={fieldClass + " mt-2"} required minLength={2} maxLength={100} value={name}
                onChange={event => setName(event.target.value)} placeholder="Ex.: Corte masculino"/>
            </label>
            <label className="text-xs font-semibold text-[#50564e]">Preço
              <span className="mt-2 flex items-center rounded-xl border border-[#e1e3dd] bg-white px-4 focus-within:border-[#111] focus-within:ring-2 focus-within:ring-black/5">
                <span className="text-sm font-semibold text-[#5e645b]">R$</span>
                <input required inputMode="numeric" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"
                  value={priceText(priceDigits)} onChange={event => setPriceDigits(event.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="0,00"/>
              </span>
            </label>
            <label className="text-xs font-semibold text-[#50564e]">Duração em minutos
              <input className={fieldClass + " mt-2"} required type="number" min={5} max={480} step={5}
                value={durationMinutes} onChange={event => setDurationMinutes(Number(event.target.value))}/>
            </label>
            <label className="text-xs font-semibold text-[#50564e] sm:col-span-2">Descrição
              <textarea className={fieldClass + " mt-2 min-h-28 resize-y"} maxLength={500} value={description}
                onChange={event => setDescription(event.target.value)} placeholder="Explique brevemente o que está incluído."/>
            </label>
          </div>
        </section>

        <section className="rounded-[20px] border border-[#e7e9e3] bg-white p-6 sm:p-8">
          <div className="mb-6"><h2 className="text-base font-bold">Foto do serviço</h2>
            <p className="mt-1 text-xs leading-5 text-[#8b9088]">A imagem será recortada para 1080 × 1080 e comprimida para no máximo 500 KB.</p></div>
          {existingImage && !imageDataUrl ? <div className="mb-5 flex items-center gap-4 rounded-xl bg-[#f4f5f1] p-3">
            <img width={80} height={80} src={`${API_URL}${existingImage}`} alt="Foto atual do serviço" className="h-20 w-20 rounded-lg object-cover"/>
            <div><p className="text-sm font-semibold">Foto atual</p><p className="mt-1 text-xs text-[#858b82]">Selecione outra imagem abaixo para substituir.</p></div>
          </div> : null}
          <ServiceImageCrop onChange={handleImage}/>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-[20px] border border-[#e7e9e3] bg-white p-6">
          <h2 className="text-base font-bold">Profissionais</h2>
          <p className="mt-2 text-xs leading-5 text-[#858b82]">Selecione quem executa este serviço. Sem seleção, o proprietário será vinculado automaticamente.</p>
          <div className="mt-5 space-y-2">
            {professionals.map(professional => {
              const checked = selected.includes(professional.id);
              return <label key={professional.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${checked
                ? "border-[#9ca297] bg-[#f2f4ef]" : "border-[#e6e8e2] hover:bg-[#fafbf8]"}`}>
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleProfessional(professional.id)}/>
                <span className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? "border-[#171916] bg-[#171916] text-white" : "border-[#c9cdc5] bg-white"}`}>
                  {checked ? <Check size={13}/> : null}
                </span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{professional.user.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-[#8c9189]">{professional.isOwner ? "Proprietário" : "Profissional"} · {professional.user.email}</span></span>
              </label>;
            })}
          </div>
        </section>
        {error ? <p role="alert" className="rounded-xl bg-[#faeeee] p-4 text-sm text-[#a14740]">{error}</p> : null}
        <button type="submit" className={primaryButton + " w-full"} disabled={saving}>
          <Save size={17}/>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar serviço"}
        </button>
      </aside>
    </form>
  </>;
}
