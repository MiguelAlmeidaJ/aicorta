"use client";

import { useEffect, useRef, useState } from "react";

export type MapPoint = { id: string; latitude: number; longitude: number; label?: string };
type LeafletMap = {
  setView: (coords: [number,number], zoom: number) => LeafletMap;
  fitBounds: (coords: [number,number][], options?: object) => LeafletMap;
  on: (event: string, cb: (event: { latlng: { lat: number; lng: number } }) => void) => LeafletMap;
  remove: () => void;
};
type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  on: (event: string, cb: () => void) => LeafletMarker;
};
type Leaflet = {
  map: (element: HTMLElement, options?: object) => LeafletMap;
  tileLayer: (url: string, options: object) => { addTo: (map: LeafletMap) => unknown };
  marker: (coords: [number,number], options: object) => LeafletMarker;
  divIcon: (options: object) => unknown;
};
declare global { interface Window { L?: Leaflet } }
let pending: Promise<Leaflet> | null = null;
function leaflet(): Promise<Leaflet> {
  if (window.L) return Promise.resolve(window.L);
  if (!document.getElementById("aicorta-leaflet-css")) {
    const css = document.createElement("link");
    css.id = "aicorta-leaflet-css";
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.append(css);
  }
  if (!pending) pending = new Promise<Leaflet>((resolve,reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Mapa indisponível"));
    script.onerror = () => reject(new Error("Não foi possível carregar os mapas."));
    document.head.append(script);
  }).catch(error => { pending = null; throw error; });
  return pending;
}

const pinHtml = `<div style="position:relative;width:38px;height:48px;filter:drop-shadow(0 3px 5px #0003)">
  <div style="width:38px;height:38px;border:3px solid #fff;border-radius:50% 50% 50% 6px;transform:rotate(-45deg);background:#171917;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 2px #d6a939">
    <span style="display:block;transform:rotate(45deg);font-size:18px;color:#eec946;font-weight:bold">✂</span>
  </div>
</div>`;

export function AicortaMap({ points, selectedId, onSelect, onPick, height = 420 }: {
  points: MapPoint[]; selectedId?: string; onSelect?: (id:string)=>void;
  onPick?: (coords: {latitude:number;longitude:number})=>void; height?: number;
}) {
  const div = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  const pickRef = useRef(onPick);
  const [failure,setFailure] = useState("");
  selectRef.current = onSelect;
  pickRef.current = onPick;
  const key = JSON.stringify(points.map(p=>[p.id,p.latitude,p.longitude])) + "|" + (selectedId ?? "");
  useEffect(() => {
    let closed = false;
    let map: LeafletMap | undefined;
    const visible = points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    void leaflet().then(L => {
      if (closed || !div.current) return;
      map = L.map(div.current, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
      const selected = visible.find(p=>p.id===selectedId);
      if (selected) map.setView([selected.latitude,selected.longitude],16);
      else if (visible.length === 1) map.setView([visible[0].latitude,visible[0].longitude],16);
      else if (visible.length > 1) map.fitBounds(visible.map(p=>[p.latitude,p.longitude] as [number,number]), { padding: [55,55], maxZoom: 14 });
      else map.setView([-14.235,-51.925],4);
      const icon = L.divIcon({ html: pinHtml, className: "aicorta-map-pin", iconSize: [38,48], iconAnchor: [19,46] });
      visible.forEach(p=>{
        L.marker([p.latitude,p.longitude], { icon, title: p.label ?? "Barbearia" })
          .addTo(map!).on("click",()=>selectRef.current?.(p.id));
      });
      if (pickRef.current) map.on("click", event => pickRef.current?.({
        latitude: Number(event.latlng.lat.toFixed(7)),
        longitude: Number(event.latlng.lng.toFixed(7)),
      }));
      setFailure("");
    }).catch(() => { if (!closed) setFailure("Mapa temporariamente indisponível. Confira sua conexão."); });
    return () => { closed = true; map?.remove(); };
  }, [key]);
  return <div className="relative w-full overflow-hidden rounded-xl border border-[#e0e5dc] bg-[#e8ebe5]">
    <div ref={div} aria-label="Mapa dos estabelecimentos AICorta" role="application" style={{height}} className="w-full"/>
    {failure && <p role="alert" className="absolute bottom-3 left-3 right-3 z-[500] rounded-lg bg-white p-3 text-xs text-[#9c433d] shadow">{failure}</p>}
    {onPick && <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-lg bg-white/95 px-3 py-2 text-[11px] font-semibold text-[#56624f] shadow-sm">
      Clique no local exato para posicionar o pin
    </div>}
  </div>;
}
