"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, MapPin, Navigation, Search, Scissors } from "lucide-react";
import { PublicHeader } from "../../components/public/public-header";
import { PublicFooter } from "../../components/public/public-footer";
import { AicortaMap } from "../../components/maps/aicorta-map";
import { apiJson } from "../../lib/api";

type Shop = {
  id: string; name: string; slug: string;
  city: string | null; state: string | null; neighborhood: string | null;
  street: string | null; streetNumber: string | null; complement: string | null;
  postalCode: string | null; latitude: number | null; longitude: number | null;
};

function address(shop: Shop) {
  const first = [shop.street,shop.streetNumber].filter(Boolean).join(", ");
  const city = [shop.city, shop.state].filter(Boolean).join(" / ");
  return [first, shop.neighborhood,city].filter(Boolean).join(" · ") || "Endereço não cadastrado";
}
export default function MapPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");

  useEffect(() => {
    let active = true;
    apiJson<Shop[]>("/public/tenants").then(items => {
      if (!active) return;
      setShops(items);
      setSelected(items.find(item => item.latitude !== null && item.longitude !== null)?.id ?? items[0]?.id ?? "");
    }).catch(() => { if (active) setError("Não foi possível carregar os estabelecimentos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = shops.filter(shop => [shop.name, shop.street,shop.city,shop.neighborhood,shop.state]
    .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR")));
  const pins = useMemo(() => visible.filter(shop => shop.latitude !== null && shop.longitude !== null).map(shop => ({
    id:shop.id, latitude:shop.latitude!, longitude:shop.longitude!, label:shop.name,
  })),[visible]);
  const current = shops.find(item => item.id === selected);
  const located = current?.latitude !== null && current?.latitude !== undefined && current.longitude !== null && current.longitude !== undefined;
  const directions = located ?
    `https://www.google.com/maps/dir/?api=1&destination=${current!.latitude},${current!.longitude}` : null;

  return <main className="min-h-dvh bg-[#f6f6f3] text-[#1e231d]">
    <PublicHeader active="mapa"/>
    <div className="mx-auto max-w-[1240px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#9d8155]">Explore os estabelecimentos</p>
          <h1 className="mt-3 text-[clamp(2.2rem,4vw,3.5rem)] font-semibold tracking-[-.055em]">Encontre uma barbearia no mapa.</h1>
          <p className="mt-3 max-w-xl text-[14px] leading-6 text-[#7e867a]">Visualize os estabelecimentos e escolha onde agendar seu próximo atendimento.</p>
        </div>
        <div className="rounded-full border border-[#e1e6dd] bg-white px-4 py-2 text-[12px] font-semibold text-[#6c7668]">{pins.length} {pins.length === 1 ? "localização" : "localizações"}</div>
      </div>
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="grid overflow-hidden rounded-[20px] border border-[#e0e5dc] bg-white shadow-[0_12px_35px_rgba(20,29,17,.04)] lg:min-h-[610px] lg:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="border-b border-[#e9ece6] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#edf0e9] p-4 sm:p-5">
            <label htmlFor="map-search" className="sr-only">Buscar estabelecimentos no mapa</label>
            <div className="flex items-center gap-2 rounded-xl border border-[#dfe4db] bg-[#fafbf9] px-3">
              <Search size={17} className="text-[#929c8e]"/>
              <input id="map-search" value={term} onChange={event => setTerm(event.target.value)}
                placeholder="Nome, rua, bairro ou cidade" className="h-11 w-full min-w-0 bg-transparent text-[13px] outline-none"/>
            </div>
          </div>
          <div className="max-h-[330px] overflow-auto lg:max-h-[545px]">
            {loading && <p className="p-5 text-xs text-[#848c80]">Carregando barbearias...</p>}
            {!loading && !visible.length && <p className="p-5 text-sm text-[#858e81]">Nenhuma barbearia encontrada.</p>}
            {visible.map(item => <button type="button" key={item.id} onClick={() => setSelected(item.id)}
              className={`flex w-full items-start gap-3 border-b border-[#eff0eb] p-4 text-left transition hover:bg-[#f8f9f6] sm:p-5 ${selected === item.id ? "bg-[#f3f5ef]" : "bg-white"}`}>
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e7ebe3] text-[#5b6a57]"><MapPin size={17}/></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{item.name}</span>
                <span className="mt-1 block text-[12px] leading-5 text-[#899186]">{address(item)}</span>
                {item.latitude === null || item.longitude === null ?
                  <span className="mt-1 block text-[10px] font-semibold text-[#ad8c5c]">Aguardando localização</span> : null}
              </span>
            </button>)}
          </div>
        </aside>
        <div className="min-w-0">
          <AicortaMap points={pins} selectedId={selected} onSelect={setSelected} height={510}/>
          {current && <div className="flex flex-col justify-between gap-4 border-t border-[#e6e9e2] bg-white px-5 py-5 sm:flex-row sm:items-center">
            <div className="min-w-0"><p className="font-semibold">{current.name}</p>
              <p className="mt-1 text-xs leading-5 text-[#858d83]">{address(current)}</p></div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {directions && <a target="_blank" rel="noopener noreferrer" href={directions}
                className="inline-flex items-center gap-2 rounded-xl border border-[#dfe4dc] px-4 py-3 text-xs font-semibold hover:bg-[#f5f7f2]">
                <Navigation size={15}/> Como chegar
              </a>}
              <Link href={`/b/${current.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-[#1c211b] px-4 py-3 text-xs font-semibold text-white">
                Agendar <ArrowUpRight size={16}/>
              </Link>
            </div>
          </div>}
          {!pins.length && !loading && <p className="flex items-center gap-2 border-t border-[#e8ebe4] px-5 py-3 text-xs text-[#879185]">
            <Scissors size={15}/> Nenhuma barbearia cadastrou um ponto no mapa ainda.
          </p>}
        </div>
      </div>
      <p className="mt-4 text-[11px] text-[#8d968b]">Dados cartográficos © OpenStreetMap contributors.</p>
    </div>
    <PublicFooter/>
  </main>;
}
