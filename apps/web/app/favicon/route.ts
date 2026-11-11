import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Fallback is used only when no custom favicon has been published (HTTP 404).
// Network/API failures must not silently replace the selected brand icon.
const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="16" fill="#050A30"/>
<path d="M13 48A25 25 0 0 1 46 12" fill="none" stroke="#F2C225" stroke-width="5" stroke-linecap="round"/>
<rect x="24" y="11" width="16" height="41" rx="5" fill="#F4F5F0" stroke="#000" stroke-width="2"/>
<path d="m24 19 16 10M24 30l16 10M24 41l13 8" stroke="#F2C225" stroke-width="5"/>
<rect x="21" y="8" width="22" height="7" rx="3.5" fill="#111"/>
<rect x="21" y="48" width="22" height="7" rx="3.5" fill="#111"/>
</svg>`;
const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: NextRequest) {
  const api = process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001/api";
  const version = request.nextUrl.searchParams.get("v");
  const params = version ? `?v=${encodeURIComponent(version)}` : "";
  try {
    const response = await fetch(`${api}/branding/assets/favicon${params}`, {
      cache: "no-store", signal: AbortSignal.timeout(6000),
    });
    if (response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      if (/^image\/(png|jpeg|webp|x-icon|vnd\.microsoft\.icon)(?:;|$)/i.test(contentType)) {
        return new NextResponse(await response.arrayBuffer(), {
          headers: { ...noCache, "Content-Type": contentType },
        });
      }
      return new NextResponse("Tipo de favicon inesperado", {
        status: 502, headers: noCache,
      });
    }
    if (response.status !== 404) {
      return new NextResponse("Serviço de favicon indisponível", {
        status: 503, headers: noCache,
      });
    }
  } catch {
    return new NextResponse("Não foi possível consultar o favicon publicado", {
      status: 503, headers: noCache,
    });
  }
  return new NextResponse(fallbackSvg, {
    headers: { ...noCache, "Content-Type": "image/svg+xml; charset=utf-8" },
  });
}
