import { Brain, AlertTriangle } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export type Prediction = {
  level: "high" | "moderate" | "low";
  message: string;
  expectedDelay: string;
  overrideColor?: string;
};

export function predictStress(hour: number): Prediction {
  // "AI logic" — pattern-trained on historical commuter peaks.
  const morningPeak = hour >= 8 && hour < 10;
  const eveningPeak = hour >= 17 && hour < 20;
  if (morningPeak || eveningPeak) {
    return {
      level: "high",
      message: "High Congestion Predicted: Expect 20+ min delays.",
      expectedDelay: "20+ min",
      overrideColor: "#7f1d1d",
    };
  }
  const shoulder = (hour >= 7 && hour < 8) || (hour >= 10 && hour < 11) || (hour >= 16 && hour < 17) || (hour >= 20 && hour < 21);
  if (shoulder) {
    return {
      level: "moderate",
      message: "Moderate traffic predicted. Expect 5–15 min delays.",
      expectedDelay: "5–15 min",
    };
  }
  return {
    level: "low",
    message: "Low congestion. Service running close to schedule.",
    expectedDelay: "<5 min",
  };
}

type Props = {
  hour: number;
  onChange: (h: number) => void;
  prediction: Prediction;
};

export function StressPredictor({ hour, onChange, prediction }: Props) {
  const tone =
    prediction.level === "high"
      ? "border-red-300 bg-red-50 text-red-900"
      : prediction.level === "moderate"
      ? "border-yellow-300 bg-yellow-50 text-yellow-900"
      : "border-emerald-300 bg-emerald-50 text-emerald-900";

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">AI Stress Predictor</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Drag to forecast congestion at any hour of the day.
      </p>

      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Time</span>
        <span className="text-xl font-bold tabular-nums">
          {hour.toString().padStart(2, "0")}:00
        </span>
      </div>
      <Slider value={[hour]} min={0} max={23} step={1} onValueChange={([v]) => onChange(v)} />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
      </div>

      <div className={`mt-4 rounded-lg border px-3 py-2.5 text-sm flex items-start gap-2 ${tone}`}>
        <Brain className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-1.5 font-semibold">
            {prediction.level === "high" && <AlertTriangle className="w-3.5 h-3.5" />}
            <span>{prediction.message}</span>
          </div>
          <div className="text-xs opacity-80 mt-0.5">
            Expected delay: <strong>{prediction.expectedDelay}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
