import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { colorForLoad, loadLabel } from "@/lib/transit-data";
import type { Segment } from "@/lib/gtfs";
import { REPORT_META, type LiveReport } from "@/lib/reports";

type Props = {
  segments: Segment[];
  overrideColor?: string;
  reports?: LiveReport[];
};

export function TransitMap({ segments, overrideColor, reports = [] }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const segLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reportLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mapRef.current || mapInstance.current) return;
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapRef.current, { zoomControl: true }).setView([12.97, 77.6], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      mapInstance.current = map;
      segLayerRef.current = L.layerGroup().addTo(map);
      reportLayerRef.current = L.layerGroup().addTo(map);
      drawSegments();
      drawReports();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawSegments() {
    const L = LRef.current;
    const map = mapInstance.current;
    const layer = segLayerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    if (!segments.length) return;

    segments.forEach((seg) => {
      const color = overrideColor ?? colorForLoad(seg.load_factor);
      const poly = L.polyline(seg.latlngs, {
        color,
        weight: 7,
        opacity: 0.9,
      }).addTo(layer);
      poly.bindPopup(
        `<div style="font-family: system-ui; font-size:12px">
          <strong>${seg.segment_name}</strong><br/>
          Load: ${(seg.load_factor * 100).toFixed(0)}% (${loadLabel(seg.load_factor)})
          ${overrideColor ? '<br/><em style="color:#dc2626">⚠ AI: high congestion predicted</em>' : ""}
        </div>`
      );
    });

    const seen = new Set<string>();
    segments.forEach((seg) => {
      [seg.from_stop, seg.to_stop].forEach((stop) => {
        if (seen.has(stop.stop_id)) return;
        seen.add(stop.stop_id);
        L.circleMarker([stop.stop_lat, stop.stop_lon], {
          radius: 5,
          color: "#0f172a",
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 2,
        })
          .bindTooltip(stop.stop_name, { direction: "top" })
          .addTo(layer);
      });
    });

    const bounds = L.latLngBounds(segments.flatMap((s) => s.latlngs));
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  function drawReports() {
    const L = LRef.current;
    const layer = reportLayerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    reports.forEach((r) => {
      const meta = REPORT_META[r.type];
      const icon = L.divIcon({
        className: "",
        html: `<div class="report-pin ${meta.cls}"><span>${meta.short}</span></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([r.lat, r.lng], { icon })
        .bindTooltip(
          `<strong>${meta.label}</strong><br/>${r.stop_name} · ${timeAgo(r.ts)}`,
          { direction: "top" }
        )
        .addTo(layer);
    });
  }

  useEffect(() => {
    drawSegments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, overrideColor]);

  useEffect(() => {
    drawReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  return <div ref={mapRef} className="h-[420px] w-full rounded-lg overflow-hidden border" />;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
