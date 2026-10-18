import { detectColorName } from "./colors";

export type PhotoResult = { image: string; color: string; backgroundRemoved: boolean };

/** Stops a stuck download from freezing the sheet forever. */
export const BG_TIMEOUT_MS = 120_000;
export const OCR_TIMEOUT_MS = 90_000;
function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

const WORK_SIZE = 1024; // photo is shrunk to this before the AI runs (faster)
const OUT_SIZE = 480;   // saved image size (keeps storage small)

function canvasOf(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

async function fileToCanvas(file: File, max: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = canvasOf(bitmap.width * scale, bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality));

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const canvas = canvasOf(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

/** Crops to the visible (non-transparent) pixels, with a little padding, and shrinks to OUT_SIZE. */
function cropToGarment(source: HTMLCanvasElement): HTMLCanvasElement {
  const { width, height } = source;
  const { data } = source.getContext("2d")!.getImageData(0, 0, width, height);
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return source; // nothing found: keep as is
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const scale = Math.min(1, OUT_SIZE / Math.max(w, h));
  const out = canvasOf(w * scale, h * scale);
  out.getContext("2d")!.drawImage(source, x0, y0, w, h, 0, 0, out.width, out.height);
  return out;
}

/** WebP keeps transparency at a small size; Safari can't encode WebP so it falls back to PNG automatically. */
const toDataUrl = (canvas: HTMLCanvasElement, hasAlpha: boolean) =>
  hasAlpha ? canvas.toDataURL("image/webp", 0.85) : canvas.toDataURL("image/jpeg", 0.85);

/**
 * Photo in → cut-out garment (background removed, cropped) + detected color out.
 * Runs fully in the browser (free). The AI model (~40 MB) downloads once, then the browser caches it.
 * If anything fails (offline, old browser) the original photo is kept and the color is read from its center.
 */
export async function prepareGarmentPhoto(file: File, onStatus?: (message: string) => void): Promise<PhotoResult> {
  const work = await fileToCanvas(file, WORK_SIZE);
  try {
    onStatus?.("Removing background…");
    const { removeBackground } = await import("@imgly/background-removal");
    const input = await toBlob(work, "image/jpeg", 0.92);
    const cutBlob = await withTimeout(removeBackground(input, {
      model: "isnet_quint8",
      output: { format: "image/png" },
      progress: (key) => onStatus?.(key.startsWith("fetch") ? "Downloading the AI model (first time only)…" : "Removing background…"),
    }), BG_TIMEOUT_MS, "Background removal");
    const cut = cropToGarment(await blobToCanvas(cutBlob));
    onStatus?.("Detecting color…");
    const { data } = cut.getContext("2d")!.getImageData(0, 0, cut.width, cut.height);
    return { image: toDataUrl(cut, true), color: detectColorName(data, cut.width, cut.height), backgroundRemoved: true };
  } catch (error) {
    console.warn("Background removal failed, keeping the original photo", error);
    const fallback = canvasOf(work.width * Math.min(1, OUT_SIZE / Math.max(work.width, work.height)), work.height * Math.min(1, OUT_SIZE / Math.max(work.width, work.height)));
    fallback.getContext("2d")!.drawImage(work, 0, 0, fallback.width, fallback.height);
    const { data } = fallback.getContext("2d")!.getImageData(0, 0, fallback.width, fallback.height);
    const w = fallback.width, h = fallback.height;
    const color = detectColorName(data, w, h, { x0: Math.round(w * 0.3), y0: Math.round(h * 0.3), x1: Math.round(w * 0.7), y1: Math.round(h * 0.7) });
    return { image: toDataUrl(fallback, false), color, backgroundRemoved: false };
  }
}

/** Reads the text on a care/composition tag photo (free, in-browser OCR). Returns the raw text. */
export async function readTagText(file: File, onStatus?: (message: string) => void): Promise<string> {
  const canvas = await fileToCanvas(file, 1800);
  const ctx = canvas.getContext("2d")!;
  // greyscale + contrast makes small printed tag text much easier to read (ignored by browsers without ctx.filter)
  const copy = canvasOf(canvas.width, canvas.height);
  const cctx = copy.getContext("2d")!;
  cctx.filter = "grayscale(1) contrast(1.5)";
  cctx.drawImage(canvas, 0, 0);
  void ctx;
  onStatus?.("Reading the tag (first time downloads the text model)…");
  const { createWorker } = await import("tesseract.js");
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  try {
    worker = await withTimeout(createWorker("eng"), OCR_TIMEOUT_MS, "Loading the text model");
    const { data } = await withTimeout(worker.recognize(copy), OCR_TIMEOUT_MS, "Reading the tag");
    return data.text;
  } finally {
    worker?.terminate().catch(() => {});
  }
}