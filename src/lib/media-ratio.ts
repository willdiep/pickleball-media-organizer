const ratios = new Map<string, number>();

export function rememberMediaRatio(src: string, width: number, height: number) {
  if (!src || width <= 0 || height <= 0) return;
  ratios.set(src, width / height);
}

export function storedMediaRatio(src: string): number | undefined {
  if (!src) return undefined;
  return ratios.get(src);
}

export function lookupMediaRatio(src: string): number | undefined {
  if (!src) return undefined;
  const stored = storedMediaRatio(src);
  if (stored != null) return stored;
  if (typeof document === "undefined") return undefined;

  for (const image of document.images) {
    if (image.currentSrc !== src && image.src !== src) continue;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      const ratio = image.naturalWidth / image.naturalHeight;
      ratios.set(src, ratio);
      return ratio;
    }
  }

  for (const element of document.querySelectorAll("video")) {
    if (!(element instanceof HTMLVideoElement)) continue;
    if (element.currentSrc !== src && element.src !== src) continue;
    if (element.videoWidth > 0 && element.videoHeight > 0) {
      const ratio = element.videoWidth / element.videoHeight;
      ratios.set(src, ratio);
      return ratio;
    }
  }

  return undefined;
}
