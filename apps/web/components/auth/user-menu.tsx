"use client";

/* eslint-disable @next/next/no-img-element -- avatar autenticado servido pela API */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, KeyRound, LogOut, UserRound } from "lucide-react";
import { API_URL, apiFetch, apiJson } from "../../lib/api";

export type UserMenuProfile = { id: string; name: string; username: string; avatarUrl?: string | null };

export function UserMenu({ profile: initialProfile, loginHref = "/login" }: { profile?: UserMenuProfile | null; loginHref?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [fetchedProfile, setFetchedProfile] = useState<UserMenuProfile | null | undefined>(undefined);
  const [liveProfile, setLiveProfile] = useState<UserMenuProfile | null>(null);
  const profile = liveProfile ?? (initialProfile !== undefined ? initialProfile : fetchedProfile);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (initialProfile !== undefined) return;
    let active = true;
    apiJson<UserMenuProfile>("/auth/me").then(value => { if (active) setFetchedProfile(value); })
      .catch(() => { if (active) setFetchedProfile(null); });
    return () => { active = false; };
  }, [initialProfile]);
  useEffect(() => {
    const update = (event: Event) => setLiveProfile((event as CustomEvent<UserMenuProfile>).detail);
    window.addEventListener("aicorta:profile-updated", update);
    return () => window.removeEventListener("aicorta:profile-updated", update);
  }, []);
  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => null);
    setOpen(false); router.replace(loginHref);
  }
  if (profile === undefined) return <span className="h-10 w-10 animate-pulse rounded-full bg-[#e4e6df]"/>;
  if (!profile) return <Link href={loginHref} className="rounded-xl border border-[#e3e5df] bg-white px-4 py-2.5 text-xs font-semibold">Entrar</Link>;
  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const tenantMatch = /^\/painel\/barbearias\/([^/]+)/.exec(pathname);
  const accountHref = pathname.startsWith("/system") ? "/system/minha-conta" :
    tenantMatch ? `/painel/barbearias/${tenantMatch[1]}/minha-conta` : "/minha-conta";
  return <div className="relative">
    <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)} className="flex items-center gap-2 rounded-xl border border-[#e3e5df] bg-white p-1.5 pr-3 text-left hover:bg-[#f5f6f2]">
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#efc524] text-[11px] font-bold">{profile.avatarUrl ? <img src={`${API_URL}${profile.avatarUrl}`} alt="" className="h-full w-full object-cover"/> : initials}</span>
      <span className="hidden max-w-32 truncate text-xs font-semibold sm:block">{profile.name}</span><ChevronDown size={14}/>
    </button>
    {open ? <div role="menu" className="absolute right-0 top-[calc(100%+.5rem)] z-50 w-60 rounded-xl border border-[#e3e5df] bg-white p-2 shadow-xl">
      <div className="border-b border-[#eceee8] px-3 py-2"><p className="truncate text-xs font-bold">{profile.name}</p><p className="truncate text-[11px] text-[#8a8f86]">@{profile.username}</p></div>
      <Link role="menuitem" href={accountHref} onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium hover:bg-[#f2f3ef]"><UserRound size={16}/> Minha conta</Link>
      <Link role="menuitem" href={`${accountHref}#senha`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium hover:bg-[#f2f3ef]"><KeyRound size={16}/> Trocar senha</Link>
      <button role="menuitem" type="button" onClick={() => void logout()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-red-700 hover:bg-red-50"><LogOut size={16}/> Encerrar sessão</button>
    </div> : null}
  </div>;
}
