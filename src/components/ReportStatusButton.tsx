import { useState } from "react";
import { Megaphone, Users, Clock, Ghost } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { REPORT_META, type LiveReport, type ReportType } from "@/lib/reports";
import type { Gtfs } from "@/lib/gtfs";

type Props = {
  selectedRouteId: string | null;
  gtfs: Gtfs;
  onReport: (r: LiveReport) => void;
};

const TYPE_ICONS: Record<ReportType, typeof Users> = {
  crowded: Users,
  delayed: Clock,
  ghost: Ghost,
};

export function ReportStatusButton({ selectedRouteId, gtfs, onReport }: Props) {
  const [open, setOpen] = useState(false);

  function submit(type: ReportType) {
    if (!selectedRouteId) return;
    // attach to a stop on the current route
    const stopIds = new Set<string>();
    gtfs.trips
      .filter((t) => t.route_id === selectedRouteId)
      .forEach((t) => {
        gtfs.stopTimes.filter((st) => st.trip_id === t.trip_id).forEach((st) => stopIds.add(st.stop_id));
      });
    const stops = Array.from(stopIds)
      .map((id) => gtfs.stops.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    if (!stops.length) return;
    const stop = stops[Math.floor(Math.random() * stops.length)];
    onReport({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      lat: stop.stop_lat,
      lng: stop.stop_lon,
      stop_name: stop.stop_name,
      route_id: selectedRouteId,
      ts: Date.now(),
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={!selectedRouteId} className="gap-1.5">
          <Megaphone className="w-4 h-4" />
          Report Live Status
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What's happening on this route?</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 mt-2">
          {(Object.keys(REPORT_META) as ReportType[]).map((t) => {
            const meta = REPORT_META[t];
            const Icon = TYPE_ICONS[t];
            return (
              <button
                key={t}
                onClick={() => submit(t)}
                className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent transition"
              >
                <span
                  className={`report-pin ${meta.cls} relative`}
                  style={{ width: 28, height: 28 }}
                >
                  <Icon className="w-3.5 h-3.5 relative z-10" />
                </span>
                <div>
                  <div className="font-medium text-sm">{meta.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Pinned to a random stop on the selected route.
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
