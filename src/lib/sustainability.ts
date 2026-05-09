import type { Segment, GtfsRoute } from "./gtfs";

// Emissions factors in grams CO2 per passenger-km
// Uber/private car (single occupant) ~ 250 g/km
// City bus per passenger ~ 80 g/km
// Urban train per passenger ~ 40 g/km
const EF_UBER = 250;
const EF_BUS = 80;
const EF_TRAIN = 40;

// Assumed average daily ridership per route (used for "Carbon saved today" estimate)
const ASSUMED_DAILY_RIDERS = 320;

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function routeDistanceKm(segments: Segment[]): number {
  let total = 0;
  for (const s of segments) {
    for (let i = 1; i < s.latlngs.length; i++) {
      total += haversineKm(s.latlngs[i - 1], s.latlngs[i]);
    }
  }
  return total;
}

export type SustainabilityScore = {
  distanceKm: number;
  // grams of CO2 saved per single rider taking this route vs. an Uber
  perRiderGrams: number;
  // kg saved across the assumed daily ridership
  dailyKg: number;
  // letter score A+ … D based on perRiderGrams / km
  grade: string;
};

export function scoreRoute(route: GtfsRoute, segments: Segment[]): SustainabilityScore {
  const distanceKm = routeDistanceKm(segments);
  const ef = route.mode === "train" ? EF_TRAIN : EF_BUS;
  const perRiderGrams = Math.max(0, (EF_UBER - ef) * distanceKm);
  const dailyKg = (perRiderGrams * ASSUMED_DAILY_RIDERS) / 1000;

  // grams saved per km — higher is better
  const savedPerKm = EF_UBER - ef;
  const grade =
    savedPerKm >= 200 ? "A+" : savedPerKm >= 150 ? "A" : savedPerKm >= 100 ? "B" : "C";

  return { distanceKm, perRiderGrams, dailyKg, grade };
}

export function formatKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`;
  if (kg >= 10) return `${kg.toFixed(0)} kg`;
  return `${kg.toFixed(1)} kg`;
}
