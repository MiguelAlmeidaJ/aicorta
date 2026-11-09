"use client";

/* eslint-disable @next/next/no-img-element -- preview temporário de arquivo local */
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, RotateCcw, X } from "lucide-react";
import { dataUrlBytes } from "../../lib/canvas-image";

const OUTPUT = 640;
const MAX_OUTPUT_BYTES = 500 * 1024;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export function ProfileImageCrop({ onChange, onCancel }: { onChange: (dataUrl: string) => void; onCancel?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const urlRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sourceVersion, setSourceVersion] = useState(0);
  const [name, setName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0);
  const [vertical, setVertical] = useState(0);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  useEffect(() => {
    const canvas = previewRef.current;
    const image = imgRef.current;
    if (!ready || !canvas || !image) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const size = 360;
    canvas.width = size;
    canvas.height = size;
    const crop = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const left = (image.naturalWidth - crop) * (horizontal + 100) / 200;
    const top = (image.naturalHeight - crop) * (vertical + 100) / 200;
    context.clearRect(0, 0, size, size);
    context.drawImage(image, left, top, crop, crop, 0, 0, size, size);
    setApplied(false);
  }, [ready, sourceVersion, zoom, horizontal, vertical]);

  function clearSelection() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    imgRef.current = null;
    setReady(false);
    setName("");
    setApplied(false);
    setError("");
    onChange("");
    onCancel?.();
  }

  function openFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Escolha uma imagem JPG, PNG ou WEBP."); return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("A imagem original deve ter até 25 MB."); return;
    }
    onChange("");
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth < 160 || image.naturalHeight < 160) {
        URL.revokeObjectURL(url);
        setError("Escolha uma imagem com pelo menos 160 pixels de largura e altura.");
        return;
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      imgRef.current = image;
      setName(file.name);
      setZoom(1); setHorizontal(0); setVertical(0);
      setReady(true); setSourceVersion(version => version + 1); setApplied(false); setError("");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Não foi possível abrir a imagem. Tente outro arquivo JPG, PNG ou WEBP.");
    };
    image.src = url;
  }

  function adjustZoom(value: number) { setZoom(value); setApplied(false); onChange(""); }
  function adjustHorizontal(value: number) { setHorizontal(value); setApplied(false); onChange(""); }
  function adjustVertical(value: number) { setVertical(value); setApplied(false); onChange(""); }

  function applyCrop() {
    const image = imgRef.current;
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT; canvas.height = OUTPUT;
    const context = canvas.getContext("2d");
    if (!context) { setError("Não foi possível preparar a imagem."); return; }
    const crop = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const left = (image.naturalWidth - crop) * (horizontal + 100) / 200;
    const top = (image.naturalHeight - crop) * (vertical + 100) / 200;
    context.drawImage(image, left, top, crop, crop, 0, 0, OUTPUT, OUTPUT);
    for (const quality of [.88, .78, .68, .58, .48, .38]) {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlBytes(encoded) <= MAX_OUTPUT_BYTES) {
        onChange(encoded);
        setApplied(true); setError("");
        return;
      }
    }
    setError("Não foi possível otimizar a imagem. Experimente outro enquadramento.");
  }

  return <div className="rounded-2xl border border-[#e3e6df] bg-[#fafbf9] p-4 sm:p-5">
    {!ready ? <button type="button" onClick={() => inputRef.current?.click()}
      className="flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#cdd2c9] bg-white px-4 py-7 text-center hover:border-[#8d9688]">
      <ImagePlus size={27} className="text-[#7d857a]"/>
      <span className="mt-3 text-sm font-semibold">Escolher foto de perfil</span>
      <span className="mt-2 max-w-sm text-xs leading-5 text-[#848d80]">
        JPG, PNG ou WEBP de até 25 MB. Fotos grandes serão recortadas e otimizadas antes do envio.
      </span>
    </button> : <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-medium text-[#545d50]">{name}</p>
        <button type="button" onClick={clearSelection} className="inline-flex shrink-0 items-center gap-1 text-xs text-[#777e74] hover:text-[#1c231b]"><X size={14}/> Cancelar</button>
      </div>
      <div className="mx-auto max-w-[310px]">
        <canvas ref={previewRef} aria-label="Prévia do recorte da foto"
          className="aspect-square w-full rounded-full border-4 border-white bg-[#e5e8e1] object-cover shadow-[0_0_0_1px_#d9ddd4]"/>
        <p className="mt-3 text-center text-xs text-[#838a80]">Prévia da foto circular no perfil</p>
      </div>
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-[#505a4e]">Aproximar imagem
          <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={e => adjustZoom(Number(e.target.value))}
            className="mt-2 block w-full accent-[#171916]"/>
        </label>
        <label className="block text-xs font-semibold text-[#505a4e]">Posição horizontal
          <input type="range" min="-100" max="100" step="1" value={horizontal}
            onChange={e => adjustHorizontal(Number(e.target.value))} className="mt-2 block w-full accent-[#171916]"/>
        </label>
        <label className="block text-xs font-semibold text-[#505a4e]">Posição vertical
          <input type="range" min="-100" max="100" step="1" value={vertical}
            onChange={e => adjustVertical(Number(e.target.value))} className="mt-2 block w-full accent-[#171916]"/>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setZoom(1); setHorizontal(0); setVertical(0); setApplied(false); onChange(""); }}
          className="inline-flex items-center gap-2 rounded-xl border border-[#dfe3dc] bg-white px-4 py-2.5 text-xs font-semibold hover:bg-[#f0f2ed]">
          <RotateCcw size={15}/> Centralizar
        </button>
        <button type="button" onClick={applyCrop} className="inline-flex items-center gap-2 rounded-xl bg-[#171916] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#30352d]">
          <Check size={16}/> {applied ? "Recorte aplicado" : "Aplicar recorte"}
        </button>
        <button type="button" onClick={() => inputRef.current?.click()}
          className="rounded-xl border border-[#dfe3dc] bg-white px-4 py-2.5 text-xs font-semibold hover:bg-[#f0f2ed]">
          Outra foto
        </button>
      </div>
      <p className="text-xs leading-5 text-[#798276]">
        A imagem final terá 640 × 640 pixels e até 500 KB. Após aplicar o recorte, clique em Salvar informações.
      </p>
      {applied ? <p role="status" className="text-xs font-semibold text-[#3d6d47]">Recorte pronto para salvar.</p> : null}
    </div>}
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={openFile}/>
    {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}
  </div>;
}
