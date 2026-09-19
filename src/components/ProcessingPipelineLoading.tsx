import { useEffect, useState } from "react";
import {
  Layers, Users, Route, Target, Cpu, Flame, CheckCircle2,
  Sparkles, Terminal, Activity
} from "lucide-react";
import type { City, ScoringConfig } from "@/lib/sitescope/types";

interface ProcessingPipelineLoadingProps {
  city: City;
  config: ScoringConfig | null;
  onComplete: () => void;
}

interface StepInfo {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  metric: string;
  details: string[];
}

export function ProcessingPipelineLoading({ city, config, onComplete }: ProcessingPipelineLoadingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const steps: StepInfo[] = [
    {
      id: "grid",
      icon: <Layers className="w-4 h-4 text-blue-500" />,
      title: "Partitioning Urban Hex Cells",
      subtitle: `Uber H3 Res 8 Tessellation across ${city.name}`,
      metric: `${city.hexCount} hex cells`,
      details: [
        `Constructed spatial bounding envelope around [${city.center[0].toFixed(2)}, ${city.center[1].toFixed(2)}]`,
        `Generated ${city.hexCount} analytical zones (~0.73 km² each)`,
      ],
    },
    {
      id: "demographics",
      icon: <Users className="w-4 h-4 text-emerald-500" />,
      title: "Synthesizing Mobility & Footfall",
      subtitle: "Aggregating pedestrian density & residential population",
      metric: "98.4% coverage",
      details: [
        "Injected high-resolution synthetic census population grid",
        "Estimated daily footfall curves across commercial corridors",
      ],
    },
    {
      id: "accessibility",
      icon: <Route className="w-4 h-4 text-teal-500" />,
      title: "Mapping Road Graph & Isochrones",
      subtitle: "Computing multimodal travel times (walk & drive)",
      metric: "5, 10, 15 min reach",
      details: [
        `Simulating ${config?.isochroneMinutes ?? 15}-min accessibility network`,
        "Calculated population catchments and street network graph weights",
      ],
    },
    {
      id: "poi",
      icon: <Target className="w-4 h-4 text-amber-500" />,
      title: "Analyzing Competitor POIs & Clusters",
      subtitle: `Evaluating ${config?.competitionMode ?? "penalize"} mode`,
      metric: "160+ POIs tracked",
      details: [
        `Applied exponential distance decay kernel (d₀ = ${(config?.decayD0 ?? 1000) / 1000} km)`,
        "Quantified complementary synergy from retail draws",
      ],
    },
    {
      id: "mcda",
      icon: <Cpu className="w-4 h-4 text-purple-500" />,
      title: "Executing Multi-Criteria Scoring (MCDA)",
      subtitle: "Applying weighted preference vector to all cells",
      metric: "6 Layer fusion",
      details: [
        "Normalized 0–1 feature vector across Footfall, Competition, Rent & Accessibility",
        "Applied user-configured business requirements and budget constraints",
      ],
    },
    {
      id: "hotspots",
      icon: <Flame className="w-4 h-4 text-rose-500" />,
      title: "Computing Getis-Ord Gi* Spatial Hotspots",
      subtitle: "Detecting statistically significant clusters & underserved pockets",
      metric: "z-score α=0.01",
      details: [
        "Computed local spatial autocorrelation statistics for high-value demand clusters",
        "Identified prime underserved opportunity zones with low competitor saturation",
      ],
    },
    {
      id: "ai",
      icon: <Sparkles className="w-4 h-4 text-emerald-600" />,
      title: "Generating AI Site Readiness Insights",
      subtitle: "Formulating Top 5 location recommendations & strategic insights",
      metric: "Ready",
      details: [
        "Synthesized trade-off rationales, demographic fit, and risk assessment",
        "Initialized interactive Voice & Text Site Copilot",
      ],
    },
  ];

  useEffect(() => {
    const totalDuration = 3200; // 3.2s
    const stepDuration = totalDuration / steps.length;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / totalDuration) * 100));
      setProgress(pct);

      const activeIdx = Math.min(steps.length - 1, Math.floor(elapsed / stepDuration));
      setCurrentStep(activeIdx);

      const newlyCompleted: number[] = [];
      for (let i = 0; i < activeIdx; i++) {
        newlyCompleted.push(i);
      }
      setCompletedSteps(newlyCompleted);

      const currentStepObj = steps[activeIdx];
      if (currentStepObj) {
        setLogs((prev) => {
          const log1 = `[${new Date().toISOString().substring(11, 19)}] >> EXEC: ${currentStepObj.title}`;
          const log2 = `[INFO] ${currentStepObj.details[0]}`;
          if (!prev.includes(log1)) {
            return [log1, log2, ...prev.slice(0, 6)];
          }
          return prev;
        });
      }

      if (elapsed >= totalDuration) {
        clearInterval(interval);
        setCompletedSteps(steps.map((_, i) => i));
        setTimeout(onComplete, 300);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f8fafc] text-[#0f172a] px-4 py-6 overflow-y-auto select-none font-sans">
      <div className="relative z-10 max-w-2xl w-full flex flex-col gap-4">
        {/* Header Bar Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#059669] to-[#0f766e] flex items-center justify-center text-white shadow-xs">
              <Activity className="w-5 h-5 animate-spin" style={{ animationDuration: "6s" }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold font-display text-slate-900">
                  Processing Geospatial Intelligence
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">
                  {city.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Multi-criteria MCDA evaluation & Getis-Ord Gi* hotspot detection
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] font-mono text-slate-400">Progress</div>
            <div className="text-base font-bold font-mono text-[#059669]">{progress}%</div>
          </div>
        </div>

        {/* Global Progress Line */}
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#059669] to-[#0f766e] transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Pipeline Steps List */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-2">
          <div className="text-[10px] font-bold uppercase font-mono text-slate-400 px-2 flex justify-between">
            <span>Spatial Computation Stages</span>
            <span>{completedSteps.length + (currentStep < steps.length ? 1 : 0)} of {steps.length}</span>
          </div>

          {steps.map((s, idx) => {
            const isDone = completedSteps.includes(idx);
            const isActive = currentStep === idx && !isDone;

            return (
              <div
                key={s.id}
                className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-150 ${
                  isActive
                    ? "bg-emerald-50/80 border-[#059669] shadow-xs"
                    : isDone
                      ? "bg-slate-50/70 border-slate-200/80"
                      : "bg-transparent border-transparent opacity-40"
                }`}
              >
                <div className="mt-0.5">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : isActive ? (
                    <div className="w-4 h-4 rounded-full border-2 border-[#059669] border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[9px] text-slate-400">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold truncate ${isActive ? "text-[#064e3b]" : isDone ? "text-slate-800" : "text-slate-400"}`}>
                      {s.title}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                      {s.metric}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {s.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
