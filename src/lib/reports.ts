// Shared types for live status reports.

export type ReportType = "crowded" | "delayed" | "ghost";

export type LiveReport = {
  id: string;
  type: ReportType;
  lat: number;
  lng: number;
  stop_name: string;
  route_id: string;
  ts: number;
};

export const REPORT_META: Record<ReportType, { label: string; cls: string; emoji: string; short: string }> = {
  crowded: { label: "Bus is Crowded", cls: "report-crowded", emoji: "👥", short: "C" },
  delayed: { label: "Bus is Delayed", cls: "report-delayed", emoji: "⏱", short: "D" },
  ghost: { label: "Ghost Bus (Didn't Show)", cls: "report-ghost", emoji: "👻", short: "G" },
};
