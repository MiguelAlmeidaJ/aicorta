"use client";

/* eslint-disable @next/next/no-img-element -- imagens públicas vêm da API configurável */
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, MapPin, Search, Scissors } from "lucide-react";
import { BrandLogo } from "../components/brand/brand-provider";
import { API_URL, apiJson } from "../lib/api";

type Establishment = {
  id: string; name: string; slug: string; city: string | null; state: string | null;
  neighborhood: string | null; coverUrl: string | null;
};

function locationLabel(item: Establishment) {
  const city = [item.city, item.state].filter(Boolean).join(" / ");
  return [item.neighborhood, city].filter(Boolean).join(" · ") || "Localização a confirmar";
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function search(value: string) {
    setLoading(true); setError("");
    try {
      const params = value.trim() ? `?q=${encodeURIComponent(value.trim())}` : "";
      setEstablishments(await apiJson<Establishment[]>(`/public/tenants${params}`));
    } catch { setError("Não foi possível carregar os estabelecimentos agora."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    apiJson<Establishment[]>("/public/tenants")
      .then(items => { if (active) setEstablishments(items); })
      .catch(() => { if (active) setError("Não foi possível carregar os estabelecimentos agora."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void search(query); }

  return <main className="min-h-screen bg-[#f6f7f3] text-[#171916]">
    <header className="border-b border-[#e5e7e0] bg-white/90"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <BrandLogo className="h-12 max-w-[220px]"/><nav aria-label="Acesso" className="flex items-center gap-2 text-sm font-semibold">
        <Link href="/login" className="rounded-xl px-4 py-2.5 text-[#555b52] hover:bg-[#f1f2ee]">Entrar</Link>
        <Link href="/admin/login" className="rounded-xl bg-[#171916] px-4 py-2.5 text-white hover:bg-[#30332d]">Painel</Link>
      </nav></div></header>
    <section className="border-b border-[#e5e7e0] bg-[#171916] text-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_440px] lg:items-end">
      <div><span className="text-xs font-bold uppercase tracking-[.2em] text-[#efc524]">Agende do seu jeito</span>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-[-.055em] sm:text-6xl">Encontre sua barbearia. Escolha seu horário.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-[#b7bcb2]">Serviços, profissionais e horários disponíveis em um só lugar, sem ligações e sem espera.</p></div>
      <form onSubmit={submit} role="search" className="rounded-2xl bg-white p-2 shadow-2xl shadow-black/20"><label htmlFor="establishment-search" className="sr-only">Buscar por nome ou localização</label>
        <div className="flex items-center gap-2"><Search size={20} className="ml-3 shrink-0 text-[#777d73]"/>
          <input id="establishment-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, cidade ou bairro" className="min-w-0 flex-1 px-2 py-3 text-sm text-[#171916] outline-none"/>
          <button disabled={loading} className="rounded-xl bg-[#efc524] px-5 py-3 text-sm font-bold text-[#171916] hover:bg-[#ffd83f] disabled:opacity-60">{loading ? "Buscando..." : "Buscar"}</button>
        </div></form>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20" aria-labelledby="establishments-title">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a8f86]">Estabelecimentos</p>
        <h2 id="establishments-title" className="mt-2 text-3xl font-bold tracking-[-.04em]">Escolha onde cuidar do visual</h2></div>
        {!loading && <p className="text-sm text-[#7d8279]">{establishments.length} resultado(s)</p>}</div>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}
      {loading ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(item => <div key={item} className="h-80 animate-pulse rounded-2xl bg-[#e5e7e1]"/>)}</div> :
      establishments.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{establishments.map(item => <article key={item.id} className="group overflow-hidden rounded-2xl border border-[#e1e3dc] bg-white shadow-[0_8px_28px_#00000008]">
        <div className="relative aspect-[16/10] overflow-hidden bg-[#e9ebe5]">{item.coverUrl ? <img src={`${API_URL}${item.coverUrl}`} alt={`Capa de ${item.name}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/> :
          <div className="flex h-full items-center justify-center"><Scissors size={34} className="text-[#92988e]"/></div>}</div>
        <div className="p-5"><h3 className="text-xl font-bold tracking-tight">{item.name}</h3><p className="mt-2 flex items-center gap-2 text-sm text-[#777d73]"><MapPin size={15} className="shrink-0"/>{locationLabel(item)}</p>
          <Link href={`/b/${item.slug}`} className="mt-5 flex items-center justify-between rounded-xl bg-[#171916] px-4 py-3 text-sm font-bold text-white hover:bg-[#30332d]">Ver estabelecimento <ArrowRight size={17}/></Link></div>
      </article>)}</div> : <div className="rounded-2xl border border-[#e1e3dc] bg-white px-6 py-16 text-center"><Search className="mx-auto text-[#91968d]"/><h3 className="mt-4 font-bold">Nenhuma barbearia encontrada</h3><p className="mt-2 text-sm text-[#858a81]">Tente buscar por outro nome, cidade ou bairro.</p></div>}
    </section>
    <footer className="border-t border-[#e3e5de] px-5 py-8 text-center text-xs text-[#858a81]">© AICorta · Agendamento simples para você</footer>
  </main>;
}
