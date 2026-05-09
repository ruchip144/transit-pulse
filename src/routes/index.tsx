import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TransitMap } from "@/components/TransitMap";
import { routes, delays, crowding, colorForLoad, loadLabel } from "@/lib/transit-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Transit Efficiency Dashboard" },
      { name: "description", content: "Routes, delays, peak hours, and crowding for buses and trains." },
    ],
  }),
  component: Dashboard,
});

type Mode = "all" | "bus" | "train";

function Dashboard() {
  const [mode, setMode] = useState<Mode>("all");
  const [search, setSearch] = useState("");
  const [hourRange, setHourRange] = useState<[number, number]>([0, 23]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("R1");

  const filteredRoutes = useMemo(
    () =>
      routes.filter(
        (r) =>
          (mode === "all" || r.route_type === mode) &&
          (r.route_long_name.toLowerCase().includes(search.toLowerCase()) ||
            r.route_short_name.toLowerCase().includes(search.toLowerCase()))
      ),
    [mode, search]
  );

  const selectedRoute = routes.find((r) => r.route_id === selectedRouteId);

  const routeDelays = useMemo(
    () =>
      delays.filter((d) => {
        if (d.route_id !== selectedRouteId) return false;
        const h = new Date(d.ts).getUTCHours();
        return h >= hourRange[0] && h <= hourRange[1];
      }),
    [selectedRouteId, hourRange]
  );

  const routeSegments = useMemo(
    () => crowding.filter((c) => c.route_id === selectedRouteId),
    [selectedRouteId]
  );

  const stats = useMemo(() => {
    if (!routeDelays.length) return { avgMin: "0.0", onTimePct: 0, p90: "0.0" };
    const avgSec = routeDelays.reduce((a, p) => a + p.delay_seconds, 0) / routeDelays.length;
    const onTime = routeDelays.filter((p) => p.delay_seconds <= 60).length / routeDelays.length;
    const sorted = [...routeDelays].map((d) => d.delay_seconds).sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
    return { avgMin: (avgSec / 60).toFixed(1), onTimePct: Math.round(onTime * 100), p90: (p90 / 60).toFixed(1) };
  }, [routeDelays]);

  const hourBuckets = useMemo(() => {
    const arr = new Array(24).fill(0).map((_, h) => ({ hour: h, count: 0, totalDelay: 0 }));
    routeDelays.forEach((p) => {
      const h = new Date(p.ts).getUTCHours();
      arr[h].count += 1;
      arr[h].totalDelay += p.delay_seconds;
    });
    return arr.map((b) => ({
      hour: `${b.hour}:00`,
      avgDelay: b.count ? +(b.totalDelay / b.count / 60).toFixed(2) : 0,
      count: b.count,
    }));
  }, [routeDelays]);

  const peakHour = useMemo(() => {
    if (!hourBuckets.length) return "—";
    const top = [...hourBuckets].sort((a, b) => b.avgDelay - a.avgDelay)[0];
    return top.hour;
  }, [hourBuckets]);

  const delayLine = useMemo(
    () =>
      routeDelays.map((p) => ({
        time: new Date(p.ts).toISOString().slice(11, 16),
        delay: +(p.delay_seconds / 60).toFixed(2),
      })),
    [routeDelays]
  );

  const delayDistribution = useMemo(() => {
    const buckets = [
      { range: "0–1m", min: 0, max: 60, count: 0 },
      { range: "1–3m", min: 60, max: 180, count: 0 },
      { range: "3–5m", min: 180, max: 300, count: 0 },
      { range: "5–10m", min: 300, max: 600, count: 0 },
      { range: "10m+", min: 600, max: Infinity, count: 0 },
    ];
    routeDelays.forEach((p) => {
      const b = buckets.find((x) => p.delay_seconds >= x.min && p.delay_seconds < x.max);
      if (b) b.count += 1;
    });
    return buckets;
  }, [routeDelays]);

  const topCrowded = useMemo(
    () =>
      [...crowding]
        .sort((a, b) => b.load_factor - a.load_factor)
        .slice(0, 6)
        .map((s) => ({
          name: `${s.segment_id}`,
          full: s.segment_name,
          load: +(s.load_factor * 100).toFixed(0),
          fill: colorForLoad(s.load_factor),
        })),
    []
  );

  const mostCrowded = useMemo(() => {
    const onRoute = [...routeSegments].sort((a, b) => b.load_factor - a.load_factor)[0];
    return onRoute;
  }, [routeSegments]);

  const topDelayedRoutes = useMemo(() => {
    return routes
      .map((r) => {
        const pts = delays.filter((d) => d.route_id === r.route_id);
        const avg = pts.length ? pts.reduce((a, p) => a + p.delay_seconds, 0) / pts.length / 60 : 0;
        return { route: r.route_short_name, avg: +avg.toFixed(2), id: r.route_id };
      })
      .sort((a, b) => b.avg - a.avg);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Transit Efficiency Dashboard</h1>
              <p className="text-sm text-muted-foreground">Routes, delays, peak hours & crowding</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border bg-background p-1">
                {(["all", "bus", "train"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-1 text-xs font-medium rounded capitalize transition ${
                      mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "all" ? "Bus + Train" : m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search routes</label>
            <Input
              placeholder="e.g. Airport, T2…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-2"
            />
            <div className="mt-3 max-h-[360px] overflow-y-auto space-y-1">
              {filteredRoutes.map((r) => (
                <button
                  key={r.route_id}
                  onClick={() => setSelectedRouteId(r.route_id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition border ${
                    selectedRouteId === r.route_id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={r.route_type === "train" ? "default" : "secondary"} className="text-[10px]">
                      {r.route_short_name}
                    </Badge>
                    <span className="font-medium">{r.route_long_name}</span>
                  </div>
                  <div className="text-[11px] opacity-70 mt-0.5 capitalize">{r.route_type}</div>
                </button>
              ))}
              {!filteredRoutes.length && (
                <p className="text-xs text-muted-foreground p-2">No routes match.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Hour range: {hourRange[0]}:00 – {hourRange[1]}:00
            </label>
            <div className="flex items-center gap-2 mt-3">
              <Input
                type="number" min={0} max={23} value={hourRange[0]}
                onChange={(e) => setHourRange([Math.min(+e.target.value, hourRange[1]), hourRange[1]])}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number" min={0} max={23} value={hourRange[1]}
                onChange={(e) => setHourRange([hourRange[0], Math.max(+e.target.value, hourRange[0])])}
              />
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setHourRange([0, 23])}>
              Reset
            </Button>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Crowding legend</h3>
            <div className="space-y-2 text-xs">
              {[
                { lf: 0.2, label: "Light (<40%)" },
                { lf: 0.5, label: "Moderate (40–70%)" },
                { lf: 0.8, label: "Crowded (70–100%)" },
                { lf: 1.1, label: "Over capacity (>100%)" },
              ].map((x) => (
                <div key={x.label} className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded" style={{ background: colorForLoad(x.lf) }} />
                  <span>{x.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <section className="lg:col-span-9 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI label="On-time %" value={`${stats.onTimePct}%`} hint={selectedRoute?.route_long_name} />
            <KPI label="Avg delay" value={`${stats.avgMin} min`} hint={`P90: ${stats.p90} min`} />
            <KPI label="Peak hour" value={peakHour} hint="Highest avg delay" />
            <KPI
              label="Most crowded"
              value={mostCrowded ? `${Math.round(mostCrowded.load_factor * 100)}%` : "—"}
              hint={mostCrowded ? mostCrowded.segment_name : undefined}
              accent={mostCrowded ? colorForLoad(mostCrowded.load_factor) : undefined}
            />
          </div>

          {/* Map */}
          <Card title="Route + Crowding" subtitle={selectedRoute?.route_long_name}>
            <TransitMap segments={routeSegments} />
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {routeSegments.map((s) => (
                <div key={s.segment_id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorForLoad(s.load_factor) }} />
                    <span className="font-medium">{s.segment_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(s.load_factor * 100)}% · {loadLabel(s.load_factor)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card title="Delay over time" subtitle="Minutes per observation">
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={delayLine}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.ceil(delayLine.length / 8)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="delay" stroke="oklch(0.55 0.18 255)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Delay distribution" subtitle="Count of observations per delay bucket">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={delayDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="oklch(0.6 0.16 200)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Peak hours" subtitle="Average delay by hour of day">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={hourBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="avgDelay" fill="oklch(0.65 0.2 30)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Top crowded segments" subtitle="Across all routes">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={topCrowded} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                    <Tooltip formatter={(v: number, _n, p) => [`${v}%`, p.payload.full]} />
                    <Bar dataKey="load" radius={[0, 6, 6, 0]}>
                      {topCrowded.map((d) => (
                        <Bar key={d.name} dataKey="load" fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card title="Top delayed routes" subtitle="Average delay (min) across full day">
            <div className="divide-y">
              {topDelayedRoutes.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRouteId(r.id)}
                  className="w-full flex items-center justify-between py-2.5 px-1 hover:bg-accent rounded transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                    <Badge variant="secondary">{r.route}</Badge>
                    <span className="text-sm">{routes.find((x) => x.route_id === r.id)?.route_long_name}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{r.avg} min</span>
                </button>
              ))}
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}

function KPI({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 relative overflow-hidden">
      {accent && <span className="absolute top-0 left-0 right-0 h-1" style={{ background: accent }} />}
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1 truncate">{hint}</div>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3">
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
