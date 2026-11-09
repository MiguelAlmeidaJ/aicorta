import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const fallbackSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\">\n<rect width=\"64\" height=\"64\" rx=\"16\" fill=\"#050a30\"/>\n<path d=\"M13 48A25 25 0 0 1 46 12\" fill=\"none\" stroke=\"#f2c225\" stroke-width=\"5\" stroke-linecap=\"round\"/>\n<rect x=\"24\" y=\"11\" width=\"16\" height=\"41\" rx=\"5\" fill=\"#f4f5f0\" stroke=\"#000\" stroke-width=\"2\"/>\n<path d=\"m24 19 16 10M24 30l16 10M24 41l13 8\" stroke=\"#f2c225\" stroke-width=\"5\"/>\n<rect x=\"21\" y=\"8\" width=\"22\" height=\"7\" rx=\"3.5\" fill=\"#111\"/>\n<rect x=\"21\" y=\"48\" width=\"22\" height=\"7\" rx=\"3.5\" fill=\"#111\"/>\n</svg>\n";
const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  try {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
    const response = await fetch(`${api}/branding/assets/favicon`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (response.ok) {
      const contentType = response.headers.get("content-type") ?? "image/png";
      if (/^image\/(png|jpeg|webp|x-icon|vnd\.microsoft\.icon)/.test(contentType)) {
        return new NextResponse(await response.arrayBuffer(), {
          headers: { ...noCache, "Content-Type": contentType },
        });
      }
    }
  } catch {
    // Sem API disponível, use o ícone vetorial original.
  }
  return new NextResponse(fallbackSvg, {
    headers: { ...noCache, "Content-Type": "image/svg+xml; charset=utf-8" },
  });
}
