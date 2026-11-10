export default function Loading() {
  return <div className="mx-auto flex min-h-[55vh] w-full max-w-[1280px] flex-col gap-5 px-5 py-10 sm:px-8" aria-live="polite" aria-busy="true">
    <div className="flex items-center gap-3 text-[13px] font-medium text-[#6e776b]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d9ded5] border-t-[#282e26]"/>
      Carregando página...
    </div>
    <div className="h-8 max-w-[370px] animate-pulse rounded-xl bg-[#e9ece6]"/>
    <div className="h-4 max-w-[570px] animate-pulse rounded-lg bg-[#edf0eb]"/>
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      <div className="h-48 animate-pulse rounded-2xl border border-[#e6ebe3] bg-[#f0f2ed]"/>
      <div className="h-48 animate-pulse rounded-2xl border border-[#e6ebe3] bg-[#f0f2ed]"/>
    </div>
  </div>;
}
