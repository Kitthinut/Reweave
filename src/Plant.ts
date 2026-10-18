export type PlantData = {
  lastWatered: string | null;
  plantedOn?: string;
  caredDays: number;
  streak: number;
  alive: boolean;
  creditGranted?: boolean;
};

export const STAGE_LABELS = ["Young", "Medium", "Flower", "Cotton", "Full"];
export const STAGE_RANGES = ["1–10", "11–20", "21–30", "31–40", "41+"];
export const DAYS_TO_FULL = 40;
export const MAX_DAYS_WITHOUT_WATER = 3;

/** Local calendar date (YYYY-MM-DD). Not UTC, so the day changes at local midnight. */
export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 864e5);
}

/** 1–10 → stage 1, 11–20 → 2, 21–30 → 3, 31–40 → 4, 41+ → 5 (keeps counting days) */
export function plantStage(caredDays: number): number {
  return Math.min(5, Math.max(1, Math.floor((caredDays - 1) / 10) + 1));
}

export function freshPlant(today: string): PlantData {
  return { lastWatered: null, plantedOn: today, caredDays: 0, streak: 0, alive: true };
}

/** Run once when the app loads: kills the plant after 3 days without water. */
export function checkPlant(plant: PlantData, today: string): PlantData {
  if (!plant.alive) return plant;
  const since = plant.lastWatered ?? plant.plantedOn;
  if (!since) return plant;
  return daysBetween(since, today) >= MAX_DAYS_WITHOUT_WATER
    ? { ...plant, alive: false, streak: 0 }
    : plant;
}