"use client";

/* eslint-disable @next/next/no-img-element -- imagens de capa hospedadas na API do AICorta */
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Clock3, MapPin, Search, Scissors, X } from "lucide-react";
import { PublicHeader } from "../components/public/public-header";
import { API_URL, apiJson } from "../lib/api";

type Faq = { id: string; question: string; answer: string };

type Establishment = {
  id: string; name: string; slug: string; city: string | null; state: string | null;
  neighborhood: string | null; coverUrl: string | null; hasCustomCover?: boolean;
};

function locationLabel(item: Establishment) {
  const city = [item.city, item.state].filter(Boolean).join(" / ");
  return [item.neighborhood, city].filter(Boolean).join(" · ") || "Endereço não informado";
}
function ShopCover({ item, className = "" }: { item: Establishment; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = item.coverUrl ? `${API_URL}${item.coverUrl}` : null;
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? <img src={src} alt={`Capa de ${item.name}`} loading="lazy"
    onError={() => setFailed(true)} className={`h-full w-full object-cover ${className}`}/> :
    <div className="flex h-full w-full items-center justify-center bg-[#e7e9e3] text-[#9ca39a]" aria-label="Sem imagem de capa">
      <Scissors size={36} strokeWidth={1.3}/>
    </div>;
}

function PublicFooter() {
  return <footer className="border-t border-[#e7e9e3] bg-white">
    <div className="mx-auto flex max-w-[1180px] flex-col justify-between gap-6 px-5 py-9 sm:px-8 lg:flex-row lg:items-center">
      <div><p className="text-[16px] font-bold tracking-[-.04em]">AICorta<span className="text-[#bb9235]">.</span></p>
        <p className="mt-1 text-xs text-[#92978f]">Seu horário. Seu estilo.</p></div>
      <nav aria-label="Links do rodapé" className="flex flex-wrap gap-5 text-xs font-medium text-[#656c62]">
        <Link href="/" className="hover:text-black">Início</Link>
        <Link href="/mapa" className="hover:text-black">Mapa</Link>
        <Link href="/contato" className="hover:text-black">Contato</Link>
        <Link href="/meus-agendamentos" className="hover:text-black">Meus agendamentos</Link>
      </nav>
      <p className="text-xs text-[#9ba098]">© {new Date().getFullYear()} AICorta</p>
    </div>
  </footer>;
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

    <section id="busca" className="scroll-mt-6 bg-white">
      <div className="mx-auto max-w-[1180px] px-5 py-9 sm:px-8 sm:py-11">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="shrink-0">
            <h2 className="text-[20px] font-semibold tracking-tight">Encontre sua barbearia</h2>
            <p className="mt-1 text-[12px] text-[#8c9388]">Pesquise por nome, cidade ou bairro.</p>
          </div>
          <form role="search" onSubmit={submit} className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-[630px]">
            <label htmlFor="establishment-search" className="sr-only">Buscar barbearia</label>
            <div className="flex h-[52px] min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#dfe3db] bg-[#f9faf7] px-4 focus-within:border-[#a2aa9c]">
              <Search size={18} className="shrink-0 text-[#838b7f]"/>
              <input id="establishment-search" type="search" maxLength={80} value={query} onChange={event => setQuery(event.target.value)}
                placeholder="Nome, cidade ou bairro" className="w-full min-w-0 bg-transparent text-[14px] outline-none placeholder:text-[#a4aaa0]"/>
              {query && <button type="button" aria-label="Limpar busca" onClick={() => { setQuery(""); void search(""); }}><X size={16} className="text-[#92988f]"/></button>}
            </div>
            <button type="submit" disabled={loading} className="h-[52px] rounded-xl bg-[#1d211c] px-7 text-[13px] font-semibold text-white hover:bg-[#353b33] disabled:opacity-50">
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </form>
        </div>
      </div>
    </section>

    <section id="barbearias" className="mx-auto max-w-[1180px] scroll-mt-8 px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#9b8b6c]">Nossos estabelecimentos</p>
          <h2 className="mt-2 text-[clamp(1.7rem,3vw,2.3rem)] font-semibold tracking-[-.045em]">
            {searched ? "Resultados encontrados" : "Escolha onde cuidar do visual"}
          </h2>
          {searched && <p className="mt-2 text-sm text-[#858c81]">Busca: {searched}</p>}
        </div>
        {!loading && !error && <span className="text-[12px] font-medium text-[#8a9286]">{establishments.length} {establishments.length === 1 ? "barbearia" : "barbearias"}</span>}
      </div>
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {loading ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1,2,3].map(index => <div key={index} className="h-[390px] animate-pulse rounded-2xl bg-[#e8eae5]"/>)}
      </div> : establishments.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {establishments.map(item => <article key={item.id} className="group overflow-hidden rounded-[18px] border border-[#e4e7df] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-[#c8cfc3] hover:shadow-[0_14px_35px_rgba(14,22,13,.06)]">
          <Link href={`/b/${item.slug}`} aria-label={`Conhecer ${item.name}`} className="block aspect-[1.55/1] overflow-hidden bg-[#e7e9e3]">
            <ShopCover item={item} className="transition-transform duration-500 group-hover:scale-[1.025]"/>
          </Link>
          <div className="px-5 pb-5 pt-5">
            <h3 className="truncate text-[19px] font-semibold tracking-[-.035em]">{item.name}</h3>
            <p className="mt-2 flex min-h-5 items-center gap-2 text-[12px] text-[#838b7e]">
              <MapPin size={14} className="shrink-0"/>{locationLabel(item)}
            </p>
            <Link href={`/b/${item.slug}`} className="mt-5 flex items-center justify-between border-t border-[#eff0eb] pt-4 text-[12px] font-semibold text-[#282e27] hover:text-[#92713d]">
              Ver serviços e horários <ArrowUpRight size={17}/>
            </Link>
          </div>
        </article>)}
      </div> : <div className="rounded-2xl border border-[#e2e6de] bg-white px-6 py-14 text-center">
        <Search size={27} className="mx-auto text-[#9ca398]"/>
        <h3 className="mt-4 text-base font-semibold">Nenhuma barbearia encontrada</h3>
        <p className="mt-2 text-sm text-[#858d81]">Tente outra busca ou visualize todos os estabelecimentos.</p>
        <button type="button" onClick={() => { setQuery(""); void search(""); }}
          className="mt-5 rounded-xl border border-[#dfe3da] px-4 py-2.5 text-xs font-semibold">Limpar busca</button>
      </div>}
      <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-2xl border border-[#e4e8df] bg-white px-6 py-6 sm:flex-row sm:items-center sm:px-8">
        <div><p className="text-[15px] font-semibold">Prefere buscar pela localização?</p>
          <p className="mt-1 text-[12px] text-[#899187]">Explore os estabelecimentos por cidade e região.</p></div>
        <Link href="/mapa" className="inline-flex items-center gap-2 rounded-xl border border-[#d9ded5] px-5 py-3 text-xs font-semibold hover:bg-[#f5f6f2]"><MapPin size={16}/> Abrir mapa <ArrowRight size={16}/></Link>
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
