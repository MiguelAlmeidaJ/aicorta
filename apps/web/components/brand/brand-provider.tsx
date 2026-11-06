"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Scissors } from "lucide-react";
import { API_URL } from "../../lib/api";

export type BrandAssets = { logo: string | null; dark: string | null; favicon: string | null };
export type BrandConfig = {
  name: string; black: string; navy: string; gold: string; silver: string;
  assets: BrandAssets; updatedAt: string | null;
};
export const defaultBrand: BrandConfig = {
  name: "AICorta", black: "#000000", navy: "#050A30", gold: "#F2C225", silver: "#D9D9D9",
  assets: { logo: null, dark: null, favicon: null }, updatedAt: null,
};

type BrandContextValue = { brand: BrandConfig; reload: () => Promise<void> };
const BrandContext = createContext<BrandContextValue>({
  brand: defaultBrand, reload: async () => {},
});
export const assetUrl = (path: string | null) => path ? `${API_URL}${path}` : null;

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(defaultBrand);
  async function reload() {
    try {
      const response = await fetch(`${API_URL}/branding`, { cache: "no-store" });
      if (!response.ok) return;
      setBrand(await response.json());
    } catch { /* Offline: keep safe default branding */ }
  }
  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-black", brand.black);
    root.style.setProperty("--brand-navy", brand.navy);
    root.style.setProperty("--brand-gold", brand.gold);
    root.style.setProperty("--brand-silver", brand.silver);
    document.title = `${brand.name} | Gestão de barbearias`;
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      ?? document.createElement("link");
    if (!icon.parentElement) {
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = assetUrl(brand.assets.favicon) ?? "/icon.svg";
  }, [brand]);
  return <BrandContext.Provider value={{ brand, reload }}>{children}</BrandContext.Provider>;
}

export function useBrand() { return useContext(BrandContext); }

export function BrandLogo({ dark = false, compact = false, className = "" }: {
  dark?: boolean; compact?: boolean; className?: string;
}) {
  const { brand } = useBrand();
  const source = assetUrl(dark ? brand.assets.dark : brand.assets.logo);
  if (source) return <img src={source} alt={brand.name} className={`max-h-full max-w-full object-contain object-left ${className}`}/>;
  return <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
      ${dark ? "bg-white/10 text-[var(--brand-gold)]" : "bg-[var(--brand-black)] text-[var(--brand-gold)]"}`}>
      <Scissors size={21} strokeWidth={2.1}/>
    </span>
    {!compact && <span className={`text-[23px] font-black tracking-[-.08em] ${dark ? "text-white" : "text-[var(--brand-black)]"}`}>
      {brand.name}<span className="text-[var(--brand-gold)]">.</span>
    </span>}
  </span>;
}
