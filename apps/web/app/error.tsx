"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function AppError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AICorta] Falha ao carregar tela:", error);
  }, [error]);
  return <main className="flex min-h-[70vh] items-center justify-center bg-[#f7f8f5] px-5 py-16 text-[#1c231c]">
    <section className="w-full max-w-md rounded-2xl border border-[#e2e8dd] bg-white p-7 text-center shadow-sm sm:p-9">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f4f1e7] text-[#a08144]">
        <AlertTriangle size={22}/>
      </span>
      <h1 className="mt-5 text-xl font-bold tracking-[-.035em]">Não foi possível abrir esta tela</h1>
      <p className="mt-3 text-[13px] leading-6 text-[#7f897c]">
        Ocorreu uma falha inesperada. Você pode tentar novamente sem precisar repetir a reserva.
        Se estava finalizando um agendamento, confira primeiro a lista de reservas.
      </p>
      <div className="mt-7 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={reset}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d221c] px-4 text-xs font-semibold text-white">
          <RefreshCcw size={16}/> Tentar novamente
        </button>
        <Link href="/meus-agendamentos"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#dfe5d9] px-4 text-xs font-semibold">
          Ver meus agendamentos
        </Link>
      </div>
    </section>
  </main>;
}
