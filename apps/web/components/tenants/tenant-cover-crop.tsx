"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { secondaryButton } from "../dashboard/ui";
import { encodeCanvas } from "../../lib/canvas-image";

const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 520;
const MAX_OUTPUT_BYTES = 500 * 1024;

export function TenantCoverCrop({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [version, setVersion] = useState(0);
  const [fileName, setFileName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [preserveAlpha, setPreserveAlpha] = useState(false);

  const draw = useCallback((canvas: HTMLCanvasElement, width: number, height: number) => {
    const image = imageRef.current; const context = canvas.getContext("2d");
    if (!image || !context) return false;
    canvas.width = width; canvas.height = height;
    const targetRatio = OUTPUT_WIDTH / OUTPUT_HEIGHT;
    let cropWidth = image.naturalWidth; let cropHeight = cropWidth / targetRatio;
    if (cropHeight > image.naturalHeight) { cropHeight = image.naturalHeight; cropWidth = cropHeight * targetRatio; }
    cropWidth /= zoom; cropHeight /= zoom;
    const rangeX = image.naturalWidth - cropWidth; const rangeY = image.naturalHeight - cropHeight;
    const sourceX = rangeX / 2 + (offsetX / 100) * (rangeX / 2);
    const sourceY = rangeY / 2 + (offsetY / 100) * (rangeY / 2);
    context.clearRect(0, 0, width, height);
    context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, width, height);
    return true;
  }, [offsetX, offsetY, zoom]);

  useEffect(() => {
    if (!version || !previewRef.current || !draw(previewRef.current, 640, 260)) return;
    const timer = window.setTimeout(() => {
      const canvas = document.createElement("canvas"); if (!draw(canvas, OUTPUT_WIDTH, OUTPUT_HEIGHT)) return;
      const encoded = encodeCanvas(canvas, preserveAlpha, MAX_OUTPUT_BYTES);
      if (encoded) { setOutputSize(encoded.bytes); setError(""); onChange(encoded.dataUrl); return; }
      setError("Não foi possível reduzir a capa para menos de 500 KB."); onChange(null);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draw, onChange, preserveAlpha, version]);

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) { setError("Selecione uma imagem JPG, PNG ou WEBP."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("O arquivo original deve ter no máximo 15 MB."); return; }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file); objectUrlRef.current = url; const image = new Image();
    image.onload = () => {
      if (image.naturalWidth < OUTPUT_WIDTH || image.naturalHeight < OUTPUT_HEIGHT) {
        URL.revokeObjectURL(url); objectUrlRef.current = null; setError("Use uma imagem com pelo menos 1280 × 520 pixels."); return;
      }
      imageRef.current = image; setFileName(file.name); setPreserveAlpha(file.type === "image/png" || file.type === "image/webp");
      setZoom(1); setOffsetX(0); setOffsetY(0); setError(""); setVersion(value => value + 1);
    };
    image.onerror = () => setError("Não foi possível abrir esta imagem."); image.src = url;
  }
  function remove() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null; imageRef.current = null; setVersion(0); setFileName(""); setPreserveAlpha(false); setOutputSize(null); setError(""); onChange(null);
  }

  return <div>{!version ? <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfd3cb] bg-[#fafbf8] p-6 text-center hover:border-[#8b9187]">
    <ImagePlus size={25} className="text-[#777d73]"/><span className="mt-3 text-sm font-semibold">Selecionar capa</span>
    <span className="mt-2 max-w-md text-xs leading-5 text-[#8a9086]">JPG, PNG ou WEBP com pelo menos 1280 × 520. Imagens maiores podem ser reposicionadas e redimensionadas.</span>
    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={selectFile}/>
  </label> : <div className="space-y-5"><canvas ref={previewRef} className="aspect-[1280/520] w-full rounded-2xl bg-white shadow-inner"/>
    <div className="grid gap-4 md:grid-cols-3"><div><p className="truncate text-sm font-semibold">{fileName}</p><p className="mt-1 text-xs text-[#888e84]">1280 × 520{outputSize ? ` · ${Math.ceil(outputSize / 1024)} KB` : ""}</p></div>
      <label className="text-xs font-semibold">Zoom<input className="mt-2 w-full accent-[#171916]" type="range" min="1" max="3" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))}/></label>
      <button type="button" className={secondaryButton} onClick={remove}><Trash2 size={15}/> Remover seleção</button></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Posição horizontal<input className="mt-2 w-full accent-[#171916]" type="range" min="-100" max="100" value={offsetX} onChange={event => setOffsetX(Number(event.target.value))}/></label>
      <label className="text-xs font-semibold">Posição vertical<input className="mt-2 w-full accent-[#171916]" type="range" min="-100" max="100" value={offsetY} onChange={event => setOffsetY(Number(event.target.value))}/></label></div>
    {preserveAlpha ? <p className="text-xs text-[#687067]">A transparência do PNG/WEBP será preservada.</p> : null}
  </div>}{error ? <p role="alert" className="mt-3 text-xs text-[#a14740]">{error}</p> : null}</div>;
}
