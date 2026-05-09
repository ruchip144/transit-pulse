export type Route = {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: "bus" | "train";
};

export type DelayPoint = {
  route_id: string;
  ts: string;
  delay_seconds: number;
};

export type CrowdSegment = {
  route_id: string;
  segment_id: string;
  segment_name: string;
  load_factor: number;
  latlngs: [number, number][];
};

export const routes: Route[] = [
  { route_id: "R1", route_short_name: "1", route_long_name: "Central ↔ Airport", route_type: "bus" },
  { route_id: "R7", route_short_name: "7", route_long_name: "Riverside ↔ Tech Park", route_type: "bus" },
  { route_id: "R12", route_short_name: "12", route_long_name: "Old Town ↔ University", route_type: "bus" },
  { route_id: "T2", route_short_name: "T2", route_long_name: "North ↔ South Line", route_type: "train" },
  { route_id: "T5", route_short_name: "T5", route_long_name: "East ↔ West Express", route_type: "train" },
];

// Deterministic pseudo-random
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function genDelays(route_id: string, seed: number, peakHour: number): DelayPoint[] {
  const r = rand(seed);
  const points: DelayPoint[] = [];
  const start = new Date("2026-05-09T05:00:00Z").getTime();
  for (let i = 0; i < 180; i++) {
    const ts = new Date(start + i * 5 * 60 * 1000);
    const hour = ts.getUTCHours();
    const distFromPeak = Math.min(Math.abs(hour - peakHour), Math.abs(hour - peakHour - 12));
    const base = Math.max(0, 300 - distFromPeak * 50);
    const noise = r() * 200 - 50;
    points.push({
      route_id,
      ts: ts.toISOString(),
      delay_seconds: Math.max(0, Math.round(base + noise)),
    });
  }
  return points;
}

export const delays: DelayPoint[] = [
  ...genDelays("R1", 1, 8),
  ...genDelays("R7", 2, 9),
  ...genDelays("R12", 3, 17),
  ...genDelays("T2", 4, 18),
  ...genDelays("T5", 5, 8),
];

// Centered around Bengaluru
function line(start: [number, number], steps: number, dLat: number, dLng: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    pts.push([start[0] + dLat * i, start[1] + dLng * i]);
  }
  return pts;
}

export const crowding: CrowdSegment[] = [
  { route_id: "R1", segment_id: "R1-S1", segment_name: "Central → Midtown", load_factor: 0.45, latlngs: line([12.97, 77.58], 4, 0.008, 0.006) },
  { route_id: "R1", segment_id: "R1-S2", segment_name: "Midtown → Suburb", load_factor: 0.78, latlngs: line([12.998, 77.598], 4, 0.008, 0.008) },
  { route_id: "R1", segment_id: "R1-S3", segment_name: "Suburb → Airport", load_factor: 1.05, latlngs: line([13.026, 77.626], 4, 0.01, 0.01) },

  { route_id: "R7", segment_id: "R7-S1", segment_name: "Riverside → Market", load_factor: 0.62, latlngs: line([12.95, 77.55], 4, 0.007, 0.009) },
  { route_id: "R7", segment_id: "R7-S2", segment_name: "Market → Tech Park", load_factor: 0.92, latlngs: line([12.973, 77.581], 5, 0.008, 0.011) },

  { route_id: "R12", segment_id: "R12-S1", segment_name: "Old Town → Plaza", load_factor: 0.35, latlngs: line([12.96, 77.62], 4, 0.006, -0.008) },
  { route_id: "R12", segment_id: "R12-S2", segment_name: "Plaza → University", load_factor: 0.88, latlngs: line([12.984, 77.59], 5, 0.009, -0.009) },

  { route_id: "T2", segment_id: "T2-S1", segment_name: "North → Center", load_factor: 0.7, latlngs: line([13.02, 77.58], 5, -0.012, 0.004) },
  { route_id: "T2", segment_id: "T2-S2", segment_name: "Center → South", load_factor: 1.12, latlngs: line([12.96, 77.6], 5, -0.011, 0.005) },

  { route_id: "T5", segment_id: "T5-S1", segment_name: "East → Hub", load_factor: 0.5, latlngs: line([12.97, 77.66], 5, 0.002, -0.013) },
  { route_id: "T5", segment_id: "T5-S2", segment_name: "Hub → West", load_factor: 0.83, latlngs: line([12.98, 77.595], 5, 0.001, -0.014) },
];

export function colorForLoad(lf: number): string {
  if (lf >= 1.0) return "#dc2626";
  if (lf >= 0.7) return "#f97316";
  if (lf >= 0.4) return "#eab308";
  return "#16a34a";
}

export function loadLabel(lf: number): string {
  if (lf >= 1.0) return "Over capacity";
  if (lf >= 0.7) return "Crowded";
  if (lf >= 0.4) return "Moderate";
  return "Light";
}
