import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

export const money = (cents: number) => new Intl.NumberFormat("pt-BR",
  { style: "currency", currency: "BRL" }).format(cents / 100);
export const shortDate = (value: string | Date) => new Intl.DateTimeFormat("pt-BR",
  { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
export const dateTime = (value: string | Date, zone = "America/Sao_Paulo") =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: zone }).format(new Date(value));

export const fieldClass = "w-full rounded-xl border border-[#e1e3dd] bg-white px-4 py-3 text-sm text-[#151715] outline-none transition focus:border-[#111] focus:ring-2 focus:ring-black/5";
export const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#111210] px-5 py-2.5 text-sm font-semibold text-[#f8f9f6] transition hover:bg-[#343634] disabled:cursor-not-allowed disabled:opacity-40";
export const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#e4e5e0] bg-white px-4 py-2 text-sm font-semibold text-[#232523] transition hover:bg-[#f1f2ee] disabled:opacity-40";

export function PageHeader({ kicker, title, description, action }: {
  kicker: string; title: string; description?: string; action?: ReactNode;
}) {
  return <div className="mb-5 flex min-w-0 flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end sm:gap-5">
    <div className="min-w-0 max-w-2xl">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] sm:mb-3 sm:text-[11px] sm:tracking-[.22em] text-[#888d85]">{kicker}</div>
      <h1 className="break-words text-[clamp(1.55rem,6.3vw,2.25rem)] font-bold leading-tight tracking-[-.05em] text-[#151715] sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 text-[13px] leading-5 text-[#7d827a] sm:mt-3 sm:text-sm sm:leading-6">{description}</p>}
    </div>
    {action && <div className="min-w-0 shrink-0">{action}</div>}
  </div>;
}

export function StatCard({ label, value, icon: Icon, note, dark = false }: {
  label: string; value: string | number; icon: LucideIcon; note?: string; dark?: boolean;
}) {
  return <article className={`relative flex min-h-[152px] min-w-0 flex-col overflow-hidden rounded-[18px] border p-4 sm:min-h-[185px] sm:rounded-[22px] sm:p-6 ${dark
    ? "border-[#151715] bg-[#151715] text-[#f7f8f5]"
    : "border-[#e9eae5] bg-white text-[#191b18]"}`}>
    <div className="flex min-w-0 items-start justify-between gap-2">
      <p className={`min-w-0 text-[11px] font-medium leading-[1.4] sm:text-[13px] ${dark ? "text-[#afb3ad]" : "text-[#83887f]"}`}>{label}</p>
      <span className={`shrink-0 rounded-lg p-2 sm:rounded-xl sm:p-2.5 ${dark ? "bg-white/10" : "bg-[#f4f5f1]"}`}><Icon size={17} strokeWidth={1.8}/></span>
    </div>
    <p className="mt-auto pt-4 text-[clamp(1.5rem,5vw,2.2rem)] font-bold leading-none tracking-[-.06em] tabular-nums sm:pt-6">{value}</p>
    <p className={`mt-2 line-clamp-2 text-[10px] leading-4 sm:text-xs ${dark ? "text-[#949a91]" : "text-[#9a9e97]"}`}>{note ?? "Dados atualizados"}</p>
  </article>;
}

export function Panel({ title, description, right, children }: {
  title: string; description?: string; right?: ReactNode; children: ReactNode;
}) {
  return <section className="min-w-0 overflow-hidden rounded-[18px] border border-[#e9eae5] bg-white sm:rounded-[22px]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eff0eb] px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
      <div className="min-w-0"><h2 className="text-sm font-bold sm:text-base tracking-tight text-[#20221f]">{title}</h2>
        {description && <p className="mt-1 text-xs text-[#93978e]">{description}</p>}</div>
      {right}
    </div>
    <div className="min-w-0 p-4 sm:p-6">{children}</div>
  </section>;
}

export function StatusPill({ status }: { status: string }) {
  const good = ["ACTIVE", "CONFIRMED", "COMPLETED", "Utilizado"].includes(status);
  const warning = ["PENDING", "Pendente"].includes(status);
  const label: Record<string, string> = {
    ACTIVE: "Ativo", SUSPENDED: "Suspenso", PENDING: "Pendente",
    CONFIRMED: "Confirmado", COMPLETED: "Concluído",
    CANCELLED: "Cancelado", NO_SHOW: "Ausência",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold
    ${good ? "bg-[#ebede8] text-[#30352e]" : warning ? "bg-[#f0f0e9] text-[#64675f]" : "bg-[#f0f0ed] text-[#74766f]"}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${good ? "bg-[#52564f]" : warning ? "bg-[#777b71]" : "bg-[#a5a7a0]"}`}/>
    {label[status] ?? status}
  </span>;
}

export function EmptyState({ icon: Icon, title, description }: {
  icon: LucideIcon; title: string; description: string;
}) {
  return <div className="flex flex-col items-center justify-center px-3 py-9 text-center sm:px-5 sm:py-16">
    <span className="mb-3 rounded-2xl bg-[#f1f2ee] p-3 sm:mb-5 sm:p-4 text-[#777c73]"><Icon size={24}/></span>
    <h3 className="text-sm font-semibold">{title}</h3>
    <p className="mt-2 max-w-sm text-[12px] leading-5 text-[#91958d] sm:text-sm sm:leading-6">{description}</p>
  </div>;
}

export function InlineLink({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#3c3f39]">
    {children}<ArrowUpRight size={14}/>
  </span>;
}
