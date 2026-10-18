/** Fashion-style color names. The detector picks whichever name most pixels are closest to. */
const PALETTE: [string, [number, number, number]][] = [
  ["White", [245, 245, 245]], ["Ivory", [240, 234, 214]], ["Oat", [214, 200, 172]], ["Beige", [222, 196, 160]],
  ["Tan", [190, 150, 100]], ["Brown", [110, 75, 50]], ["Black", [28, 28, 30]], ["Charcoal", [70, 72, 76]],
  ["Gray", [140, 142, 146]], ["Light gray", [205, 206, 208]], ["Navy", [28, 40, 80]], ["Indigo", [62, 80, 130]],
  ["Blue", [40, 100, 200]], ["Denim", [88, 118, 162]], ["Sky blue", [140, 190, 230]], ["Teal", [30, 120, 120]], ["Green", [40, 140, 70]],
  ["Moss", [105, 120, 70]], ["Sage", [160, 180, 150]], ["Olive", [110, 110, 50]], ["Yellow", [240, 210, 60]],
  ["Mustard", [205, 160, 40]], ["Orange", [235, 130, 45]], ["Rust", [165, 80, 45]], ["Red", [200, 40, 45]],
  ["Burgundy", [110, 25, 45]], ["Pink", [240, 170, 190]], ["Rose", [200, 110, 130]], ["Purple", [110, 60, 150]],
  ["Lavender", [190, 170, 220]],
];

function toLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const PALETTE_LAB = PALETTE.map(([name, rgb]) => ({ name, lab: toLab(rgb) }));

export function nearestColorName(rgb: [number, number, number]): string {
  const lab = toLab(rgb);
  let best = PALETTE_LAB[0], bestDist = Infinity;
  for (const entry of PALETTE_LAB) {
    const d = (entry.lab[0] - lab[0]) ** 2 + (entry.lab[1] - lab[1]) ** 2 + (entry.lab[2] - lab[2]) ** 2;
    if (d < bestDist) { bestDist = d; best = entry; }
  }
  return best.name;
}

/** CSS color for a color name (e.g. for the little dot on a card). Also understands "Sage green" → Sage. */
export function colorCss(name: string): string | undefined {
  const lower = name.trim().toLowerCase();
  const hit = PALETTE.find(([n]) => n.toLowerCase() === lower) ?? PALETTE.find(([n]) => lower.startsWith(n.toLowerCase()));
  return hit ? `rgb(${hit[1].join(",")})` : undefined;
}

/**
 * Dominant color name of an RGBA pixel buffer. Transparent pixels (the removed background) are ignored,
 * so only the garment is measured. Each visible pixel votes for its nearest named color.
 * `region` limits the measuring area (used for photos where background removal failed).
 */
export function detectColorName(data: Uint8ClampedArray | number[], width: number, height: number, region?: { x0: number; y0: number; x1: number; y1: number }): string {
  const { x0, y0, x1, y1 } = region ?? { x0: 0, y0: 0, x1: width, y1: height };
  const votes = new Map<string, number>();
  const step = Math.max(1, Math.floor(((x1 - x0) * (y1 - y0)) / 6000)); // ~6000 samples is plenty
  let seen = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (seen++ % step) continue;
      const i = (y * width + x) * 4;
      if (data[i + 3] < 200) continue; // skip removed background / soft edges
      const name = nearestColorName([data[i], data[i + 1], data[i + 2]]);
      votes.set(name, (votes.get(name) ?? 0) + 1);
    }
  }
  let top = "", max = 0;
  for (const [name, count] of votes) if (count > max) { top = name; max = count; }
  return top;
}