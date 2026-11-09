export function dataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  return comma < 0 ? 0 : Math.ceil((dataUrl.length - comma - 1) * .75);
}

export function encodeCanvas(canvas: HTMLCanvasElement, preserveAlpha: boolean, maxBytes: number) {
  const mime = preserveAlpha ? "image/webp" : "image/jpeg";
  for (const quality of [.86, .78, .7, .62, .54, .46, .38]) {
    const dataUrl = canvas.toDataURL(mime, quality);
    const bytes = dataUrlBytes(dataUrl);
    if (bytes <= maxBytes) return { dataUrl, bytes };
  }
  return null;
}
