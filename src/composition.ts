/** Reads fabric composition from text such as "Cotton 72%, Linen 28%" or an OCR'd care tag. */

// spelling variants (English / French / Spanish / Italian / German) → display name
const FIBERS: Record<string, string> = {
  cotton: "Cotton", coton: "Cotton", algodon: "Cotton", "algodón": "Cotton", cotone: "Cotton", baumwolle: "Cotton",
  polyester: "Polyester", "poliéster": "Polyester", poliester: "Polyester", polyestere: "Polyester",
  linen: "Linen", lin: "Linen", lino: "Linen", leinen: "Linen",
  wool: "Wool", laine: "Wool", lana: "Wool", wolle: "Wool",
  silk: "Silk", soie: "Silk", seda: "Silk", seta: "Silk", seide: "Silk",
  viscose: "Viscose", viscosa: "Viscose", rayon: "Rayon",
  nylon: "Nylon", polyamide: "Nylon", poliamida: "Nylon",
  elastane: "Elastane", elasthanne: "Elastane", elastano: "Elastane", spandex: "Elastane", lycra: "Elastane",
  acrylic: "Acrylic", acrylique: "Acrylic", acrilico: "Acrylic",
  cashmere: "Cashmere", lyocell: "Lyocell", tencel: "Lyocell", modal: "Modal", hemp: "Hemp", leather: "Leather",
};
const NATURAL = new Set(["Cotton", "Linen", "Wool", "Silk", "Cashmere", "Hemp"]);

const names = Object.keys(FIBERS).sort((a, b) => b.length - a.length).join("|");
const PCT_FIRST = new RegExp(`(\\d{1,3})\\s*%\\s*(${names})\\b`, "gi");
const NAME_FIRST = new RegExp(`\\b(${names})\\s*[:\\-]?\\s*(\\d{1,3})\\s*%`, "gi");
const NAME_ONLY = new RegExp(`\\b(${names})\\b`, "gi");

export type Fiber = { fiber: string; pct: number };

export function fibersOf(text: string): Fiber[] {
  const lower = text.toLowerCase();
  const found = new Map<string, number>();
  for (const m of lower.matchAll(PCT_FIRST)) found.set(FIBERS[m[2]], Math.max(found.get(FIBERS[m[2]]) ?? 0, Number(m[1])));
  for (const m of lower.matchAll(NAME_FIRST)) found.set(FIBERS[m[1]], Math.max(found.get(FIBERS[m[1]]) ?? 0, Number(m[2])));
  if (!found.size) {
    const words = new Set([...lower.matchAll(NAME_ONLY)].map((m) => FIBERS[m[1]]));
    if (words.size === 1) found.set([...words][0], 100); // "cotton" alone → 100% cotton
  }
  return [...found].map(([fiber, pct]) => ({ fiber, pct })).filter((f) => f.pct > 0 && f.pct <= 100).sort((a, b) => b.pct - a.pct);
}

/** "60% cotton / 40% polyester" → "Cotton 60%, Polyester 40%" (empty string if nothing recognised). */
export function parseComposition(text: string): string {
  return fibersOf(text).map((f) => `${f.fiber} ${f.pct}%`).join(", ");
}

/** Average natural-fiber share (0–100) across pieces whose composition could be read; null if none. */
export function naturalFiberShare(compositions: string[]): number | null {
  const shares: number[] = [];
  for (const text of compositions) {
    const fibers = fibersOf(text);
    const total = fibers.reduce((sum, f) => sum + f.pct, 0);
    if (!total) continue;
    shares.push((fibers.filter((f) => NATURAL.has(f.fiber)).reduce((sum, f) => sum + f.pct, 0) / total) * 100);
  }
  return shares.length ? Math.round(shares.reduce((a, b) => a + b, 0) / shares.length) : null;
}