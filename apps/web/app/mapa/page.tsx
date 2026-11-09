"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, MapPin, Navigation, Search } from "lucide-react";
import { PublicHeader } from "../../components/public/public-header";
import { apiJson } from "../../lib/api";

type Shop = { id: string; name: string; slug: string; city: string | null; state: string | null; neighborhood: string | null };

export default function MapPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  useEffect(() => {
    let active = true;
    apiJson<Shop[]>("/public/tenants").then(items => {
      if (!active) return;
      setShops(items); setSelected(items.find(item => item.city)?.id ?? items[0]?.id ?? "");
    }).catch(() => { if (active) setError("Não foi possível carregar os estabelecimentos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const visible = shops.filter(shop => [shop.name, shop.city, shop.neighborhood, shop.state]
    .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR")));
  const current = shops.find(shop => shop.id === selected);
  const region = current ? [current.neighborhood, current.city, current.state].filter(Boolean).join(", ") : "";
  const mapUrl = region ? `https://maps.google.com/maps?q=${encodeURIComponent(region + ", Brasil")}&output=embed` : null;
  const external = region ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(region + ", Brasil")}` : null;

  return <main className="min-h-dvh bg-[#f6f6f3] text-[#1e231d]">
    <PublicHeader active="mapa"/>
    <div className="mx-auto max-w-[1180px] px-5 pb-16 pt-12 sm:px-8 sm:pt-16">
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#a08c65]">Localizações</p>
      <h1 className="mt-3 text-[clamp(2rem,4vw,3.4rem)] font-semibold tracking-[-.055em]">Barbearias no mapa</h1>
      <p className="mt-3 max-w-[620px] text-[14px] leading-6 text-[#7e867a]">
        Escolha uma barbearia e veja sua região. A localização é aproximada enquanto o estabelecimento não informar endereço completo.
      </p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="mt-9 grid overflow-hidden rounded-2xl border border-[#e1e5dc] bg-white lg:min-h-[620px] lg:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="border-b border-[#e9ece6] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#edf0e9] p-5">
            <label htmlFor="map-search" className="sr-only">Filtrar estabelecimentos</label>
            <div className="flex items-center gap-2 rounded-xl border border-[#dfe4db] bg-[#fafbf9] px-3">
              <Search size={17} className="text-[#929c8e]"/>
              <input id="map-search" value={term} onChange={event => setTerm(event.target.value)}
                placeholder="Pesquisar barbearia ou cidade" className="h-11 w-full min-w-0 bg-transparent text-[13px] outline-none"/>
            </div>
          </div>
          <div className="max-h-[340px] overflow-auto lg:max-h-[550px]">
            {loading && <p className="p-5 text-xs text-[#848c80]">Carregando estabelecimentos...</p>}
            {!loading && !visible.length && <p className="p-5 text-sm text-[#858e81]">Nenhum estabelecimento encontrado.</p>}
            {visible.map(item => <button type="button" key={item.id} onClick={() => setSelected(item.id)}
              className={`flex w-full items-start gap-3 border-b border-[#eff0eb] p-5 text-left transition hover:bg-[#f8f9f6] ${selected === item.id ? "bg-[#f3f5ef]" : "bg-white"}`}>
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e7ebe3] text-[#5b6a57]"><MapPin size={17}/></span>
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{item.name}</span>
                <span className="mt-1 block text-xs leading-5 text-[#899186]">
                  {[item.neighborhood, [item.city,item.state].filter(Boolean).join(" / ")].filter(Boolean).join(" · ") || "Região não informada"}
                </span></span>
            </button>)}
          </div>
        </aside>
        <div className="flex min-h-[430px] flex-col">
          {mapUrl ? <iframe key={mapUrl} title={`Região de ${current?.name}`} src={mapUrl}
            referrerPolicy="no-referrer-when-downgrade" loading="lazy" className="min-h-[385px] w-full flex-1 border-0"/> :
            <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center bg-[#edf0e9] p-8 text-center">
              <MapPin size={37} className="text-[#9ba699]"/>
              <h2 className="mt-4 text-sm font-semibold">Selecione um estabelecimento com cidade informada</h2>
              <p className="mt-2 max-w-sm text-xs leading-5 text-[#838e80]">O mapa será exibido assim que houver localização cadastrada.</p>
            </div>}
          {current && <div className="flex flex-col justify-between gap-4 border-t border-[#e6e9e2] bg-white px-5 py-5 sm:flex-row sm:items-center">
            <div><p className="font-semibold">{current.name}</p>
              <p className="mt-1 text-xs text-[#858d83]">{region || "Localização a confirmar"} · Visualização aproximada</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {external && <a target="_blank" rel="noopener noreferrer" href={external}
                className="inline-flex items-center gap-2 rounded-xl border border-[#dfe4dc] px-4 py-3 text-xs font-semibold hover:bg-[#f5f7f2]">
                <Navigation size={15}/> Ver região
              </a>}
              <Link href={`/b/${current.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-[#1c211b] px-4 py-3 text-xs font-semibold text-white">
                Agendar <ArrowUpRight size={16}/>
              </Link>
            </div>
          </div>}
        </div>
      </div>
      <p className="mt-5 text-[12px] leading-5 text-[#919a8e]">O mapa não indica a localização exata da barbearia sem um endereço completo cadastrado. Confirme o endereço diretamente com o estabelecimento.</p>
    </div>
  </main>;
}
