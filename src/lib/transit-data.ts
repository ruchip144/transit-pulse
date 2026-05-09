// Shared color helpers for crowding levels.

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
