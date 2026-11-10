"use client";

/* eslint-disable @next/next/no-img-element -- imagens de capa hospedadas na API do AICorta */
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Clock3, MapPin, Search, Scissors, X } from "lucide-react";
import { PublicHeader } from "../components/public/public-header";
import { PublicFooter } from "../components/public/public-footer";
import { API_URL, apiJson } from "../lib/api";

type Faq = { id: string; question: string; answer: string };

type Establishment = {
  id: string; name: string; slug: string; city: string | null; state: string | null;
  neighborhood: string | null; street?: string | null; streetNumber?: string | null; latitude?: number | null; longitude?: number | null; coverUrl: string | null; hasCustomCover?: boolean;
};

function locationLabel(item: Establishment) {
  const city = [item.city, item.state].filter(Boolean).join(" / ");
  return [[item.street, item.streetNumber].filter(Boolean).join(", "), item.neighborhood, city]
    .filter(Boolean).join(" · ") || "Localização a confirmar";
}
function ShopCover({ item, className = "" }: { item: Establishment; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = item.coverUrl ? `${API_URL}${item.coverUrl}` : null;
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? <img src={src} alt={`Capa de ${item.name}`} loading="lazy"
    onError={() => setFailed(true)} className={`${item.hasCustomCover ? "object-cover" : "object-contain px-8 py-6 sm:px-12 sm:py-8"} h-full w-full ${className}`}/> :
    <div className="flex h-full w-full items-center justify-center bg-[#ecede8] text-[#858f80]" aria-label="Sem imagem de capa">
      <Scissors size={38} strokeWidth={1.2}/>
    </div>;
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [faq, setFaq] = useState<Faq[]>([]);

  async function search(term: string) {
    setLoading(true); setError("");
    try {
      const value = term.trim();
      const params = value ? `?q=${encodeURIComponent(value)}` : "";
      setEstablishments(await apiJson<Establishment[]>(`/public/tenants${params}`));
      setSearched(value);
    } catch {
      setError("Não foi possível consultar os estabelecimentos. Tente novamente.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    apiJson<Faq[]>("/public/faq").then(items => { if (active) setFaq(items); }).catch(() => null);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    apiJson<Establishment[]>("/public/tenants")
      .then(items => { if (active) setEstablishments(items); })
      .catch(() => { if (active) setError("Não foi possível carregar as barbearias."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(query);
    document.getElementById("barbearias")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <main className="min-h-dvh bg-[#f6f6f3] text-[#1b1e1a]">
    <PublicHeader active="inicio"/>
    <section className="border-b border-[#e7e9e2] bg-[#fbfbf9]">
      <div className="mx-auto grid max-w-[1180px] items-center gap-11 px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,.96fr)] lg:gap-16 lg:py-24">
        <div>
          <div className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[.19em] text-[#8e7851]">
            <span className="h-[2px] w-7 bg-[#be963e]"/> O cuidado começa por você
          </div>
          <h1 className="mt-7 max-w-[620px] text-[clamp(2.7rem,5.5vw,4.9rem)] font-semibold leading-[1.07] tracking-[-.065em]">
            Seu próximo corte, <span className="text-[#7e857a]">no horário certo.</span>
          </h1>
          <p className="mt-6 max-w-[470px] text-[15px] leading-7 text-[#757c72] sm:text-[16px]">
            Descubra barbearias, escolha seu profissional e agende com tranquilidade. Tudo em poucos passos.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="#busca" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#1d211c] px-6 text-[13px] font-semibold text-white transition hover:bg-[#393f37]">
              Encontrar barbearia <ArrowRight size={17}/>
            </a>
            <Link href="/mapa" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#dedfd9] bg-white px-5 text-[13px] font-semibold text-[#3e463c] transition hover:border-[#aab0a5]">
              <MapPin size={16}/> Explorar mapa
            </Link>
          </div>
          <div className="mt-11 flex flex-wrap gap-x-8 gap-y-3 border-t border-[#e5e8e1] pt-6 text-[12px] font-medium text-[#777f73]">
            <span className="inline-flex items-center gap-2"><CalendarDays size={16} className="text-[#a88a4b]"/> Reserva online</span>
            <span className="inline-flex items-center gap-2"><Clock3 size={16} className="text-[#a88a4b]"/> Horários disponíveis</span>
          </div>
        </div>
        <div className="relative">
          <div className="grid aspect-[1.2/1] grid-cols-[1.6fr_.76fr] gap-3 overflow-hidden sm:aspect-[1.4/1] lg:aspect-[1.02/1]">
            <div className="relative min-w-0 overflow-hidden rounded-[18px] bg-[#292c27]">
              {/* eslint-disable-next-line @next/next/no-img-element -- fotografia editorial licenciada no Unsplash */}
              <img src="https://images.unsplash.com/photo-1672257493626-038f96997ade?auto=format&fit=crop&w=1200&q=85"
                alt="Interior real de barbearia com cadeiras de corte e espelhos"
                className="h-full w-full object-cover" loading="eager"/>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px] bg-[#292c27]">
                {/* eslint-disable-next-line @next/next/no-img-element -- fotografia editorial de barbearia */}
                <img src="https://images.unsplash.com/photo-1703792686658-24e62d626ed2?auto=format&fit=crop&w=650&q=85"
                  alt="Profissional realizando um corte de cabelo"
                  className="h-full w-full object-cover" loading="lazy"/>
              </div>
              <div className="flex h-[27%] min-h-0 items-end rounded-[18px] bg-[#1d221c] p-3 text-white sm:p-5">
                <div><Scissors size={21} className="text-[#e3bc62]"/>
                  <p className="mt-2 text-[11px] font-medium leading-4 text-[#d8dfd2] sm:text-[13px] sm:leading-5">Seu estilo merece cuidado.</p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-right text-[10px] text-[#989e94]">Fotografias reais de barbearias · Imagens ilustrativas</p>
        </div>
      </div>
    </section>

    <section id="busca" aria-labelledby="search-title" className="scroll-mt-6 bg-[#f6f6f3]">
      <div className="mx-auto max-w-[1180px] px-5 pt-12 sm:px-8 sm:pt-16">
        <div className="relative overflow-hidden rounded-[22px] bg-[#1d221d] text-white shadow-[0_18px_52px_rgba(16,24,16,.09)]">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[34%] lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto editorial, não é capa de um estabelecimento */}
            <img src="https://images.unsplash.com/photo-1703792686658-24e62d626ed2?auto=format&fit=crop&w=850&q=85"
              alt="" aria-hidden="true" loading="lazy" className="h-full w-full object-cover object-center opacity-70"/>
            <div className="absolute inset-0 bg-gradient-to-r from-[#1d221d] via-[#1d221d]/50 to-transparent"/>
          </div>
          <div className="relative z-10 p-6 sm:p-9 lg:max-w-[77%] lg:px-11 lg:py-11">
            <h2 id="search-title" className="text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-.045em]">
              Encontre o lugar certo para você.
            </h2>
            <p className="mt-2 max-w-lg text-[13px] leading-6 text-[#bfc6bb]">
              Busque pelo nome da barbearia ou pela região onde deseja agendar.
            </p>
            <form role="search" onSubmit={submit} className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <label htmlFor="establishment-search" className="sr-only">Buscar barbearias por nome, cidade ou bairro</label>
              <div className="flex h-[54px] min-w-0 flex-1 items-center gap-3 rounded-xl bg-white px-4 text-[#252b23] ring-1 ring-white/20 focus-within:ring-2 focus-within:ring-[#dcc27c]">
                <Search size={19} className="shrink-0 text-[#80897e]"/>
                <input id="establishment-search" type="search" maxLength={80} value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Nome da barbearia, cidade ou bairro"
                  className="w-full min-w-0 bg-transparent text-[14px] outline-none placeholder:text-[#9da49a]"/>
                {query && <button type="button" aria-label="Limpar busca" onClick={() => { setQuery(""); void search(""); }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#737d71] hover:bg-[#eef0eb]"><X size={16}/></button>}
              </div>
              <button type="submit" disabled={loading}
                className="inline-flex min-h-[54px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#e2bf68] px-7 text-[13px] font-bold text-[#1b2119] transition hover:bg-[#f1d58f] disabled:opacity-60">
                <Search size={17}/>{loading ? "Buscando..." : "Buscar"}
              </button>
            </form>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px]">
              <Link href="/mapa" className="inline-flex items-center gap-2 font-medium text-[#d4dcd1] hover:text-white">
                <MapPin size={15} className="text-[#e2bf68]"/> Explorar no mapa <ArrowUpRight size={14}/>
              </Link>
              {searched && <button type="button" onClick={() => { setQuery(""); void search(""); }}
                className="font-medium text-[#d4dcd1] underline underline-offset-4 hover:text-white">Ver todas as barbearias</button>}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="barbearias" className="mx-auto max-w-[1180px] scroll-mt-8 px-5 pb-20 pt-14 sm:px-8 sm:pb-24 sm:pt-20" aria-labelledby="establishments-heading">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#e1e5dc] pb-7">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#9c8053]">
            {searched ? "Sua busca" : "Explore e agende"}
          </p>
          <h2 id="establishments-heading" className="mt-2 text-[clamp(1.9rem,3.7vw,2.65rem)] font-semibold tracking-[-.055em] leading-[1.15]">
            {searched ? "Barbearias encontradas" : "Barbearias para conhecer"}
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-[#7e887a]">
            {searched ? <>Resultados para <strong className="font-semibold text-[#30392f]">{searched}</strong>.</>
              : "Conheça os estabelecimentos, veja os serviços e escolha seu próximo horário."}
          </p>
        </div>
        {!loading && !error && <span aria-live="polite"
          className="rounded-full border border-[#dce2d8] bg-white px-4 py-2 text-[12px] font-semibold text-[#576152]">
          {establishments.length} {establishments.length === 1 ? "barbearia" : "barbearias"}
        </span>}
      </div>
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {loading ? <div className="grid gap-5 lg:grid-cols-2">
        {[1,2].map(index => <div key={index} className="overflow-hidden rounded-[20px] border border-[#e5e9e1] bg-white sm:flex">
          <div className="h-[225px] animate-pulse bg-[#e5e8e0] sm:h-[238px] sm:w-[44%]"/>
          <div className="flex-1 space-y-4 p-7"><div className="h-6 w-2/3 animate-pulse rounded bg-[#eceee8]"/>
            <div className="h-4 w-full animate-pulse rounded bg-[#eceee8]"/>
            <div className="h-12 animate-pulse rounded-lg bg-[#eceee8]"/></div>
        </div>)}
      </div> : establishments.length ? <div className="grid gap-5 lg:grid-cols-2">
        {establishments.map(item => <article key={item.id}
          className="group flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#e2e5de] bg-white shadow-[0_8px_28px_rgba(18,25,17,.035)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c5cfc1] hover:shadow-[0_18px_42px_rgba(18,25,17,.075)] sm:flex-row lg:min-h-[254px]">
          <Link href={`/b/${item.slug}`} aria-label={`Conhecer ${item.name}`}
            className={`relative block h-[195px] shrink-0 overflow-hidden sm:h-auto sm:w-[42%] ${item.hasCustomCover ? "bg-[#e1e5df]" : "bg-[#f4f5f1]"}`}>
            <ShopCover item={item} className={item.hasCustomCover
              ? "transition-transform duration-500 group-hover:scale-[1.035]"
              : "transition-transform duration-500 group-hover:scale-[1.015]"}/>
            {!item.hasCustomCover && <span className="pointer-events-none absolute inset-x-4 bottom-4 text-center text-[10px] font-semibold uppercase tracking-[.12em] text-[#a6ada1]">Identidade visual do AICorta</span>}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#9a8054]">
              <span className="h-[5px] w-[5px] rounded-full bg-[#d4b164]"/> Estabelecimento
            </div>
            <h3 className="text-[21px] font-semibold leading-tight tracking-[-.045em] text-[#202620]">{item.name}</h3>
            <p className="mt-3 flex items-start gap-2 text-[12px] leading-5 text-[#768072]">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[#aa8c56]"/>
              <span className="line-clamp-2">{locationLabel(item)}</span>
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              <Link href={`/b/${item.slug}`}
                className="inline-flex min-h-[45px] flex-1 items-center justify-between gap-3 rounded-xl bg-[#1d221c] px-4 text-[12px] font-semibold text-white transition hover:bg-[#343c32]">
                Agendar horário <ArrowUpRight size={16}/>
              </Link>
              {item.latitude != null && item.longitude != null &&
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`}
                  target="_blank" rel="noopener noreferrer" title="Como chegar"
                  className="flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-xl border border-[#dfe5da] text-[#4e5c4a] transition hover:bg-[#f2f5ef]"
                  aria-label={`Como chegar à ${item.name}`}><MapPin size={18}/></a>}
            </div>
          </div>
        </article>)}
      </div> : <div className="rounded-2xl border border-[#e2e6de] bg-white px-6 py-16 text-center">
        <Search size={27} className="mx-auto text-[#9ca398]"/>
        <h3 className="mt-4 text-base font-semibold">Nenhuma barbearia encontrada</h3>
        <p className="mt-2 text-sm text-[#858d81]">Tente outro nome ou localidade para encontrar estabelecimentos.</p>
        <button type="button" onClick={() => { setQuery(""); void search(""); }}
          className="mt-5 rounded-xl border border-[#dfe3da] px-5 py-3 text-xs font-semibold transition hover:bg-[#f6f7f4]">Ver todas as barbearias</button>
      </div>}
      <div className="relative mt-11 flex flex-col items-start justify-between gap-6 overflow-hidden rounded-[20px] bg-[#1d241e] px-6 py-8 text-white sm:flex-row sm:items-center sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-10 -top-20 h-[220px] w-[220px] rounded-full border border-[#ffffff12]"/>
        <div className="pointer-events-none absolute -bottom-24 right-[14%] h-[200px] w-[200px] rounded-full border border-[#ffffff10]"/>
        <div className="relative z-10 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#ffffff20] bg-[#ffffff10] text-[#ebc678]">
            <MapPin size={22}/>
          </span>
          <div>
            <h3 className="text-[19px] font-semibold tracking-[-.035em]">Encontre no mapa</h3>
            <p className="mt-1 max-w-[510px] text-[13px] leading-6 text-[#bac5b9]">
              Veja onde ficam as barbearias e descubra o melhor caminho para chegar.
            </p>
          </div>
        </div>
        <Link href="/mapa" className="relative z-10 inline-flex min-h-[46px] w-full shrink-0 items-center justify-center gap-3 rounded-xl bg-white px-6 text-[12px] font-semibold text-[#1e281f] transition hover:bg-[#f0e9d9] sm:w-auto">
          Explorar mapa <ArrowUpRight size={16}/>
        </Link>
      </div>
    </section>
    {faq.length > 0 && <section aria-labelledby="faq-heading" className="border-t border-[#e7eae4] bg-white">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] lg:gap-16">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#9e895b]">Tire suas dúvidas</p>
          <h2 id="faq-heading" className="mt-3 text-[clamp(1.9rem,3.5vw,2.7rem)] font-semibold leading-[1.15] tracking-[-.05em]">Perguntas frequentes</h2>
          <p className="mt-4 max-w-sm text-[14px] leading-7 text-[#818a7e]">Respostas para você agendar com mais facilidade.</p>
          <Link href="/contato" className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-[#30372d] hover:underline">
            Precisa de ajuda? <ArrowUpRight size={16}/>
          </Link>
        </div>
        <div className="divide-y divide-[#e6e9e3] border-y border-[#e6e9e3]">
          {faq.map((item,index) => <details key={item.id} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center gap-4 text-left [&::-webkit-details-marker]:hidden">
              <span className="text-[11px] font-bold text-[#a6ac9e]">{String(index+1).padStart(2,"0")}</span>
              <span className="min-w-0 flex-1 text-[14px] font-semibold leading-6 text-[#272d25] sm:text-[15px]">{item.question}</span>
              <ChevronDown size={18} className="shrink-0 text-[#7e887c] transition-transform group-open:rotate-180"/>
            </summary>
            <p className="pb-1 pl-9 pr-8 pt-3 text-[13px] leading-7 text-[#747e72]">{item.answer}</p>
          </details>)}
        </div>
      </div>
    </section>}
    <PublicFooter/>
  </main>;
}
