import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  MapPin, Search, ChevronDown, CheckCircle2,
  SlidersHorizontal, Download,
  GitCompare, Bot, Sparkles, X,
  TrendingUp, Activity, Check, ChevronRight,
  Users, Loader2,
} from "lucide-react";
import { cellToBoundary } from "h3-js";
import { listCities, buildCityData } from "@/lib/sitescope/mock-data";
import { scoreCity, topSites, type ScoredHex } from "@/lib/sitescope/scoring";
import { useSiteScope, type FactorWeights } from "@/lib/sitescope/store";
import { resolveNeighborhood } from "@/lib/sitescope/neighborhoods";
import { fetchScoredHexes } from "@/lib/sitescope/api";
import { HexMap } from "./HexMap";
import { PriorityCard } from "./PriorityCard";
import { AdjustWeightsDrawer, type DrawerConfig } from "./AdjustWeightsDrawer";
import { AiVoiceCopilot } from "./AiVoiceCopilot";
import { CompareTab } from "./CompareTab";
import { exportCSV, exportPDF } from "@/lib/export";
import type { City } from "@/lib/sitescope/types";

interface MapViewProps {
  onBack: () => void;
  onReset: () => void;
}

const BUSINESS_PRESETS = [
  { id: "clinic",  label: "🏥 Healthcare Clinic",    preset: "Healthcare" },
  { id: "cafe",    label: "☕ Cafe & Bakery",        preset: "Cafe" },
  { id: "ev",      label: "⚡ EV Charging Station", preset: "EV Charging" },
  { id: "retail",  label: "🛍️ Retail Store",         preset: "Retail" },
  { id: "kitchen", label: "📦 Cloud Kitchen",        preset: "Cloud Kitchen" },
  { id: "gym",     label: "💪 Fitness Center",       preset: "Fitness" },
];

const PRESET_WEIGHT_MAP: Record<string, Partial<FactorWeights>> = {
  clinic:  { demand: 35, accessibility: 25, landuse: 15, risk: 15, competition: 5, complementary: 5 },
  cafe:    { demand: 35, complementary: 25, accessibility: 20, competition: 10, landuse: 5, risk: 5 },
  ev:      { accessibility: 40, demand: 25, landuse: 15, competition: 10, complementary: 5, risk: 5 },
  retail:  { demand: 30, accessibility: 25, competition: 20, complementary: 15, landuse: 5, risk: 5 },
  kitchen: { accessibility: 30, demand: 30, risk: 15, competition: 10, landuse: 10, complementary: 5 },
  gym:     { demand: 35, accessibility: 25, complementary: 20, competition: 10, landuse: 5, risk: 5 },
};

const DEFAULT_FACTOR_WEIGHTS: FactorWeights = {
  demand: 30,
  accessibility: 25,
  complementary: 15,
  competition: 20,
  landuse: 15,
  risk: 10,
};

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Strong Opportunity", color: "#059669" };
  if (score >= 65) return { label: "Good Potential",     color: "#0f766e" };
  if (score >= 50) return { label: "Moderate Fit",       color: "#0891b2" };
  if (score >= 35) return { label: "Marginal Fit",       color: "#d97706" };
  return                   { label: "Low Suitability",   color: "#dc2626" };
}

export function MapView({ onBack, onReset }: MapViewProps) {
  const {
    city,
    setCity,
    baseConfig,
    activeConfig,
    setActiveConfig,
    resetToMyAnswers,
    selectedH3,
    selectHex,
  } = useSiteScope();

  const cities = listCities();

  const [selectedCityId, setSelectedCityId]   = useState<string>(city?.id ?? "vadodara");
  const [isCityMenuOpen, setIsCityMenuOpen]   = useState(false);
  const [businessType, setBusinessType]       = useState(BUSINESS_PRESETS[0]!.id);
  const [activeNavTab, setActiveNavTab]       = useState<"dashboard" | "analyze" | "compare" | "reports">("dashboard");
  const [isAdjustWeightsOpen, setIsAdjustWeightsOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen]     = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [toastMessage, setToastMessage]       = useState<string | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const [backendScored, setBackendScored] = useState<ScoredHex[] | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(false);

  // Sync city state
  useEffect(() => {
    if (city?.id && city.id !== selectedCityId) {
      setSelectedCityId(city.id);
    }
  }, [city?.id]);

  // Sync business preset from activeConfig
  useEffect(() => {
    if ((activeConfig as any)?.preset) {
      const presetStr = String((activeConfig as any).preset).toLowerCase();
      const match = BUSINESS_PRESETS.find(
        (p) => p.id === presetStr || presetStr.includes(p.id) || p.preset.toLowerCase().includes(presetStr)
      );
      if (match) setBusinessType(match.id);
    }
  }, [activeConfig]);

  const currentActiveConfig: DrawerConfig = useMemo(() => {
    const rawW = activeConfig?.weights as any;
    return {
      weights: {
        demand:        rawW?.demand        ?? (rawW?.population ? Math.round(((rawW.population || 0.2) + (rawW.footfall || 0.2)) * 55) : DEFAULT_FACTOR_WEIGHTS.demand),
        accessibility: rawW?.accessibility ?? DEFAULT_FACTOR_WEIGHTS.accessibility,
        complementary: rawW?.complementary ?? DEFAULT_FACTOR_WEIGHTS.complementary,
        competition:   rawW?.competition   ?? DEFAULT_FACTOR_WEIGHTS.competition,
        landuse:       rawW?.landuse       ?? DEFAULT_FACTOR_WEIGHTS.landuse,
        risk:          rawW?.risk          ?? DEFAULT_FACTOR_WEIGHTS.risk,
      },
      decayType:              (activeConfig?.decay as any)?.type ?? "exponential",
      decayD0Km:              (activeConfig?.decay as any)?.d0_km ?? (activeConfig?.decayD0 ? activeConfig.decayD0 / 1000 : 1.2),
      competitionMode:        (activeConfig?.competition as any)?.mode ?? activeConfig?.competitionMode ?? "penalise",
      competitionRadiusKm:    (activeConfig?.competition as any)?.radius_km ?? 1.0,
      competitionSaturation:  (activeConfig?.competition as any)?.saturation ?? 5,
      constraints:            activeConfig?.constraints ?? ["no_flood"],
    };
  }, [activeConfig]);

  const currentBaseConfig: DrawerConfig = useMemo(() => {
    const rawW = baseConfig?.weights as any;
    return {
      weights: {
        demand:        rawW?.demand        ?? (rawW?.population ? Math.round(((rawW.population || 0.2) + (rawW.footfall || 0.2)) * 55) : DEFAULT_FACTOR_WEIGHTS.demand),
        accessibility: rawW?.accessibility ?? DEFAULT_FACTOR_WEIGHTS.accessibility,
        complementary: rawW?.complementary ?? DEFAULT_FACTOR_WEIGHTS.complementary,
        competition:   rawW?.competition   ?? DEFAULT_FACTOR_WEIGHTS.competition,
        landuse:       rawW?.landuse       ?? DEFAULT_FACTOR_WEIGHTS.landuse,
        risk:          rawW?.risk          ?? DEFAULT_FACTOR_WEIGHTS.risk,
      },
      decayType:             (baseConfig?.decay as any)?.type ?? "exponential",
      decayD0Km:             (baseConfig?.decay as any)?.d0_km ?? (baseConfig?.decayD0 ? baseConfig.decayD0 / 1000 : 1.2),
      competitionMode:       (baseConfig?.competition as any)?.mode ?? baseConfig?.competitionMode ?? "penalise",
      competitionRadiusKm:   (baseConfig?.competition as any)?.radius_km ?? 1.0,
      competitionSaturation: (baseConfig?.competition as any)?.saturation ?? 5,
      constraints:           baseConfig?.constraints ?? ["no_flood"],
    };
  }, [baseConfig]);

  const [liveConfigState, setLiveConfigState] = useState<DrawerConfig>(currentActiveConfig);

  useEffect(() => {
    setLiveConfigState(currentActiveConfig);
  }, [currentActiveConfig]);

  const isCustomized = useMemo(() => {
    if (!baseConfig) return false;
    const cw = liveConfigState.weights;
    const bw = currentBaseConfig.weights;
    return (
      cw.demand !== bw.demand ||
      cw.accessibility !== bw.accessibility ||
      cw.complementary !== bw.complementary ||
      cw.competition !== bw.competition ||
      cw.landuse !== bw.landuse ||
      cw.risk !== bw.risk ||
      liveConfigState.decayD0Km !== currentBaseConfig.decayD0Km ||
      liveConfigState.competitionMode !== currentBaseConfig.competitionMode
    );
  }, [liveConfigState, currentBaseConfig, baseConfig]);

  const activeCity = cities.find((c) => c.id === selectedCityId) ?? cities[0]!;

  const cityData = useMemo(() => buildCityData(activeCity.id), [activeCity.id]);

  // Real-time backend scoring hook
  useEffect(() => {
    let isMounted = true;
    setIsLoadingScore(true);

    const businessPreset = BUSINESS_PRESETS.find((p) => p.id === businessType)?.preset || "Retail Store";

    fetchScoredHexes(activeCity.id, {
      preset: businessPreset,
      weights: liveConfigState.weights,
      decayType: liveConfigState.decayType,
      decayD0Km: liveConfigState.decayD0Km,
      competitionMode: liveConfigState.competitionMode,
      competitionRadiusKm: liveConfigState.competitionRadiusKm,
      competitionSaturation: liveConfigState.competitionSaturation,
      constraints: liveConfigState.constraints,
    })
      .then((res) => {
        if (!isMounted) return;
        if (res && Array.isArray(res.hexes) && res.hexes.length > 0) {
          const mapped: ScoredHex[] = res.hexes.map((h: any) => {
            let boundary: [number, number][] = [];
            try {
              boundary = cellToBoundary(h.h3, true) as [number, number][];
            } catch {
              boundary = [
                [h.lng - 0.005, h.lat - 0.005],
                [h.lng + 0.005, h.lat - 0.005],
                [h.lng + 0.005, h.lat + 0.005],
                [h.lng - 0.005, h.lat + 0.005],
              ];
            }
            const s100 = Math.round(h.score);
            return {
              h3: h.h3,
              center: [h.lng, h.lat],
              boundary,
              score: h.score / 100,
              score100: s100,
              eligible: h.eligible !== false,
              blockedBy: h.blocked_by ? [h.blocked_by] : [],
              parts: [
                { layer: "demand", label: "Demand", weight: liveConfigState.weights.demand, value: h.sub_demand || 50, contribution: h.contrib_demand || 0 },
                { layer: "accessibility", label: "Accessibility", weight: liveConfigState.weights.accessibility, value: h.sub_accessibility || 50, contribution: h.contrib_accessibility || 0 },
                { layer: "competition", label: "Competition", weight: liveConfigState.weights.competition, value: h.sub_competition || 50, contribution: h.contrib_competition || 0 },
                { layer: "landuse", label: "Land Suitability", weight: liveConfigState.weights.landuse, value: h.sub_landuse || 50, contribution: h.contrib_landuse || 0 },
                { layer: "risk", label: "Risk Factor", weight: liveConfigState.weights.risk, value: h.sub_risk || 50, contribution: h.contrib_risk || 0 },
              ],
              gi: 0,
              gi_z: s100 > 75 ? 2.1 : 0,
              underserved: (h.sub_demand || 0) > 60 && (h.sub_competition || 0) > 60,
              underservedScore: h.sub_demand || 0,
              robustness: s100 > 70 ? "high" : s100 > 50 ? "medium" : "low",
              raw: h as any,
              subscores: {
                demand: Math.round(h.sub_demand || 50),
                accessibility: Math.round(h.sub_accessibility || 50),
                complementary: Math.round(h.sub_complementary || 50),
                competition: Math.round(h.sub_competition || 50),
                landuse: Math.round(h.sub_landuse || 50),
                risk: Math.round(h.sub_risk || 50),
              },
              footfall: (h.sub_demand || 50) / 100,
              population: (h.sub_demand || 50) / 100,
              accessibility: (h.sub_accessibility || 50) / 100,
              complementary: (h.sub_complementary || 50) / 100,
              competition: (h.sub_competition || 50) / 100,
              landuse: (h.sub_landuse || 50) / 100,
              rent: 0.5,
              floodRisk: (100 - (h.sub_risk || 50)) / 100,
            };
          });
          setBackendScored(mapped);
        }
      })
      .catch((err) => {
        console.warn("Backend score fetch fallback:", err);
        setBackendScored(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingScore(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeCity.id, liveConfigState, businessType]);

  const scored = useMemo(() => {
    if (backendScored && backendScored.length > 0) return backendScored;
    if (!cityData) return [];
    return scoreCity(cityData, {
      weights: liveConfigState.weights,
      decay:   { type: liveConfigState.decayType, d0_km: liveConfigState.decayD0Km },
      competition: {
        mode:       liveConfigState.competitionMode,
        radius_km:  liveConfigState.competitionRadiusKm,
        saturation: liveConfigState.competitionSaturation,
      },
      constraints: liveConfigState.constraints,
    });
  }, [backendScored, cityData, liveConfigState]);

  const top5 = useMemo(() => topSites(scored, 5), [scored]);

  const activeSelectedHex = useMemo(() => {
    if (selectedH3) return scored.find((h) => h.h3 === selectedH3) ?? top5[0] ?? null;
    return top5[0] ?? null;
  }, [selectedH3, scored, top5]);

  const handleBusinessTypeChange = (newId: string) => {
    setBusinessType(newId);
    const bumps = PRESET_WEIGHT_MAP[newId];
    if (bumps) {
      const updatedWeights = { ...liveConfigState.weights, ...bumps };
      setLiveConfigState((prev) => ({
        ...prev,
        weights: updatedWeights,
      }));
      setActiveConfig({
        ...activeConfig,
        weights: updatedWeights as any,
      } as any);
    }
  };

  const handleExportPDF = useCallback(async () => {
    try {
      const { downloadReport } = await import("@/lib/api");
      const currentBusiness = BUSINESS_PRESETS.find((p) => p.id === businessType)?.preset ?? "Healthcare";
      await downloadReport(
        activeCity.id,
        currentBusiness,
        { weights: liveConfigState.weights },
        undefined,
        activeSelectedHex?.h3,
      );
      setToastMessage("PDF dossier downloaded successfully!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      const currentBusiness = BUSINESS_PRESETS.find((p) => p.id === businessType)?.preset ?? "Healthcare";
      exportPDF(activeCity.name, currentBusiness, top5.slice(0, 3), { ...liveConfigState.weights } as Record<string, number>, top5[0]?.score ? Math.round(top5[0].score * 100) : 80);
    }
  }, [activeCity, businessType, liveConfigState, top5]);

  const handleExportCSV = useCallback(() => {
    exportCSV(scored, activeCity.name);
    setToastMessage("CSV export downloaded successfully!");
    setTimeout(() => setToastMessage(null), 3000);
  }, [scored, activeCity]);

  const handleApplyWeights = (newConfig: DrawerConfig) => {
    setActiveConfig({
      weights: newConfig.weights as any,
      decayD0: newConfig.decayD0Km * 1000,
      decay:   { type: newConfig.decayType, d0: newConfig.decayD0Km },
      competitionMode: newConfig.competitionMode,
      competition: { mode: newConfig.competitionMode, radius: newConfig.competitionRadiusKm, saturation: newConfig.competitionSaturation },
      constraints: newConfig.constraints,
      competitorCategories: [],
      complementaryCategories: [],
      landUseTable: { residential: 0.8, commercial: 1, mixed: 0.9, industrial: 0.3 },
      isochroneMode: "drive",
      isochroneMinutes: 15,
      scale: "medium",
    } as any);
    setLiveConfigState(newConfig);
    setToastMessage(`Weights updated — scoring recalculated for ${activeCity.name}.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const selectedResolved = useMemo(() => {
    if (!activeSelectedHex) return { name: "Central District", highlight: "Urban Catchment" };
    return resolveNeighborhood(activeCity.id, activeSelectedHex.center[1], activeSelectedHex.center[0]);
  }, [activeCity.id, activeSelectedHex]);

  const selectedCoordinates = activeSelectedHex
    ? `${activeSelectedHex.center[1].toFixed(5)}, ${activeSelectedHex.center[0].toFixed(5)}`
    : null;

  const currentScore = activeSelectedHex ? (activeSelectedHex.score100 || Math.round(activeSelectedHex.score * 100)) : 80;
  const scoreInfo    = getScoreLabel(currentScore);

  // Dynamic factor contributions for selected hex
  const factorContribs = useMemo(() => {
    if (activeSelectedHex && activeSelectedHex.parts && activeSelectedHex.parts.length > 0) {
      return activeSelectedHex.parts.map((p) => {
        const rawVal = p.contribution !== undefined ? p.contribution : (p.value - 50) * 0.3;
        const rounded = Math.round(rawVal);
        return {
          label: p.label || p.layer,
          val: Math.abs(rounded) || 1,
          positive: rounded >= 0,
        };
      });
    }
    return [
      { label: "Demand",           val: Math.round(liveConfigState.weights.demand * 0.4), positive: true  },
      { label: "Accessibility",    val: Math.round(liveConfigState.weights.accessibility * 0.35), positive: true  },
      { label: "Competition",      val: Math.round(liveConfigState.weights.competition * 0.25), positive: false },
      { label: "Land Suitability", val: Math.round(liveConfigState.weights.landuse * 0.3), positive: true  },
      { label: "Risk",             val: Math.round(liveConfigState.weights.risk * 0.2), positive: false },
    ];
  }, [activeSelectedHex, liveConfigState.weights]);

  const topPositives = factorContribs.filter((f) => f.positive).slice(0, 2);
  const currentBusinessName = BUSINESS_PRESETS.find((p) => p.id === businessType)?.preset || "Commercial";

  return (
    <div className="min-h-screen h-screen bg-[#F7FAFC] text-[#102A43] flex flex-col font-sans antialiased selection:bg-[#16C6B5] selection:text-white overflow-hidden">

      {/* ── TOP NAVBAR ── */}
      <header className="flex-shrink-0 sticky top-0 z-40 bg-white border-b border-slate-200/90 px-4 h-12 flex items-center justify-between shadow-xs">
        {/* Left: Brand + City + Nav */}
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 cursor-pointer flex-shrink-0">
            <img src="/sitescope-mark.svg" alt="" className="w-7 h-7 rounded-lg shadow-sm" />
            <span className="font-display font-bold text-sm text-[#063B45] leading-none">SiteScope</span>
          </button>

          {/* City Selector */}
          <div className="relative">
            <button
              onClick={() => setIsCityMenuOpen(!isCityMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <MapPin className="w-3 h-3 text-[#16C6B5]" />
              <span>{activeCity.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {isCityMenuOpen && (
              <div className="absolute left-0 mt-1 w-48 rounded-xl bg-white border border-slate-200 shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                {cities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCityId(c.id);
                      setCity(c);
                      setIsCityMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${c.id === selectedCityId ? "bg-[#e6faf8] text-[#063B45] font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    <span>{c.name}, {c.region}</span>
                    {c.id === selectedCityId && <CheckCircle2 className="w-3.5 h-3.5 text-[#16C6B5]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nav tabs */}
          <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold">
            {([
              { id: "dashboard", label: "Dashboard",      action: () => setActiveNavTab("dashboard") },
              { id: "analyze",   label: "Analyze & Weights", action: () => { setActiveNavTab("analyze"); setIsAdjustWeightsOpen(true); } },
              { id: "compare",   label: "Compare",        action: () => { setActiveNavTab("compare"); setIsCompareModalOpen(true); } },
              { id: "reports",   label: "Reports",        action: () => { setActiveNavTab("reports"); handleExportPDF(); } },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={t.action}
                className={`py-1 border-b-2 transition-all ${activeNavTab === t.id ? "text-[#075E68] border-[#16C6B5]" : "text-slate-400 border-transparent hover:text-slate-700"}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Search + Copilot + Avatar */}
        <div className="flex items-center gap-2.5">
          <div className="relative hidden md:block w-56">
            <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search location or address…"
              className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#16C6B5] transition-all"
            />
          </div>
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#087F8C] to-[#16C6B5] hover:from-[#075E68] hover:to-[#19B9A9] text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Copilot</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#a5f3ee] animate-pulse" />
          </button>
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full bg-[#063B45] text-white flex items-center justify-center font-bold text-[10px]">PO</div>
            <div className="hidden sm:block">
              <div className="text-[11px] font-bold text-slate-800 leading-none">Parth Oza</div>
              <div className="text-[9px] text-slate-400">Business User</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN 3-COLUMN LAYOUT ── */}
      <main className="flex-1 flex gap-0 overflow-hidden min-h-0">

        {/* ── LEFT PANEL ── */}
        <div className="flex-shrink-0 w-64 bg-white border-r border-slate-200/90 flex flex-col overflow-y-auto">
          {/* Business type selector */}
          <div className="px-3.5 pt-3.5 pb-3 border-b border-slate-100">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
              Business Type
            </label>
            <div className="relative">
              <select
                value={businessType}
                onChange={(e) => handleBusinessTypeChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 appearance-none pr-7 focus:outline-none focus:border-[#16C6B5]"
              >
                {BUSINESS_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Priority card */}
          <div className="p-3">
            <PriorityCard
              weights={liveConfigState.weights}
              constraints={liveConfigState.constraints}
              isCustomized={isCustomized}
              onAdjustWeights={() => setIsAdjustWeightsOpen(true)}
              onEditAnswers={onBack}
            />
          </div>
        </div>

        {/* ── CENTER MAP ── */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="flex-1 min-h-0 w-full relative">
            {isLoadingScore && (
              <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-semibold text-[#063B45]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#16C6B5]" />
                <span>Scoring {activeCity.name}…</span>
              </div>
            )}
            <HexMap
              scored={scored}
              center={activeCity.center}
              onHexClick={(h3) => selectHex(h3)}
              selectedH3={activeSelectedHex?.h3 ?? null}
              topSitesList={top5}
              competitors={cityData?.competitors || []}
              cityId={activeCity.id}
            />
          </div>

          {/* ── BOTTOM ACTION BAR ── */}
          <div className="flex-shrink-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-600">{activeCity.name}</span>
              <span>·</span>
              <span className="bg-[#e0f7f5] text-[#063B45] font-bold px-2 py-0.5 rounded-md font-mono">
                {scored.length} hexagons
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsCompareModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-medium transition-colors"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compare Sites</span>
              </button>
              <span className="w-px h-5 bg-slate-200 mx-0.5" />
              <button
                onClick={() => setIsCopilotOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#16C6B5] text-[#075E68] hover:bg-[#e6faf8] text-xs font-semibold transition-colors"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#063B45] hover:bg-[#075E68] text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT DECISION PANEL ── */}
        <div className="flex-shrink-0 w-72 bg-white border-l border-slate-200/90 flex flex-col overflow-y-auto">

          {/* Score Card */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-3.5 h-3.5 text-[#16C6B5]" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate" title={`${selectedResolved.name}, ${activeCity.name}`}>
                  {selectedResolved.name}, {activeCity.name}
                </div>
                <div className="text-[10px] text-slate-400">
                  {selectedCoordinates ? `Selected hex · ${selectedCoordinates}` : "Selected Location"}
                </div>
              </div>
              <button
                onClick={() => {
                  setToastMessage(`Saved ${selectedResolved.name} to shortlist.`);
                  setTimeout(() => setToastMessage(null), 3000);
                }}
                className="text-[11px] text-[#16C6B5] font-semibold hover:underline whitespace-nowrap"
              >
                Save
              </button>
            </div>

            {/* Score display */}
            <div className="flex items-center gap-4 mt-1 mb-1">
              <div className="flex items-baseline gap-1.5 flex-shrink-0">
                <span className="text-5xl font-extrabold text-[#063B45] leading-none font-display tabular-nums">
                  {currentScore}
                </span>
                <span className="text-sm text-slate-400 font-medium">/100</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold leading-tight mb-2" style={{ color: scoreInfo.color }}>
                  {scoreInfo.label}
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${currentScore}%`, backgroundColor: scoreInfo.color }}
                  />
                </div>
              </div>
            </div>

            {/* KEY FACTORS section */}
            <div className="mt-3">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Key Factors</div>
              <div className="space-y-1.5">
                {factorContribs.map((f) => (
                  <div key={f.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">{f.label}</span>
                    <span
                      className="font-bold tabular-nums w-8 text-right"
                      style={{ color: f.positive ? "#059669" : "#dc2626" }}
                    >
                      {f.positive ? "+" : "-"}{f.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Why this location — AI Insight */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-slate-800">Why this location?</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Strong {topPositives.map((p) => p.label.toLowerCase()).join(" and ")} density and favorable road connectivity make this
              location well-suited for your{" "}
              <strong className="text-slate-800">
                {currentBusinessName}
              </strong>{" "}
              deployment.
            </p>

            {!showDetailPanel && (
              <button
                onClick={() => setShowDetailPanel(true)}
                className="mt-2 flex items-center gap-1 text-[11px] text-[#16C6B5] font-semibold hover:underline"
              >
                View detailed analysis <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Detail panel */}
          {showDetailPanel && (
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-700">Reachable Population</span>
                <button
                  onClick={() => setShowDetailPanel(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {[
                  { time: "10 min", pop: activeCity.id === "ahmedabad" ? "4,20,000" : activeCity.id === "surat" ? "3,10,000" : "1,85,000" },
                  { time: "20 min", pop: activeCity.id === "ahmedabad" ? "9,80,000" : activeCity.id === "surat" ? "7,40,000" : "4,60,000" },
                  { time: "30 min", pop: activeCity.id === "ahmedabad" ? "18,50,000" : activeCity.id === "surat" ? "14,20,000" : "8,90,000" },
                ].map((d) => (
                  <div key={d.time} className="bg-white rounded-xl p-2 border border-slate-200">
                    <div className="text-[10px] text-slate-500">{d.time}</div>
                    <div className="text-xs font-bold text-slate-900 font-mono mt-0.5">{d.pop}</div>
                    <div className="text-[9px] text-slate-400">people</div>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <div className="text-[11px] font-bold text-slate-700 mb-1">Score Distribution</div>
                <div className="text-[10px] text-slate-500">
                  {scored.filter((h) => (h.score100 || Math.round(h.score * 100)) >= 75).length} high-potential hexes out of {scored.length}
                </div>
              </div>
            </div>
          )}

          {/* Top Recommended Locations */}
          <div className="px-4 py-3 flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#16C6B5]" />
                <span className="text-xs font-bold text-slate-800">Top Locations</span>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(true)}
                className="text-[11px] text-[#16C6B5] font-semibold hover:underline"
              >
                View all →
              </button>
            </div>

            <div className="space-y-1">
              {top5.slice(0, 3).map((h, i) => {
                const scoreVal   = h.score100 || Math.round(h.score * 100);
                const isSelected = activeSelectedHex?.h3 === h.h3;
                const loc        = resolveNeighborhood(activeCity.id, h.center[1], h.center[0], i + 1);
                return (
                  <button
                    key={h.h3}
                    onClick={() => selectHex(h.h3)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-[#e6faf8] border-[#b2eceb] shadow-xs"
                        : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <span className={`text-[11px] font-bold w-4 ${isSelected ? "text-[#075E68]" : "text-slate-400"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-[#16C6B5] flex-shrink-0" />
                        <span className="text-[11px] font-semibold text-slate-800 truncate">{loc.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{loc.highlight}</div>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${
                        scoreVal >= 80 ? "bg-[#e0f7f5] text-[#063B45]" : scoreVal >= 60 ? "bg-teal-50 text-teal-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {scoreVal}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </main>

      {/* ── TOAST ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="w-5 h-5 rounded-full bg-[#16C6B5] flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3" />
          </div>
          <span className="text-xs font-medium">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── AI COPILOT DRAWER ── */}
      {isCopilotOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#111622] text-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-4 bg-[#141a29] border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#087F8C] to-[#16C6B5] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">SiteScope AI Copilot</div>
                  <div className="text-[10px] text-[#16C6B5] font-mono">Voice & Text Active</div>
                </div>
              </div>
              <button onClick={() => setIsCopilotOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-3">
              <AiVoiceCopilot
                city={activeCity}
                config={liveConfigState as any}
                selectedHex={activeSelectedHex}
                top3={top5.slice(0, 3)}
                scored={scored}
                onSelectHex={selectHex}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── COMPARE MODAL ── */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-3xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-[#075E68]" />
                <h3 className="font-bold text-slate-900 text-base">Side-by-Side Location Comparison</h3>
              </div>
              <button onClick={() => setIsCompareModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4">
              <CompareTab
                candidates={top5.slice(0, 3)}
                onRemove={(h3) => console.log("remove", h3)}
                business={BUSINESS_PRESETS.find((p) => p.id === businessType)?.preset ?? "Healthcare"}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── ADJUST WEIGHTS DRAWER ── */}
      <AdjustWeightsDrawer
        isOpen={isAdjustWeightsOpen}
        initialConfig={currentActiveConfig}
        baseConfig={currentBaseConfig}
        onApply={handleApplyWeights}
        onLivePreview={(preview) => setLiveConfigState(preview)}
        onClose={() => setIsAdjustWeightsOpen(false)}
      />
    </div>
  );
}
