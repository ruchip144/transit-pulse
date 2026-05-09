// GTFS parser + derived analytics. Runs entirely client-side against
// the CSV feed bundled in /public/gtfs.

export type GtfsRoute = {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number; // 0/1/2 = tram/subway/rail, 3 = bus
  mode: "bus" | "train";
};

export type GtfsStop = {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
};

export type GtfsTrip = { route_id: string; service_id: string; trip_id: string; shape_id: string };

export type GtfsStopTime = {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
};

export type ShapePoint = { shape_id: string; lat: number; lon: number; seq: number };

export type Segment = {
  route_id: string;
  segment_id: string;
  segment_name: string;
  load_factor: number;
  latlngs: [number, number][];
  from_stop: GtfsStop;
  to_stop: GtfsStop;
};

export type DelayPoint = {
  route_id: string;
  trip_id: string;
  stop_id: string;
  ts: string;
  delay_seconds: number;
};

export type Gtfs = {
  routes: GtfsRoute[];
  stops: Map<string, GtfsStop>;
  trips: GtfsTrip[];
  stopTimes: GtfsStopTime[];
  shapes: Map<string, ShapePoint[]>;
};

export type Derived = {
  segmentsByRoute: Map<string, Segment[]>;
  delaysByRoute: Map<string, DelayPoint[]>;
};

// ---- CSV parsing (simple, GTFS doesn't quote in our sample) ----
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

async function loadCsv(file: string): Promise<Record<string, string>[]> {
  const res = await fetch(`/gtfs/${file}`);
  if (!res.ok) throw new Error(`Failed to load /gtfs/${file}`);
  return parseCsv(await res.text());
}

// ---- deterministic hash for synthetic delay/crowding ----
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function gtfsTimeToSeconds(t: string): number {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

// ---- public loader ----
export async function loadGtfs(): Promise<Gtfs> {
  const [routesRaw, stopsRaw, tripsRaw, stopTimesRaw, shapesRaw] = await Promise.all([
    loadCsv("routes.txt"),
    loadCsv("stops.txt"),
    loadCsv("trips.txt"),
    loadCsv("stop_times.txt"),
    loadCsv("shapes.txt"),
  ]);

  const routes: GtfsRoute[] = routesRaw.map((r) => {
    const rt = Number(r.route_type);
    return {
      route_id: r.route_id,
      route_short_name: r.route_short_name,
      route_long_name: r.route_long_name,
      route_type: rt,
      mode: rt === 3 ? "bus" : "train",
    };
  });

  const stops = new Map<string, GtfsStop>();
  stopsRaw.forEach((s) =>
    stops.set(s.stop_id, {
      stop_id: s.stop_id,
      stop_name: s.stop_name,
      stop_lat: Number(s.stop_lat),
      stop_lon: Number(s.stop_lon),
    })
  );

  const trips: GtfsTrip[] = tripsRaw.map((t) => ({
    route_id: t.route_id,
    service_id: t.service_id,
    trip_id: t.trip_id,
    shape_id: t.shape_id,
  }));

  const stopTimes: GtfsStopTime[] = stopTimesRaw.map((st) => ({
    trip_id: st.trip_id,
    arrival_time: st.arrival_time,
    departure_time: st.departure_time,
    stop_id: st.stop_id,
    stop_sequence: Number(st.stop_sequence),
  }));

  const shapes = new Map<string, ShapePoint[]>();
  shapesRaw.forEach((p) => {
    const sp: ShapePoint = {
      shape_id: p.shape_id,
      lat: Number(p.shape_pt_lat),
      lon: Number(p.shape_pt_lon),
      seq: Number(p.shape_pt_sequence),
    };
    if (!shapes.has(sp.shape_id)) shapes.set(sp.shape_id, []);
    shapes.get(sp.shape_id)!.push(sp);
  });
  shapes.forEach((arr) => arr.sort((a, b) => a.seq - b.seq));

  return { routes, stops, trips, stopTimes, shapes };
}

// ---- derive segments by walking each route's representative trip ----
function nearestShapeIndex(shape: ShapePoint[], lat: number, lon: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < shape.length; i++) {
    const dy = shape[i].lat - lat;
    const dx = shape[i].lon - lon;
    const d = dy * dy + dx * dx;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function buildSegments(g: Gtfs): Map<string, Segment[]> {
  const segmentsByRoute = new Map<string, Segment[]>();
  const tripsByRoute = new Map<string, GtfsTrip[]>();
  g.trips.forEach((t) => {
    if (!tripsByRoute.has(t.route_id)) tripsByRoute.set(t.route_id, []);
    tripsByRoute.get(t.route_id)!.push(t);
  });
  const stopTimesByTrip = new Map<string, GtfsStopTime[]>();
  g.stopTimes.forEach((st) => {
    if (!stopTimesByTrip.has(st.trip_id)) stopTimesByTrip.set(st.trip_id, []);
    stopTimesByTrip.get(st.trip_id)!.push(st);
  });

  for (const route of g.routes) {
    const trip = tripsByRoute.get(route.route_id)?.[0];
    if (!trip) continue;
    const shape = g.shapes.get(trip.shape_id) ?? [];
    const sts = (stopTimesByTrip.get(trip.trip_id) ?? []).sort(
      (a, b) => a.stop_sequence - b.stop_sequence
    );
    const segs: Segment[] = [];
    for (let i = 0; i < sts.length - 1; i++) {
      const fromStop = g.stops.get(sts[i].stop_id);
      const toStop = g.stops.get(sts[i + 1].stop_id);
      if (!fromStop || !toStop) continue;
      let latlngs: [number, number][];
      if (shape.length) {
        const a = nearestShapeIndex(shape, fromStop.stop_lat, fromStop.stop_lon);
        const b = nearestShapeIndex(shape, toStop.stop_lat, toStop.stop_lon);
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        latlngs = shape.slice(lo, hi + 1).map((p) => [p.lat, p.lon]);
        if (latlngs.length < 2) {
          latlngs = [
            [fromStop.stop_lat, fromStop.stop_lon],
            [toStop.stop_lat, toStop.stop_lon],
          ];
        }
      } else {
        latlngs = [
          [fromStop.stop_lat, fromStop.stop_lon],
          [toStop.stop_lat, toStop.stop_lon],
        ];
      }
      const segment_id = `${route.route_id}-${i + 1}`;
      // synthetic crowding: peak around mid-route + per-route variation
      const middleness = 1 - Math.abs((i + 0.5) / Math.max(sts.length - 1, 1) - 0.5) * 2;
      const base = 0.35 + middleness * 0.55;
      const jitter = (hashStr(segment_id) - 0.5) * 0.35;
      const load_factor = Math.max(0.1, Math.min(1.25, base + jitter));
      segs.push({
        route_id: route.route_id,
        segment_id,
        segment_name: `${fromStop.stop_name} → ${toStop.stop_name}`,
        load_factor,
        latlngs,
        from_stop: fromStop,
        to_stop: toStop,
      });
    }
    segmentsByRoute.set(route.route_id, segs);
  }
  return segmentsByRoute;
}

// ---- derive delays per scheduled stop_time ----
export function buildDelays(g: Gtfs): Map<string, DelayPoint[]> {
  const byRoute = new Map<string, DelayPoint[]>();
  const tripIdToRoute = new Map(g.trips.map((t) => [t.trip_id, t.route_id]));
  // synthetic peak hour per route
  const peakByRoute = new Map<string, number>();
  g.routes.forEach((r) => peakByRoute.set(r.route_id, 7 + Math.floor(hashStr(r.route_id) * 12)));
  // arbitrary base date for timestamps
  const baseDate = "2026-05-09";

  for (const st of g.stopTimes) {
    const route_id = tripIdToRoute.get(st.trip_id);
    if (!route_id) continue;
    const sec = gtfsTimeToSeconds(st.arrival_time);
    const hour = Math.floor(sec / 3600) % 24;
    const peak = peakByRoute.get(route_id) ?? 8;
    const dist = Math.min(Math.abs(hour - peak), Math.abs(hour - peak - 12));
    const baseDelay = Math.max(0, 320 - dist * 55);
    const noise = (hashStr(`${st.trip_id}|${st.stop_id}`) - 0.4) * 220;
    const delay_seconds = Math.max(0, Math.round(baseDelay + noise));
    const ts = `${baseDate}T${st.arrival_time}Z`;
    if (!byRoute.has(route_id)) byRoute.set(route_id, []);
    byRoute.get(route_id)!.push({
      route_id,
      trip_id: st.trip_id,
      stop_id: st.stop_id,
      ts,
      delay_seconds,
    });
  }
  // sort each route's delays by ts for nicer line charts
  byRoute.forEach((arr) => arr.sort((a, b) => a.ts.localeCompare(b.ts)));
  return byRoute;
}

export function deriveAll(g: Gtfs): Derived {
  return {
    segmentsByRoute: buildSegments(g),
    delaysByRoute: buildDelays(g),
  };
}
