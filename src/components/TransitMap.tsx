import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { colorForLoad, loadLabel } from "@/lib/transit-data";
import type { Segment } from "@/lib/gtfs";

type Props = { segments: Segment[] };

export function TransitMap({ segments }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);
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
      layerRef.current = L.layerGroup().addTo(map);
      drawSegments();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawSegments() {
    const L = LRef.current;
    const map = mapInstance.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    if (!segments.length) return;

    segments.forEach((seg) => {
      const poly = L.polyline(seg.latlngs, {
        color: colorForLoad(seg.load_factor),
        weight: 7,
        opacity: 0.9,
      }).addTo(layer);
      poly.bindPopup(
        `<div style="font-family: system-ui; font-size:12px">
          <strong>${seg.segment_name}</strong><br/>
          Load: ${(seg.load_factor * 100).toFixed(0)}% (${loadLabel(seg.load_factor)})
        </div>`
      );
    });

    // Stop markers (unique per route)
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

  useEffect(() => {
    drawSegments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  return <div ref={mapRef} className="h-[420px] w-full rounded-lg overflow-hidden border" />;
}
