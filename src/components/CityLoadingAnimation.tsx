import { useEffect, useState } from "react";
import { Globe, Activity, MapPin, Layers } from "lucide-react";
import type { City } from "@/lib/sitescope/types";

interface CityLoadingAnimationProps {
  city: City;
  onComplete: () => void;
}

export function CityLoadingAnimation({ city, onComplete }: CityLoadingAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  const stages = [
    { label: "Acquiring Metropolitan Bounding Box...", detail: `Targeting [${city.center[0].toFixed(4)}° E, ${city.center[1].toFixed(4)}° N]` },
    { label: "Initializing Uber H3 Hexagonal Grid...", detail: `Resolution Level ${city.resolution} (~460m edge length)` },
    { label: "Partitioning Urban Spatial Cells...", detail: `Generating ${city.hexCount} hexagonal analytical zones` },
    { label: "Attaching Geospatial Demographics...", detail: "Synthesizing mobility, footfall & accessibility layers" },
    { label: "City Matrix Ready for Parameter Analysis", detail: "Spanning coverage across commercial & residential hubs" },
  ];

  useEffect(() => {
    const startTime = Date.now();
    const duration = 2200; // 2.2s

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      const idx = Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length));
      setStageIndex(idx);

      if (elapsed >= duration) {
        clearInterval(interval);
        setTimeout(onComplete, 200);
      }
    }, 35);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f8fafc] text-[#0f172a] px-4 overflow-hidden select-none">
      {/* Background subtle radial glow */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(50% 50% at 50% 50%, rgba(16, 185, 129, 0.12) 0%, transparent 80%)",
        }}
      />

      {/* Main Clean Light Card */}
      <div className="relative z-10 max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        {/* Radar Icon */}
        <div className="relative w-20 h-20 mb-5 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-dashed border-emerald-400/60 animate-spin" style={{ animationDuration: "5s" }} />
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center shadow-inner">
            <Globe className="w-7 h-7 animate-pulse" />
          </div>
        </div>

        {/* Region Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#065f46] text-xs font-semibold tracking-wide mb-2">
          <MapPin className="w-3.5 h-3.5 text-[#059669]" />
          <span>{city.region}</span>
        </div>

        <h2 className="text-2xl font-bold font-display text-[#0f172a] tracking-tight mb-1">
          Loading {city.name}
        </h2>
        <p className="text-slate-500 text-xs font-mono mb-5">
          Spatial Mesh: {city.center[0]}° E, {city.center[1]}° N
        </p>

        {/* Metrics Grid */}
        <div className="w-full grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-3 mb-5 text-left">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">Hexagons</div>
            <div className="text-sm font-bold text-slate-800 font-mono">
              {Math.min(city.hexCount, Math.round((progress / 100) * city.hexCount))}
            </div>
          </div>
          <div className="border-l border-slate-200 pl-2">
            <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">Resolution</div>
            <div className="text-sm font-bold text-slate-800 font-mono">Res {city.resolution}</div>
          </div>
          <div className="border-l border-slate-200 pl-2">
            <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">Layers</div>
            <div className="text-sm font-bold text-[#059669] font-mono">{city.layers.length} Live</div>
          </div>
        </div>

        {/* Active Stage Detail */}
        <div className="w-full text-left mb-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-700 font-semibold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#059669] animate-spin" />
              {stages[stageIndex]?.label}
            </span>
            <span className="font-mono text-[#059669] font-bold">{progress}%</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono truncate">
            {stages[stageIndex]?.detail}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#059669] to-[#0f766e] transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
