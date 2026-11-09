"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExternalLink, LocateFixed, MapPin, Search, Save, Trash2 } from "lucide-react";
import { API_URL, apiJson, mutation } from "../../../../../lib/api";
import { fieldClass, PageHeader, Panel, primaryButton, StatusPill } from "../../../../../components/dashboard/ui";
import { TenantCoverCrop } from "../../../../../components/tenants/tenant-cover-crop";
import { AicortaMap } from "../../../../../components/maps/aicorta-map";

function cleanSlug(raw: string) {
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-")
    .replace(/^-/, "").slice(0, 50);
}
function friendlySettingsError(error: unknown) {
  const detail = error instanceof Error ? error.message : "";
  if (/já está em uso|already exists|unique constraint|P2002/i.test(detail))
    return "Esse endereço já pertence a outra barbearia. Escolha outro nome para o link.";
  if (/state|UF|regular expression|must match|must be a string/i.test(detail))
    return "Informe uma UF com duas letras (por exemplo, MG) ou deixe o campo Estado vazio.";
  if (/slug|lowercase|match|alfanum/i.test(detail))
    return "O endereço público deve ter de 3 a 50 caracteres, usando somente letras, números e hífens.";
  return "Não foi possível salvar as alterações. Confira os dados e tente novamente.";
}

type Settings = { id: string; name: string; slug: string; status: string; billingDueDay: number; timezone: string;
  city: string | null; state: string | null; neighborhood: string | null;
  postalCode: string | null; street: string | null; streetNumber: string | null;
  complement: string | null; latitude: number | null; longitude: number | null; coverUrl: string | null };
export default function TenantSettingsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [value, setValue] = useState<Settings | null>(null);
  const [original, setOriginal] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapMessage, setMapMessage] = useState("");
  const [savedSlug, setSavedSlug] = useState("");
  const [coverDataUrl, setCoverDataUrl] = useState<string | null | undefined>(undefined);
  const handleCoverChange = useCallback((dataUrl: string | null) => setCoverDataUrl(dataUrl ?? undefined), []);
  useEffect(() => {
    let active = true;
    apiJson<Settings>(`/tenants/${tenantId}/settings`)
      .then(data => { if (active) { setValue(data); setOriginal(data); setSavedSlug(data.slug); } })
      .catch(() => { if (active) setError("Não foi possível carregar as configurações. Atualize a página e tente novamente."); });
    return () => { active = false; };
  }, [tenantId]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!value || !original || saving) return;
    const slug = cleanSlug(value.slug).replace(/-+$/, "");
    const name = value.name.trim();
    if (slug !== original.slug && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3)) {
      setError("Escolha um endereço de pelo menos 3 caracteres, usando letras, números ou hífens.");
      return;
    }
    const patch: Record<string, string | number | null> = {};
    if (name !== original.name) patch.name = name;
    if (slug !== original.slug) patch.slug = slug;
    if ((value.city ?? "").trim() !== (original.city ?? "")) patch.city = value.city?.trim() || "";
    if ((value.neighborhood ?? "").trim() !== (original.neighborhood ?? "")) {
      patch.neighborhood = value.neighborhood?.trim() || "";
    }
    const state = (value.state ?? "").trim().toUpperCase();
    if (state !== (original.state ?? "")) {
      if (state && !/^[A-Z]{2}$/.test(state)) {
        setError("O estado deve conter duas letras, como MG. Ou deixe em branco.");
        return;
      }
      patch.state = state;
    }
    for (const field of ["postalCode", "street", "streetNumber", "complement"] as const) {
      if ((value[field] ?? "").trim() !== (original[field] ?? "")) patch[field] = value[field]?.trim() || "";
    }
    if (value.latitude !== original.latitude || value.longitude !== original.longitude) {
      patch.latitude = value.latitude;
      patch.longitude = value.longitude;
    }
    if ((value.latitude === null) !== (value.longitude === null)) {
      setError("Selecione a posição completa no mapa."); return;
    }
    if (value.latitude !== null && (!value.street?.trim() || !value.streetNumber?.trim() ||
        !value.city?.trim() || !value.state?.trim())) {
      setError("Preencha rua, número, cidade e UF para publicar a localização no mapa.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      let saved = original;
      if (Object.keys(patch).length) {
        saved = await apiJson<Settings>(`/tenants/${tenantId}/settings`, mutation("PATCH", patch));
      }
      if (coverDataUrl) {
        saved = await apiJson<Settings>(`/tenants/${tenantId}/settings/cover`,
          mutation("PUT", { imageDataUrl: coverDataUrl }));
      } else if (coverDataUrl === null && original.coverUrl) {
        saved = await apiJson<Settings>(`/tenants/${tenantId}/settings/cover`, { method: "DELETE" });
      }
      setValue(saved); setOriginal(saved); setSavedSlug(saved.slug);
      setCoverDataUrl(undefined);
      setMessage("Configurações salvas com sucesso.");
    } catch (reason) {
      setError(friendlySettingsError(reason));
      // Evita pedir novamente o que já foi persistido quando a atualização da capa falhar.
      if (Object.keys(patch).length) {
        try {
          const fresh = await apiJson<Settings>(`/tenants/${tenantId}/settings`);
          setOriginal(fresh); setSavedSlug(fresh.slug);
        } catch { /* Mantenha os dados editados se a conexão cair. */ }
      }
    } finally { setSaving(false); }
  }
  function changeAddress(patch: Partial<Settings>) {
    if (!value) return;
    setValue({ ...value, ...patch, latitude: null, longitude: null });
    setMapMessage("Endereço alterado. Confirme novamente o pin antes de publicar no mapa.");
  }
  async function findPostalCode() {
    if (!value) return;
    const cep = (value.postalCode ?? "").replace(/\D/g, "");
    if (cep.length !== 8) { setError("Informe um CEP com oito dígitos."); return; }
    setLocating(true); setError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const found = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (!response.ok || found.erro) throw new Error("CEP não encontrado");
      changeAddress({ postalCode: cep, street: found.logradouro ?? value.street,
        neighborhood: found.bairro ?? value.neighborhood, city: found.localidade ?? value.city,
        state: found.uf ?? value.state });
      setMapMessage("CEP localizado. Confirme o número e posicione o pin no mapa.");
    } catch { setError("Não foi possível consultar o CEP. Preencha os campos manualmente."); }
    finally { setLocating(false); }
  }
  async function locateAddress() {
    if (!value) return;
    if (!value.street?.trim() || !value.streetNumber?.trim() || !value.city?.trim() || !value.state?.trim()) {
      setError("Preencha rua, número, cidade e UF para localizar o endereço."); return;
    }
    setLocating(true); setError(""); setMapMessage("");
    try {
      const result = await apiJson<{latitude:number;longitude:number;formattedAddress:string;precision:string}>(
        `/tenants/${tenantId}/settings/geocode`, mutation("POST", {
          street:value.street, streetNumber:value.streetNumber, city:value.city, state:value.state,
          neighborhood:value.neighborhood || undefined, postalCode:value.postalCode || undefined,
        }));
      setValue(current => current ? { ...current, latitude:result.latitude, longitude:result.longitude } : current);
      setMapMessage(result.precision === "ROOFTOP"
        ? "Endereço localizado. Confira se o pin está na entrada da barbearia."
        : "Localização aproximada encontrada. Ajuste o pin clicando no ponto exato do mapa.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível localizar o endereço.");
    } finally { setLocating(false); }
  }
  async function populateAddressFromCoordinates(latitude: number, longitude: number, accuracy?: number) {
    setLocating(true); setError("");
    setValue(current => current ? { ...current, latitude, longitude } : current);
    setMapMessage("Localização obtida. Buscando CEP, rua, bairro, cidade e estado...");
    try {
      const address = await apiJson<{
        street: string; streetNumber: string; neighborhood: string;
        city: string; state: string; postalCode: string; formattedAddress: string;
      }>(`/tenants/${tenantId}/settings/reverse-geocode`,
        mutation("POST", { latitude, longitude }));
      setValue(current => current ? {
        ...current, latitude, longitude,
        street: address.street || null,
        streetNumber: address.streetNumber || null,
        neighborhood: address.neighborhood || null,
        city: address.city || null,
        state: address.state || null,
        postalCode: address.postalCode || null,
      } : current);
      const missing = [
        !address.street && "rua",
        !address.streetNumber && "número",
        !address.city && "cidade",
        !address.state && "UF",
      ].filter(Boolean).join(", ");
      const uncertain = accuracy !== undefined && accuracy > 50
        ? " O GPS tem precisão aproximada; confira o ponto no mapa." : "";
      setMapMessage(missing
        ? `Endereço parcialmente preenchido. Confira e informe: ${missing}.${uncertain}`
        : `Endereço preenchido automaticamente. Confira os dados e clique em Salvar alterações.${uncertain}`);
    } catch {
      setMapMessage("Pin localizado, mas não foi possível consultar o endereço. Preencha os campos manualmente e salve.");
      setError("A busca do endereço não está disponível no momento. Suas coordenadas foram mantidas.");
    } finally { setLocating(false); }
  }
  function useMyLocation() {
    if (!navigator.geolocation) { setError("Seu navegador não permite obter a localização."); return; }
    setLocating(true); setError(""); setMapMessage("Obtendo a localização do estabelecimento...");
    navigator.geolocation.getCurrentPosition(position => {
      void populateAddressFromCoordinates(position.coords.latitude, position.coords.longitude,
        position.coords.accuracy);
    }, error => {
      setError(error.code === 1
        ? "Permita o acesso à localização nas configurações do navegador ou marque o ponto no mapa."
        : "Não foi possível obter sua localização. Tente novamente ou selecione o ponto no mapa.");
      setMapMessage("");
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
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
                onChange={e => setValue({ ...value, slug: cleanSlug(e.target.value) })}/>
            </div>
            <span className="mt-2 block text-xs font-normal text-[#999e95]">Letras, números e hífens. Espaços são convertidos em hífens automaticamente. O link antigo deixará de funcionar após salvar.</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[#52574f]">Cidade
              <input maxLength={100} className={fieldClass + " mt-2"} value={value.city ?? ""} onChange={e => changeAddress({ city: e.target.value })}/></label>
            <label className="block text-xs font-semibold text-[#52574f]">Estado (UF)
              <input maxLength={2} pattern="[A-Za-z]{2}" placeholder="Ex.: MG" className={fieldClass + " mt-2 uppercase"} value={value.state ?? ""} onChange={e => changeAddress({ state: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}/></label>
          </div>
          <label className="block text-xs font-semibold text-[#52574f]">Bairro
            <input maxLength={100} className={fieldClass + " mt-2"} value={value.neighborhood ?? ""} onChange={e => changeAddress({ neighborhood: e.target.value })}/></label>
          <section className="space-y-4 border-t border-[#eceee8] pt-6">
            <div className="flex items-start gap-3"><MapPin size={18} className="mt-0.5 text-[#667362]"/>
              <div><h2 className="text-sm font-bold">Endereço completo e localização</h2>
                <p className="mt-1 text-xs leading-5 text-[#848d80]">Cadastre o endereço e confirme o pin para aparecer no mapa público.</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="text-xs font-semibold text-[#52574f]">CEP
                <input inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder="00000-000"
                  className={fieldClass+" mt-2"} value={value.postalCode ?? ""}
                  onChange={e=>changeAddress({postalCode:e.target.value.replace(/\D/g,"").slice(0,8)})}/>
              </label>
              <button type="button" disabled={locating} onClick={()=>void findPostalCode()}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#dfe3dc] px-4 text-xs font-semibold hover:bg-[#f6f7f3]">
                <Search size={15}/> Buscar CEP
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(110px,1fr)]">
              <label className="text-xs font-semibold text-[#52574f]">Rua / avenida
                <input autoComplete="street-address" maxLength={180} className={fieldClass+" mt-2"}
                  value={value.street ?? ""} onChange={e=>changeAddress({street:e.target.value})}/>
              </label>
              <label className="text-xs font-semibold text-[#52574f]">Número
                <input maxLength={20} className={fieldClass+" mt-2"}
                  value={value.streetNumber ?? ""} onChange={e=>changeAddress({streetNumber:e.target.value})}/>
              </label>
            </div>
            <label className="block text-xs font-semibold text-[#52574f]">Complemento (opcional)
              <input maxLength={120} placeholder="Sala, loja, referência..." className={fieldClass+" mt-2"}
                value={value.complement ?? ""} onChange={e=>setValue({ ...value, complement:e.target.value })}/>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={locating} onClick={()=>void locateAddress()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1c211b] px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">
                <Search size={15}/> {locating?"Localizando...":"Localizar endereço"}
              </button>
              <button type="button" disabled={locating} onClick={useMyLocation}
                className="inline-flex items-center gap-2 rounded-xl border border-[#dfe3dc] px-4 py-3 text-xs font-semibold hover:bg-[#f6f7f3]">
                <LocateFixed size={16}/> {locating ? "Obtendo endereço..." : "Estou no estabelecimento"}
              </button>
            </div>
            <AicortaMap points={value.latitude !== null && value.longitude !== null ?
              [{ id:"barbearia", latitude:value.latitude, longitude:value.longitude, label:value.name }] : []}
              selectedId="barbearia" height={340}
              onPick={point => { setValue(current => current ? { ...current, ...point } : current);
                setMapMessage("Pin posicionado. Clique em Salvar alterações para publicar."); }}/>
            {mapMessage && <p role="status" className="text-xs leading-5 text-[#657263]">{mapMessage}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#52574f]">Latitude
                <input type="number" step="any" min={-90} max={90} placeholder="-21.0000000" className={fieldClass+" mt-2"}
                  value={value.latitude ?? ""} onChange={e=>setValue({ ...value, latitude:e.target.value ? Number(e.target.value) : null,
                    longitude:e.target.value ? value.longitude : null })}/>
              </label>
              <label className="text-xs font-semibold text-[#52574f]">Longitude
                <input type="number" step="any" min={-180} max={180} placeholder="-42.0000000" className={fieldClass+" mt-2"}
                  value={value.longitude ?? ""} onChange={e=>setValue({ ...value, longitude:e.target.value ? Number(e.target.value) : null,
                    latitude:e.target.value ? value.latitude : null })}/>
              </label>
            </div>
            <p className="text-[11px] leading-5 text-[#8c9488]">O pin é personalizado do AICorta. Ajuste o ponto clicando no mapa; apenas endereços com coordenadas confirmadas serão exibidos como pins.</p>
          </section>
          <div className="border-t border-[#eceee8] pt-6"><p className="text-xs font-semibold text-[#52574f]">Capa da barbearia</p>
            <p className="mb-4 mt-1 text-xs text-[#92978e]">A imagem aparece na busca e no topo da página pública.</p>
            {value.coverUrl && coverDataUrl === undefined ? <div className="relative overflow-hidden rounded-2xl bg-[#f1f2ee]">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem servida pela API */}
              <img src={`${API_URL}${value.coverUrl}`} alt={`Capa atual de ${value.name}`} className="aspect-[1280/520] w-full rounded-2xl object-cover"/>
              <button type="button" onClick={() => setCoverDataUrl(null)} className="absolute right-3 top-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold shadow"><Trash2 size={14}/> Remover</button>
            </div> : coverDataUrl === null ? <button type="button" onClick={() => setCoverDataUrl(undefined)} className="text-xs font-semibold underline">Manter capa atual</button> :
              <TenantCoverCrop onChange={handleCoverChange}/>}
          </div>
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
          {value && <Link href={`/b/${savedSlug || value.slug}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-[#e4e6e0] bg-[#f9faf7] p-4 text-sm font-semibold transition hover:bg-[#eff1eb]">
            <span className="truncate">/b/{savedSlug || value.slug}</span><ExternalLink size={17}/>
          </Link>}
        </Panel>
      </div>
    </div>
  </>;
}
