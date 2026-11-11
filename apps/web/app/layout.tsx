import type { Metadata } from "next";
import "./globals.css";
import { BrandProvider } from "../components/brand/brand-provider";

// Favicon and document title are React/Next metadata. Fetch the version from the
// same internal API used by the favicon route, never mutate <head> in effects.
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const api = process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";
  let title = "AICorta";
  let version = "default";
  try {
    const response = await fetch(`${api}/branding`, {
      cache: "no-store", signal: AbortSignal.timeout(2500),
    });
    if (response.ok) {
      const brand = await response.json() as { name?: string; updatedAt?: string | null };
      if (brand.name?.trim()) title = brand.name.trim();
      if (brand.updatedAt) version = brand.updatedAt;
    }
  } catch {
    // App still renders while branding API is unreachable.
  }
  const favicon = `/favicon?v=${encodeURIComponent(version)}`;
  return {
    title: `${title} | Gestão de barbearias`,
    description: "A agenda inteligente da sua barbearia.",
    icons: { icon: [{ url: favicon, sizes: "any" }], shortcut: favicon },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><BrandProvider>{children}</BrandProvider></body></html>;
}
