import { useState } from "react";
import { Route, Footprints, Users, Map } from "lucide-react";
import { fetchIsochrone, type IsochroneBand } from "@/lib/api";

interface IsochroneTabProps {
  selectedH3: string | null;
  selectedLngLat: [number, number] | null;
  cityId: string;
  onIsochroneData: (bands: IsochroneBand[]) => void;
}

const MINUTE_COLORS: Record<number, string> = {
  10: "#3b82f6",
  20: "#8b5cf6",
  30: "#ec4899",
};

function formatPop(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function IsochroneTab({
  selectedH3,
  selectedLngLat,
  cityId,
  onIsochroneData,
}: IsochroneTabProps) {
  const [mode, setMode] = useState<"walk" | "drive">("drive");
  const [minutes, setMinutes] = useState<number[]>([10, 20, 30]);
  const [bands, setBands] = useState<IsochroneBand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMinute = (m: number) => {
    setMinutes((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)
    );
  };

  const run = async () => {
    if (!selectedLngLat) {
      setError("Select a hex on the map first.");
      return;
    }
    setLoading(true);
    setError(null);
    const [lng, lat] = selectedLngLat;
    const res = await fetchIsochrone(cityId, lat, lng, mode, minutes);
    if (res) {
      setBands(res.bands);
      onIsochroneData(res.bands);
    } else {
      // Offline fallback: circle approximation
      const fallback: IsochroneBand[] = minutes.map((m) => {
        const speed = mode === "walk" ? 4.8 : 25;
        const r = (speed * m) / 60;
        return {
          minutes: m,
          mode,
          radius_km: r,
          hex_count: Math.round(Math.PI * r * r / 0.7),
          population: Math.round(Math.PI * r * r * 8000),
          area_km2: Math.round(Math.PI * r * r * 100) / 100,
          polygon: [],
        };
      });
      setBands(fallback);
      onIsochroneData(fallback);
      setError("Backend unavailable — showing estimated values.");
    }
    setLoading(false);
  };

  if (!selectedH3) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
        <Route size={36} className="text-slate-600" />
        <p className="text-slate-400 text-sm">Click a hex on the map, then compute isochrones to see reachable population bands.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-1">
      {/* Mode selector */}
      <div className="flex gap-2">
        {(["walk", "drive"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm transition-all ${
              mode === m
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-slate-700/30 border-slate-600/30 text-slate-400 hover:bg-slate-700/50"
            }`}
          >
            {m === "walk" ? <Footprints size={14} /> : <Route size={14} />}
            {m === "walk" ? "Walking" : "Driving"}
          </button>
        ))}
      </div>

      {/* Minute chips */}
      <div>
        <p className="text-xs text-slate-400 mb-2">Travel time bands</p>
        <div className="flex gap-2">
          {[10, 20, 30].map((m) => (
            <button
              key={m}
              onClick={() => toggleMinute(m)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                minutes.includes(m)
                  ? "border-opacity-60 text-white"
                  : "border-slate-600/30 text-slate-500 bg-slate-800/40"
              }`}
              style={
                minutes.includes(m)
                  ? { borderColor: MINUTE_COLORS[m], background: MINUTE_COLORS[m] + "20", color: MINUTE_COLORS[m] }
                  : {}
              }
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={run}
        disabled={loading || minutes.length === 0}
        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm disabled:opacity-50 hover:from-blue-500 hover:to-indigo-500 transition-all"
      >
        {loading ? "Computing…" : "Compute Isochrones"}
      </button>

      {error && <p className="text-xs text-amber-400">{error}</p>}

      {/* Results table */}
      {bands.length > 0 && (
        <div className="flex flex-col gap-2">
          {bands.map((band) => (
            <div
              key={band.minutes}
              className="rounded-lg border p-3"
              style={{ borderColor: MINUTE_COLORS[band.minutes] + "40", background: MINUTE_COLORS[band.minutes] + "08" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: MINUTE_COLORS[band.minutes] }}>
                  {band.minutes} min {mode === "walk" ? "walk" : "drive"}
                </span>
                <span className="text-xs text-slate-400">{band.radius_km.toFixed(1)} km radius</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Users size={11} className="text-slate-400" />
                  <span className="text-slate-400">Population</span>
                  <span className="text-white font-semibold ml-auto">{formatPop(band.population)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Map size={11} className="text-slate-400" />
                  <span className="text-slate-400">Area</span>
                  <span className="text-white font-semibold ml-auto">{band.area_km2} km²</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
