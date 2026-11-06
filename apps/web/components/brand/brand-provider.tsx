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


/**
 * Remove transparent / flat-color whitespace from uploaded artwork for presentation.
 * The stored original is never modified. Handles legacy logos exported from PDF
 * with generous margins, so the brand doesn't appear tiny in the navigation.
 */
const cropCache = new Map<string, string>();
export function BrandArtwork({ src, alt, className = "", onError }: {
  src: string; alt: string; className?: string; onError?: () => void;
}) {
  const [cropped, setCropped] = useState(src);
  useEffect(() => {
    let mounted = true;
    setCropped(cropCache.get(src) ?? src);
    if (cropCache.has(src)) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const naturalW = image.naturalWidth;
        const naturalH = image.naturalHeight;
        const maxSize = 1200;
        const ratio = Math.min(1, maxSize / Math.max(naturalW, naturalH));
        const w = Math.max(1, Math.floor(naturalW * ratio));
        const h = Math.max(1, Math.floor(naturalH * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(image, 0, 0, w, h);
        const pixels = ctx.getImageData(0, 0, w, h).data;
        const corner = [pixels[0], pixels[1], pixels[2]];
        const isOpaque = pixels[3] > 245;
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y += 2) {
          for (let x = 0; x < w; x += 2) {
            const i = (y * w + x) * 4;
            const visible = isOpaque
              ? pixels[i + 3] > 20 &&
                Math.abs(pixels[i] - corner[0]) +
                Math.abs(pixels[i + 1] - corner[1]) +
                Math.abs(pixels[i + 2] - corner[2]) > 75
              : pixels[i + 3] > 30;
            if (visible) {
              minX = Math.min(x, minX); minY = Math.min(y, minY);
              maxX = Math.max(x, maxX); maxY = Math.max(y, maxY);
            }
          }
        }
        if (maxX < 0) return;
        const margin = Math.ceil(Math.min(w, h) * .045);
        const sx = Math.max(0, minX - margin);
        const sy = Math.max(0, minY - margin);
        const sw = Math.min(w - sx, maxX - sx + margin + 3);
        const sh = Math.min(h - sy, maxY - sy + margin + 3);
        if (sw > w * .95 && sh > h * .95) return;
        const trimmed = document.createElement("canvas");
        trimmed.width = sw; trimmed.height = sh;
        trimmed.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        const result = trimmed.toDataURL("image/png");
        cropCache.set(src, result);
        if (mounted) setCropped(result);
      } catch { /* Cross-origin image or unsupported canvas: show original */ }
    };
    image.src = src;
    return () => { mounted = false; };
  }, [src]);
  return <img src={cropped} alt={alt} onError={onError}
    className={`block max-h-full max-w-full object-contain ${className}`}/>;
}

export function BrandLogo({ dark = false, compact = false, className = "" }: {
  dark?: boolean; compact?: boolean; className?: string;
}) {
  const { brand } = useBrand();
  const source = assetUrl(dark ? brand.assets.dark : brand.assets.logo);
  if (source) return <BrandArtwork src={source} alt={brand.name} className={className}/>;
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
