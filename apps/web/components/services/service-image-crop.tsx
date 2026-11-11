"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { secondaryButton } from "../dashboard/ui";
import { encodeCanvas } from "../../lib/canvas-image";

const OUTPUT_SIZE = 1080;
const MAX_OUTPUT_BYTES = 500 * 1024;

export function ServiceImageCrop({ onChange }: {
  onChange: (dataUrl: string | null, sizeBytes?: number) => void;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [sourceVersion, setSourceVersion] = useState(0);
  const [fileName, setFileName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [preserveAlpha, setPreserveAlpha] = useState(false);

  const draw = useCallback((canvas: HTMLCanvasElement, size: number) => {
    const image = imageRef.current;
    const context = canvas.getContext("2d");
    if (!image || !context) return false;
    canvas.width = size; canvas.height = size;
    const cropSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const rangeX = Math.max(0, image.naturalWidth - cropSize);
    const rangeY = Math.max(0, image.naturalHeight - cropSize);
    const sourceX = rangeX / 2 + (offsetX / 100) * (rangeX / 2);
    const sourceY = rangeY / 2 + (offsetY / 100) * (rangeY / 2);
    context.clearRect(0, 0, size, size);
    context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, size, size);
    return true;
  }, [offsetX, offsetY, zoom]);

  useEffect(() => {
    if (!sourceVersion || !draw(previewRef.current!, 520)) return;
    const timer = window.setTimeout(() => {
      const canvas = document.createElement("canvas");
      if (!draw(canvas, OUTPUT_SIZE)) return;
      const encoded = encodeCanvas(canvas, preserveAlpha, MAX_OUTPUT_BYTES);
      if (encoded) { setOutputSize(encoded.bytes); setError(""); onChange(encoded.dataUrl, encoded.bytes); return; }
      setOutputSize(null); setError("Não foi possível reduzir a foto para menos de 500 KB."); onChange(null);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draw, onChange, preserveAlpha, sourceVersion]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type)) {
      setError("Selecione uma imagem JPG, PNG ou WEBP."); return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("O arquivo original deve ter no máximo 12 MB."); return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const image = new Image();
    image.onload = () => {
      // Aceita qualquer dimensão original válida: o canvas recorta e
      // redimensiona a saída para 1080 × 1080, inclusive ampliando fotos menores.
      if (!image.naturalWidth || !image.naturalHeight) {
        URL.revokeObjectURL(url); objectUrlRef.current = null;
        setError("A imagem selecionada não possui dimensões válidas."); return;
      }
      imageRef.current = image; setFileName(file.name); setPreserveAlpha(file.type === "image/png" || file.type === "image/webp");
      setZoom(1); setOffsetX(0); setOffsetY(0);
      setError(""); setSourceVersion(version => version + 1);
    };
    image.onerror = () => setError("Não foi possível abrir esta imagem.");
    image.src = url;
  }

  function remove() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null; imageRef.current = null; setSourceVersion(0); setFileName(""); setPreserveAlpha(false);
    setOutputSize(null); setError(""); onChange(null);
  }

  return <div>
    {!sourceVersion ? <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfd3cb] bg-[#fafbf8] p-6 text-center transition hover:border-[#8b9187]">
      <ImagePlus size={24} className="text-[#777d73]"/>
      <span className="mt-3 text-sm font-semibold">Selecionar foto</span>
      <span className="mt-2 max-w-sm text-xs leading-5 text-[#8a9086]">JPG, PNG ou WEBP de qualquer proporção. Ajuste o recorte; a foto final terá 1080 × 1080 pixels.</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={selectFile}/>
    </label> : <div className="grid gap-5 lg:grid-cols-[minmax(260px,360px)_1fr]">
      <canvas ref={previewRef} className="aspect-square w-full rounded-2xl bg-white object-cover shadow-inner"/>
      <div className="space-y-5">
        <div><p className="truncate text-sm font-semibold">{fileName}</p>
          <p className="mt-1 text-xs text-[#888e84]">Saída: 1080 × 1080{outputSize ? ` · ${Math.ceil(outputSize / 1024)} KB` : ""}</p></div>
        <label className="block text-xs font-semibold text-[#555b52]">Zoom
          <input className="mt-2 w-full accent-[#171916]" type="range" min="1" max="3" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))}/>
        </label>
        <label className="block text-xs font-semibold text-[#555b52]">Posição horizontal
          <input className="mt-2 w-full accent-[#171916]" type="range" min="-100" max="100" value={offsetX} onChange={event => setOffsetX(Number(event.target.value))}/>
        </label>
        <label className="block text-xs font-semibold text-[#555b52]">Posição vertical
          <input className="mt-2 w-full accent-[#171916]" type="range" min="-100" max="100" value={offsetY} onChange={event => setOffsetY(Number(event.target.value))}/>
        </label>
        <button type="button" className={secondaryButton} onClick={remove}><Trash2 size={15}/> Remover foto</button>
        {preserveAlpha ? <p className="text-xs text-[#687067]">A transparência do PNG/WEBP será preservada.</p> : null}
      </div>
    </div>}
    {error ? <p role="alert" className="mt-3 text-xs text-[#a14740]">{error}</p> : null}
  </div>;
}
