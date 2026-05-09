import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { colorForLoad, loadLabel, type CrowdSegment } from "@/lib/transit-data";

type Props = { segments: CrowdSegment[] };

export function TransitMap({ segments }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([12.98, 77.6], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    mapInstance.current = map;
    layerRef.current = L.layerGroup().addTo(map);
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
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
      // endpoint markers
      const endpoints = [seg.latlngs[0], seg.latlngs[seg.latlngs.length - 1]];
      endpoints.forEach((pt) => {
        L.circleMarker(pt, {
          radius: 4,
          color: "#0f172a",
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 2,
        }).addTo(layer);
      });
    });

    const bounds = L.latLngBounds(segments.flatMap((s) => s.latlngs));
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [segments]);

  return <div ref={mapRef} className="h-[420px] w-full rounded-lg overflow-hidden border" />;
}
