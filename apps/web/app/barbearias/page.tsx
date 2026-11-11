"use client";

/* eslint-disable @next/next/no-img-element -- capas hospedadas pela API configurada */
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin, Search, Scissors } from "lucide-react";
import { PublicHeader } from "../../components/public/public-header";
import { PublicFooter } from "../../components/public/public-footer";
import { API_URL, apiJson } from "../../lib/api";

type Barbershop = {
  id: string; name: string; slug: string;
  city: string | null; state: string | null; neighborhood: string | null;
  street: string | null; streetNumber: string | null;
  latitude: number | null; longitude: number | null;
  coverUrl: string | null; hasCustomCover: boolean;
};
type PaginatedBarbershops = {
  items: Barbershop[]; page: number; pageSize: number; total: number; totalPages: number;
};

function ShopImage({ shop }: { shop: Barbershop }) {
  const [failed, setFailed] = useState(false);
  const src = shop.coverUrl ? API_URL + shop.coverUrl : null;
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <div className="flex h-full w-full items-center justify-center bg-[#e8eae5] text-[#929b8f]">
    <Scissors size={34} strokeWidth={1.25}/>
  </div>;
  return <img src={src} alt={`Capa de ${shop.name}`} loading="lazy"
    onError={() => setFailed(true)} className="h-full w-full object-cover object-center"/>;
}
function address(shop: Barbershop) {
  return [[shop.street, shop.streetNumber].filter(Boolean).join(", "),
    shop.neighborhood, [shop.city, shop.state].filter(Boolean).join(" / ")]
    .filter(Boolean).join(" · ") || "Localização a confirmar";
}

export default function BarbershopsPage() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedBarbershops | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (term) params.set("q", term);
    apiJson<PaginatedBarbershops>(`/public/barbershops?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(() => { if (!controller.signal.aborted) setError("Não foi possível carregar as barbearias. Tente novamente."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, term, revision]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1); setTerm(query.trim());
  }
  function navigate(next: number) {
    if (!result || next < 1 || next > result.totalPages) return;
    setPage(next);
    document.getElementById("directory-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return <main className="min-h-dvh bg-[#f6f7f4] text-[#1d231d]">
    <PublicHeader active="barbearias"/>
    <section className="border-b border-[#e4e7df] bg-[#fbfbfa]">
      <div className="mx-auto max-w-[1180px] px-5 pb-12 pt-14 sm:px-8 sm:pb-14 sm:pt-16">
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#a18452]">Estabelecimentos</p>
        <h1 className="mt-3 text-[clamp(2.2rem,4.6vw,3.7rem)] font-semibold tracking-[-.055em]">Encontre sua barbearia.</h1>
        <p className="mt-3 max-w-xl text-[14px] leading-7 text-[#7c8579]">
          Conheça os estabelecimentos disponíveis no AICorta e escolha onde reservar seu atendimento.
        </p>
        <form role="search" onSubmit={search} className="mt-8 flex max-w-[760px] flex-col gap-2 sm:flex-row">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#dfe5dc] bg-white px-4 focus-within:border-[#9cae94]">
            <Search size={17} className="shrink-0 text-[#889487]"/>
            <span className="sr-only">Buscar por nome, cidade ou bairro</span>
            <input type="search" value={query} maxLength={80} placeholder="Nome da barbearia, cidade ou bairro"
              onChange={e => setQuery(e.target.value)} className="w-full min-w-0 bg-transparent text-[13px] outline-none"/>
          </label>
          <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1d231c] px-6 text-[13px] font-semibold text-white hover:bg-[#343c31]">
            Buscar <ArrowRight size={16}/>
          </button>
        </form>
      </div>
    </section>
    <section id="directory-results" className="mx-auto max-w-[1180px] scroll-mt-10 px-5 pb-20 pt-10 sm:px-8 sm:pt-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-[-.035em]">{term ? "Resultados da busca" : "Todas as barbearias"}</h2>
        {result && !loading && <p className="text-[12px] text-[#859080]">
          {result.total} {result.total === 1 ? "barbearia encontrada" : "barbearias encontradas"}
        </p>}
      </div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}
        <button onClick={() => { setRevision(value => value + 1); }} className="ml-3 underline" type="button">Tentar novamente</button>
      </div>}
      {loading ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {Array.from({length: 6},(_,i) => <div key={i} className="overflow-hidden rounded-[18px] border border-[#e5e8e1] bg-white">
          <div className="aspect-[16/10] animate-pulse bg-[#e8ebe5]"/>
          <div className="space-y-3 p-5"><div className="h-5 w-2/3 animate-pulse rounded bg-[#ecefe9]"/><div className="h-4 w-full animate-pulse rounded bg-[#ecefe9]"/></div>
        </div>)}
      </div> : result?.items.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.map(shop => <article key={shop.id} className="group flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-[#e1e6dd] bg-white shadow-[0_6px_20px_rgba(19,25,18,.035)] transition hover:border-[#c2d0bd]">
          <Link href={`/b/${shop.slug}`} aria-label={`Conhecer ${shop.name}`} className="block aspect-[16/10] overflow-hidden bg-[#eef1ea]">
            <ShopImage shop={shop}/>
          </Link>
          <div className="flex flex-1 flex-col p-5">
            <h3 className="text-[19px] font-semibold leading-snug tracking-[-.035em]">{shop.name}</h3>
            <p className="mt-3 flex min-h-[42px] items-start gap-2 text-[12px] leading-5 text-[#7e887c]">
              <MapPin size={15} className="mt-0.5 shrink-0 text-[#a88b55]"/><span className="line-clamp-2">{address(shop)}</span>
            </p>
            <Link href={`/b/${shop.slug}`} className="mt-5 inline-flex min-h-11 items-center justify-between rounded-xl bg-[#1d231c] px-4 text-[12px] font-semibold text-white hover:bg-[#353e32]">
              Ver serviços e agendar <ArrowUpRight size={16}/>
            </Link>
          </div>
        </article>)}
      </div> : !error && <div className="rounded-2xl border border-[#e2e7de] bg-white px-5 py-16 text-center">
        <Search size={26} className="mx-auto text-[#a0a99e]"/>
        <h3 className="mt-4 text-base font-semibold">Nenhuma barbearia encontrada</h3>
        <p className="mt-2 text-[13px] text-[#858f82]">Experimente outro nome ou localidade.</p>
        <button type="button" onClick={() => { setQuery(""); setTerm(""); setPage(1); }} className="mt-5 rounded-xl border border-[#dfe6dc] px-4 py-3 text-xs font-semibold">Limpar filtros</button>
      </div>}
      {!loading && !!result?.totalPages && result.totalPages > 1 && <nav aria-label="Paginação das barbearias" className="mt-9 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => navigate(page - 1)} disabled={page === 1}
          className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#dfe5dc] bg-white px-3 text-xs font-semibold disabled:opacity-40">
          <ArrowLeft size={15}/> Anterior
        </button>
        {Array.from({length: result.totalPages}, (_, index) => index + 1)
          .filter(value => Math.abs(value - page) <= 2 || value === 1 || value === result.totalPages)
          .map((value, index, all) => <span key={value} className="inline-flex items-center gap-2">
            {index > 0 && value - all[index - 1] > 1 && <span className="px-1 text-xs text-[#879285]">…</span>}
            <button type="button" onClick={() => navigate(value)} aria-current={page === value ? "page" : undefined}
              className={`h-10 min-w-10 rounded-xl px-3 text-xs font-bold ${page === value ? "bg-[#1d231c] text-white" : "border border-[#dfe5dc] bg-white text-[#566152]"}`}>{value}</button>
          </span>)}
        <button type="button" onClick={() => navigate(page + 1)} disabled={page === result.totalPages}
          className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#dfe5dc] bg-white px-3 text-xs font-semibold disabled:opacity-40">
          Próxima <ArrowRight size={15}/>
        </button>
      </nav>}
    </section>
    <PublicFooter/>
  </main>;
}
