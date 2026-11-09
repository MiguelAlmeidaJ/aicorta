"use client";

/* eslint-disable @next/next/no-img-element -- fotos de estabelecimentos são servidas pela API e imagens editoriais pelo Unsplash */
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Clock3, MapPin, Search, Scissors, X } from "lucide-react";
import { BrandLogo } from "../components/brand/brand-provider";
import { API_URL, apiJson } from "../lib/api";

type Establishment = {
  id: string; name: string; slug: string; city: string | null; state: string | null;
  neighborhood: string | null; coverUrl: string | null; hasCustomCover: boolean;
};

// Fotos de ambientação, nunca apresentadas como imagens reais das barbearias cadastradas.
const editorialCovers = [
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=950&q=80",
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=950&q=80",
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=950&q=80",
];
const heroPhoto = "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1450&q=85";

function locationLabel(item: Establishment) {
  const city = [item.city, item.state].filter(Boolean).join(" / ");
  return [item.neighborhood, city].filter(Boolean).join(" · ") || "Localização a confirmar";
}
function coverFor(item: Establishment, index: number) {
  return item.hasCustomCover && item.coverUrl ? `${API_URL}${item.coverUrl}` : editorialCovers[index % editorialCovers.length];
}

function BarberPhoto({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return broken ? <div className={`flex items-center justify-center bg-[#343832] text-white/60 ${className}`} aria-label={alt}>
    <Scissors size={34}/>
  </div> : <img src={src} alt={alt} className={className} loading="lazy" onError={() => setBroken(true)}/>;
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function search(value: string) {
    setLoading(true); setError("");
    try {
      const term = value.trim();
      const params = term ? `?q=${encodeURIComponent(term)}` : "";
      const results = await apiJson<Establishment[]>(`/public/tenants${params}`);
      setEstablishments(results); setSearched(term);
    } catch {
      setError("Não conseguimos carregar as barbearias agora. Tente novamente.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    apiJson<Establishment[]>("/public/tenants")
      .then(items => { if (active) setEstablishments(items); })
      .catch(() => { if (active) setError("Não conseguimos carregar as barbearias agora. Tente novamente."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(query);
    document.getElementById("barbearias")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <main className="min-h-dvh bg-[#f5f6f3] text-[#191c18]">
    <header className="relative z-10 border-b border-[#ebede7] bg-white">
      <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between gap-3 px-5 sm:h-[88px] sm:px-8">
        <Link href="/" aria-label="AICorta, início" className="inline-flex min-w-0 items-center">
          <BrandLogo className="h-11 max-w-[155px] sm:h-12 sm:max-w-[200px]"/>
        </Link>
        <nav aria-label="Sua conta" className="flex items-center gap-1 sm:gap-3">
          <Link href="/meus-agendamentos" className="hidden rounded-lg px-3 py-2 text-[13px] font-semibold text-[#5d6459] transition hover:bg-[#f4f5f2] hover:text-[#20241e] sm:inline-flex">
            Meus agendamentos
          </Link>
          <Link href="/login" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-[#545b51] transition hover:bg-[#f4f5f2]">
            Entrar
          </Link>
          <Link href="/admin/login" className="rounded-xl bg-[#1b1e1a] px-3.5 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#343a31] sm:px-5 sm:text-[13px]">
            Sou barbearia
          </Link>
        </nav>
      </div>
    </header>

    <section className="bg-[#191d19] text-white">
      <div className="mx-auto grid max-w-[1440px] lg:min-h-[530px] lg:grid-cols-[minmax(0,1.02fr)_minmax(0,.98fr)]">
        <div className="flex flex-col justify-center px-6 pb-12 pt-14 sm:px-12 sm:py-20 lg:pl-[max(48px,calc((100vw-1240px)/2))] lg:pr-12">
          <div className="flex items-center gap-3">
            <span className="h-px w-7 bg-[#e8bb43]"/>
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#e9c45d]">Seu horário, sua escolha</p>
          </div>
          <h1 className="mt-7 max-w-[610px] text-[clamp(2.65rem,5vw,4.65rem)] font-semibold leading-[1.09] tracking-[-.055em]">
            Um bom corte começa com um bom horário.
          </h1>
          <p className="mt-6 max-w-[470px] text-[15px] leading-7 text-[#bec5ba] sm:text-[16px]">
            Encontre uma barbearia, conheça os serviços e reserve seu próximo atendimento com praticidade.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] text-[#d7ddd2]">
            <span className="inline-flex items-center gap-2"><CalendarDays size={16} className="text-[#e9c45d]"/> Agende online</span>
            <span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-[#e9c45d]"/> Escolha seu horário</span>
          </div>
        </div>
        <div className="relative min-h-[250px] overflow-hidden bg-[#2d302b] sm:min-h-[360px] lg:min-h-full">
          <BarberPhoto src={heroPhoto} alt="Ambiente de barbearia, fotografia ilustrativa"
            className="absolute inset-0 h-full w-full object-cover object-center"/>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#191d19]/40 via-transparent to-transparent"/>
          <span className="absolute bottom-5 right-5 rounded-md bg-black/50 px-2.5 py-1.5 text-[10px] tracking-wide text-white/80 backdrop-blur-sm">
            Foto ilustrativa
          </span>
        </div>
      </div>
    </section>

    <section className="relative mx-auto max-w-[1240px] px-5 pt-8 sm:px-8 sm:pt-10" aria-labelledby="search-title">
      <div className="rounded-[20px] border border-[#e5e8e0] bg-white p-5 shadow-[0_10px_45px_rgba(12,19,12,.045)] sm:p-7">
        <div className="mb-4">
          <h2 id="search-title" className="text-[17px] font-bold tracking-tight sm:text-[19px]">Onde você quer agendar?</h2>
          <p className="mt-1 text-[12px] leading-5 text-[#858e81]">Pesquise pelo nome da barbearia, cidade ou bairro.</p>
        </div>
        <form role="search" onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="establishment-search" className="sr-only">Buscar barbearias por nome ou localização</label>
          <div className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#dfe3db] bg-[#fafbf9] px-4 transition-colors focus-within:border-[#9ba696] focus-within:bg-white">
            <Search size={19} className="shrink-0 text-[#818a7d]"/>
            <input id="establishment-search" type="search" value={query} maxLength={80}
              onChange={event => setQuery(event.target.value)} placeholder="Nome da barbearia, cidade ou bairro"
              className="min-w-0 flex-1 bg-transparent py-3.5 text-[14px] text-[#242923] outline-none placeholder:text-[#a0a79c]"/>
            {query && <button type="button" aria-label="Limpar busca" onClick={() => { setQuery(""); void search(""); }}
              className="text-[#81897e] hover:text-[#252a23]"><X size={17}/></button>}
          </div>
          <button type="submit" disabled={loading}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#1b1e1a] px-8 text-[13px] font-bold text-white transition hover:bg-[#363c33] disabled:cursor-wait disabled:opacity-60">
            <Search size={17}/>{loading ? "Buscando..." : "Buscar barbearias"}
          </button>
        </form>
      </div>
    </section>

    <section id="barbearias" className="mx-auto max-w-[1240px] scroll-mt-8 px-5 pb-20 pt-14 sm:px-8 sm:pb-24 sm:pt-20" aria-labelledby="establishments-title">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#888f83]">Encontre seu lugar</p>
          <h2 id="establishments-title" className="mt-2 text-[clamp(1.65rem,3vw,2.1rem)] font-bold tracking-[-.045em]">
            {searched ? "Resultados da sua busca" : "Barbearias disponíveis"}
          </h2>
          {searched && <p className="mt-2 text-sm text-[#7b8478]">Buscando por: <strong className="font-semibold text-[#353d33]">{searched}</strong></p>}
        </div>
        {!loading && !error && <p aria-live="polite" className="rounded-full border border-[#e0e4db] bg-white px-3.5 py-2 text-[12px] font-medium text-[#788273]">
          {establishments.length} {establishments.length === 1 ? "estabelecimento" : "estabelecimentos"}
        </p>}
      </div>
      {error && <div role="alert" className="mb-6 rounded-xl border border-[#edcfcb] bg-[#fff3f1] px-5 py-4 text-[13px] text-[#944640]">{error}</div>}
      {loading ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(item =>
        <div key={item} className="overflow-hidden rounded-2xl border border-[#e8ebe5] bg-white">
          <div className="aspect-[16/10] animate-pulse bg-[#e6e9e2]"/><div className="space-y-3 p-5">
            <div className="h-5 w-2/3 animate-pulse rounded bg-[#eef0ea]"/><div className="h-4 w-1/2 animate-pulse rounded bg-[#eef0ea]"/><div className="h-10 animate-pulse rounded-lg bg-[#eef0ea]"/>
          </div>
        </div>)}</div> : establishments.length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {establishments.map((item, index) => <article key={item.id} className="group flex flex-col overflow-hidden rounded-2xl border border-[#e2e6dd] bg-white shadow-[0_8px_30px_rgba(17,22,16,.035)] transition-all duration-300 hover:-translate-y-1 hover:border-[#c9d0c3] hover:shadow-[0_16px_40px_rgba(17,22,16,.09)]">
          <Link href={`/b/${item.slug}`} aria-label={`Conhecer ${item.name}`} className="relative block aspect-[16/10] overflow-hidden bg-[#30362e]">
            <BarberPhoto src={coverFor(item,index)} alt={item.hasCustomCover ? `Capa da barbearia ${item.name}` : "Foto ilustrativa de barbearia"}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent"/>
            {!item.hasCustomCover && <span className="absolute bottom-3 right-3 rounded-md bg-black/55 px-2 py-1 text-[10px] text-white/85 backdrop-blur-sm">Imagem ilustrativa</span>}
          </Link>
          <div className="flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
            <h3 className="min-w-0 text-[19px] font-bold leading-snug tracking-[-.025em] text-[#222821]">{item.name}</h3>
            <p className="mt-2.5 flex items-start gap-2 text-[12px] leading-5 text-[#788174]">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[#8c9788]"/>{locationLabel(item)}
            </p>
            <div className="mt-auto pt-6">
              <Link href={`/b/${item.slug}`} className="flex min-h-[46px] items-center justify-between rounded-xl border border-[#dce1d8] px-4 text-[13px] font-semibold text-[#273025] transition group-hover:border-[#222921] group-hover:bg-[#222921] group-hover:text-white">
                Ver serviços e horários <ArrowRight size={17}/>
              </Link>
            </div>
          </div>
        </article>)}
      </div> : <div className="rounded-2xl border border-[#e0e5db] bg-white px-6 py-16 text-center">
        <Search size={26} className="mx-auto text-[#899485]"/>
        <h3 className="mt-4 text-[16px] font-bold">Nenhuma barbearia encontrada</h3>
        <p className="mt-2 text-[13px] text-[#858e82]">Tente pesquisar outro nome, bairro ou cidade.</p>
        {searched && <button type="button" onClick={() => { setQuery(""); void search(""); }}
          className="mt-5 rounded-xl border border-[#dce1d6] px-5 py-2.5 text-xs font-semibold hover:bg-[#f5f7f2]">Ver todas as barbearias</button>}
      </div>}
    </section>

    <footer className="border-t border-[#e3e8df] bg-white">
      <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-5 px-5 py-8 sm:flex-row sm:items-center sm:px-8">
        <p className="text-[12px] font-semibold text-[#464d43]">AICorta <span className="ml-2 font-normal text-[#8a9385]">Agendamento simples, do seu jeito.</span></p>
        <div className="flex items-center gap-5 text-[12px] text-[#7e887a]">
          <Link href="/meus-agendamentos" className="hover:text-[#222821]">Meus agendamentos</Link>
          <Link href="/admin/login" className="hover:text-[#222821]">Área da barbearia</Link>
        </div>
      </div>
    </footer>
  </main>;
}
