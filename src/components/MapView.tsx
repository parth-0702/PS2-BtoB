import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  MapPin, Search, ChevronDown, Bell, HelpCircle, CheckCircle2,
  SlidersHorizontal, RotateCcw, ArrowRight, Download, FileText,
  GitCompare, Edit3, Bot, Sparkles, X, ArrowLeft, RefreshCw,
  Users, Route, Store, Layers as LayersIcon, ShieldAlert, Compass,
  TrendingUp, Activity, Check, CheckCheck
} from "lucide-react";
import { listCities, buildCityData } from "@/lib/sitescope/mock-data";
import { scoreCity, topSites, type ScoredHex } from "@/lib/sitescope/scoring";
import { useSiteScope, type FactorWeights } from "@/lib/sitescope/store";
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
  { id: "ev", label: "⚡ EV Charging Station", preset: "EV Charging" },
  { id: "cafe", label: "☕ Cafe & Bakery", preset: "Cafe" },
  { id: "retail", label: "🛍️ Retail Store", preset: "Retail" },
  { id: "clinic", label: "🏥 Healthcare Clinic", preset: "Healthcare" },
  { id: "kitchen", label: "📦 Cloud Kitchen", preset: "Cloud Kitchen" },
  { id: "gym", label: "💪 Fitness Center", preset: "Fitness" },
];

const DEFAULT_FACTOR_WEIGHTS: FactorWeights = {
  demand: 30,
  accessibility: 25,
  complementary: 15,
  competition: 20,
  landuse: 15,
  risk: 10,
};

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

  // Active City & Business Type
  const [selectedCityId, setSelectedCityId] = useState<string>(city?.id ?? "surat");
  const [isCityMenuOpen, setIsCityMenuOpen] = useState(false);
  const [businessType, setBusinessType] = useState(BUSINESS_PRESETS[0]!.id);
  const [activeNavTab, setActiveNavTab] = useState<"dashboard" | "analyze" | "compare" | "reports">("dashboard");

  // Drawers & Modals
  const [isAdjustWeightsOpen, setIsAdjustWeightsOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Config from Store
  const currentActiveConfig: DrawerConfig = useMemo(() => {
    return {
      weights: {
        demand: activeConfig?.weights?.['demand'] ?? DEFAULT_FACTOR_WEIGHTS.demand,
        accessibility: activeConfig?.weights?.['accessibility'] ?? DEFAULT_FACTOR_WEIGHTS.accessibility,
        complementary: activeConfig?.weights?.['complementary'] ?? DEFAULT_FACTOR_WEIGHTS.complementary,
        competition: activeConfig?.weights?.['competition'] ?? DEFAULT_FACTOR_WEIGHTS.competition,
        landuse: activeConfig?.weights?.['landuse'] ?? DEFAULT_FACTOR_WEIGHTS.landuse,
        risk: activeConfig?.weights?.['risk'] ?? DEFAULT_FACTOR_WEIGHTS.risk,
      },
      decayType: (activeConfig?.decay as any)?.type ?? "exponential",
      decayD0Km: (activeConfig?.decay as any)?.d0_km ?? (activeConfig?.decayD0 ? activeConfig.decayD0 / 1000 : 1.2),
      competitionMode: (activeConfig?.competition as any)?.mode ?? activeConfig?.competitionMode ?? "penalise",
      competitionRadiusKm: (activeConfig?.competition as any)?.radius_km ?? 1.0,
      competitionSaturation: (activeConfig?.competition as any)?.saturation ?? 5,
      constraints: activeConfig?.constraints ?? ["no_flood"],
    };
  }, [activeConfig]);

  const currentBaseConfig: DrawerConfig = useMemo(() => {
    return {
      weights: {
        demand: baseConfig?.weights?.['demand'] ?? DEFAULT_FACTOR_WEIGHTS.demand,
        accessibility: baseConfig?.weights?.['accessibility'] ?? DEFAULT_FACTOR_WEIGHTS.accessibility,
        complementary: baseConfig?.weights?.['complementary'] ?? DEFAULT_FACTOR_WEIGHTS.complementary,
        competition: baseConfig?.weights?.['competition'] ?? DEFAULT_FACTOR_WEIGHTS.competition,
        landuse: baseConfig?.weights?.['landuse'] ?? DEFAULT_FACTOR_WEIGHTS.landuse,
        risk: baseConfig?.weights?.['risk'] ?? DEFAULT_FACTOR_WEIGHTS.risk,
      },
      decayType: (baseConfig?.decay as any)?.type ?? "exponential",
      decayD0Km: (baseConfig?.decay as any)?.d0_km ?? (baseConfig?.decayD0 ? baseConfig.decayD0 / 1000 : 1.2),
      competitionMode: (baseConfig?.competition as any)?.mode ?? baseConfig?.competitionMode ?? "penalise",
      competitionRadiusKm: (baseConfig?.competition as any)?.radius_km ?? 1.0,
      competitionSaturation: (baseConfig?.competition as any)?.saturation ?? 5,
      constraints: baseConfig?.constraints ?? ["no_flood"],
    };
  }, [baseConfig]);

  // Live preview config during weight adjustment
  const [liveConfigState, setLiveConfigState] = useState<DrawerConfig>(currentActiveConfig);

  useEffect(() => {
    setLiveConfigState(currentActiveConfig);
  }, [currentActiveConfig]);

  // Check if activeConfig is customized vs baseConfig
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

  const cityData = useMemo(() => {
    return buildCityData(activeCity.id);
  }, [activeCity.id]);

  // Score City with liveConfigState
  const scored = useMemo(() => {
    if (!cityData) return [];
    return scoreCity(cityData, {
      weights: liveConfigState.weights,
      decay: { type: liveConfigState.decayType, d0_km: liveConfigState.decayD0Km },
      competition: {
        mode: liveConfigState.competitionMode,
        radius_km: liveConfigState.competitionRadiusKm,
        saturation: liveConfigState.competitionSaturation,
      },
      constraints: liveConfigState.constraints,
    });
  }, [cityData, liveConfigState]);

  // Top 5 Recommendations
  const top5 = useMemo(() => topSites(scored, 5), [scored]);

  // Selected Hexagon: default to top 1 if none clicked
  const activeSelectedHex = useMemo(() => {
    if (selectedH3) {
      return scored.find((h) => h.h3 === selectedH3) ?? top5[0] ?? null;
    }
    return top5[0] ?? null;
  }, [selectedH3, scored, top5]);

  // Score distribution counts for bar chart
  const scoreDistribution = useMemo(() => {
    let b0_20 = 0, b20_40 = 0, b40_60 = 0, b60_80 = 0, b80_100 = 0;
    scored.forEach((h) => {
      const s = h.score100 || Math.round(h.score * 100);
      if (s < 20) b0_20++;
      else if (s < 40) b20_40++;
      else if (s < 60) b40_60++;
      else if (s < 80) b60_80++;
      else b80_100++;
    });
    return [
      { range: "0-20", count: b0_20, color: "#3b82f6" },
      { range: "20-40", count: b20_40, color: "#10b981" },
      { range: "40-60", count: b40_60, color: "#facc15" },
      { range: "60-80", count: b60_80, color: "#f97316" },
      { range: "80-100", count: b80_100, color: "#ef4444" },
    ];
  }, [scored]);

  const getSubareaName = (index: number) => {
    const names = ["Vesu", "Adajan", "Pal", "Udhna", "Dumas", "Katargam", "Varachha", "Piplod"];
    return names[index % names.length]!;
  };

  const getKeyAdvantage = (index: number) => {
    const adv = [
      "High population, good access",
      "Growing commercial area",
      "Underserved opportunity area",
      "Good road connectivity",
      "Tourist + commercial potential",
    ];
    return adv[index % adv.length]!;
  };

  // Handle Apply Weights
  const handleApplyWeights = (newConfig: DrawerConfig) => {
    const oldTop3 = top5.slice(0, 3).map((h, i) => `${getSubareaName(i)} (${h.score100 || Math.round(h.score * 100)})`);

    setActiveConfig({
      weights: newConfig.weights as any,
      decayD0: newConfig.decayD0Km * 1000,
      decay: { type: newConfig.decayType, d0: newConfig.decayD0Km },
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

    // Show Toast summary of how top 3 changed
    const toastText = `Weights updated! Top recommendations refreshed: #1 ${getSubareaName(0)}, #2 ${getSubareaName(1)}, #3 ${getSubareaName(2)}.`;
    setToastMessage(toastText);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleExportCSV = () => exportCSV(scored, activeCity.name);
  const handleExportPDF = () =>
    exportPDF(
      activeCity.name,
      BUSINESS_PRESETS.find((p) => p.id === businessType)?.preset ?? "EV Charging",
      top5.slice(0, 3),
      liveConfigState.weights as unknown as Record<string, number>,
      activeSelectedHex?.score100 || 87
    );

  return (
    <div className="min-h-screen bg-[#F7FAFC] text-[#102A43] flex flex-col font-sans antialiased selection:bg-[#16C6B5] selection:text-white">
      {/* ── 1. Top Header Navbar ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 px-5 py-2.5 flex items-center justify-between shadow-xs">
        {/* Left: Brand Logo + City Dropdown */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={onBack}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#087F8C] to-[#063B45] flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <div>
              <div className="font-display font-bold text-base text-[#063B45] leading-none">
                SiteScope
              </div>
              <div className="text-[9px] text-slate-400 font-medium tracking-tight">
                Location Intelligence. Real Opportunities.
              </div>
            </div>
          </div>

          {/* City Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsCityMenuOpen(!isCityMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-[#16C6B5]" />
              <span>{activeCity.name}, {activeCity.region}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isCityMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-52 rounded-xl bg-white border border-slate-200 shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                {cities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCityId(c.id);
                      setCity(c);
                      setIsCityMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${
                      c.id === selectedCityId ? "bg-[#e6faf8] text-[#063B45] font-bold" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>{c.name}, {c.region}</span>
                    {c.id === selectedCityId && <CheckCircle2 className="w-3.5 h-3.5 text-[#16C6B5]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-6 ml-2 text-xs font-semibold">
            <button
              onClick={() => setActiveNavTab("dashboard")}
              className={`py-1 border-b-2 transition-all ${
                activeNavTab === "dashboard"
                  ? "text-[#075E68] border-[#16C6B5]"
                  : "text-slate-500 border-transparent hover:text-[#075E68]"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => {
                setActiveNavTab("analyze");
                setIsAdjustWeightsOpen(true);
              }}
              className={`py-1 border-b-2 transition-all ${
                activeNavTab === "analyze"
                  ? "text-[#075E68] border-[#16C6B5]"
                  : "text-slate-500 border-transparent hover:text-[#075E68]"
              }`}
            >
              Analyze & Weights
            </button>
            <button
              onClick={() => {
                setActiveNavTab("compare");
                setIsCompareModalOpen(true);
              }}
              className={`py-1 border-b-2 transition-all ${
                activeNavTab === "compare"
                  ? "text-[#075E68] border-[#16C6B5]"
                  : "text-slate-500 border-transparent hover:text-[#075E68]"
              }`}
            >
              Compare
            </button>
            <button
              onClick={() => {
                setActiveNavTab("reports");
                handleExportPDF();
              }}
              className={`py-1 border-b-2 transition-all ${
                activeNavTab === "reports"
                  ? "text-[#075E68] border-[#16C6B5]"
                  : "text-slate-500 border-transparent hover:text-[#075E68]"
              }`}
            >
              Reports
            </button>
          </nav>
        </div>

        {/* Center/Right: Search + AI Copilot Button + User Profile */}
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative hidden md:block w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search for a location, address or place..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#16C6B5] focus:bg-white transition-all"
            />
          </div>

          {/* AI Voice & Text Copilot Launch Pill */}
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#087F8C] to-[#16C6B5] hover:from-[#075E68] hover:to-[#19B9A9] text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI Copilot (Voice & Text)</span>
            <span className="w-2 h-2 rounded-full bg-[#a5f3ee] animate-pulse" />
          </button>

          {/* User Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full bg-[#063B45] text-white flex items-center justify-center font-bold text-xs">
              PO
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-none">Parth Oza</div>
              <div className="text-[10px] text-slate-500">Business User</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Main 3-Column Dashboard Body ── */}
      <main className="flex-1 p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1680px] mx-auto w-full">
        {/* ── LEFT PANEL: Your Analysis + Compact PriorityCard (Col 1-3) ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Your Analysis Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-lg bg-[#e0f7f5] flex items-center justify-center text-[#075E68]">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                Your Analysis
              </span>
            </div>

            <label className="text-[11px] font-semibold text-slate-600 mb-1.5 block">
              Business Type
            </label>
            <div className="relative">
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 appearance-none pr-8 focus:outline-none focus:border-[#16C6B5]"
              >
                {BUSINESS_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Compact PriorityCard (Requirement 1) */}
          <PriorityCard
            weights={liveConfigState.weights}
            constraints={liveConfigState.constraints}
            isCustomized={isCustomized}
            onAdjustWeights={() => setIsAdjustWeightsOpen(true)}
            onEditAnswers={onBack}
          />
        </div>

        {/* ── CENTER MAIN COLUMN: Map + Bottom Analytics (Col 4-8) ── */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Map Card with Layers Button inside */}
          <div className="h-[460px] w-full rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs bg-white">
            <HexMap
              scored={scored}
              center={activeCity.center}
              onHexClick={(h3) => selectHex(h3)}
              selectedH3={activeSelectedHex?.h3 ?? null}
              topSitesList={top5}
              competitors={cityData?.competitors || []}
            />
          </div>

          {/* Bottom Analytics Row: Top 5 Table + Score Distribution Bar Chart */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Top 5 Recommended Locations Table (Col 1-7) */}
            <div className="md:col-span-7 bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#16C6B5]" />
                  <span className="text-xs font-bold text-slate-800">
                    Top 5 Recommended Locations
                  </span>
                </div>
                <button
                  onClick={() => setIsCompareModalOpen(true)}
                  className="text-[11px] text-[#16C6B5] hover:underline font-semibold"
                >
                  View All →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-400 font-mono">
                      <th className="pb-1.5 font-semibold">#</th>
                      <th className="pb-1.5 font-semibold">Location</th>
                      <th className="pb-1.5 font-semibold">Score</th>
                      <th className="pb-1.5 font-semibold">Key Advantage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {top5.map((h, i) => {
                      const scoreVal = h.score100 || Math.round(h.score * 100);
                      const isSelected = activeSelectedHex?.h3 === h.h3;
                      const locName = getSubareaName(i);
                      return (
                        <tr
                          key={h.h3}
                          onClick={() => selectHex(h.h3)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-[#e6faf8]/70" : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="py-2 text-slate-500 font-bold">{i + 1}</td>
                          <td className="py-2 font-semibold text-slate-800 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#16C6B5]" />
                            <span>{locName}</span>
                          </td>
                          <td className="py-2">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                scoreVal >= 80
                                  ? "bg-[#e0f7f5] text-[#063B45]"
                                  : scoreVal >= 70
                                    ? "bg-[#e0f7f5] text-[#075E68]"
                                    : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {scoreVal}
                            </span>
                          </td>
                          <td className="py-2 text-slate-500 text-[11px] truncate max-w-[130px]">
                            {getKeyAdvantage(i)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Score Distribution Bar Chart (Col 8-12) */}
            <div className="md:col-span-5 bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-xs font-bold text-slate-800">Score Distribution</span>
              </div>

              <div className="flex items-end justify-between h-28 pt-2 pb-1 px-2 gap-2 border-b border-slate-100">
                {scoreDistribution.map((item) => {
                  const maxCount = Math.max(...scoreDistribution.map((d) => d.count), 1);
                  const heightPct = Math.max(12, Math.round((item.count / maxCount) * 100));
                  return (
                    <div key={item.range} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[9px] font-mono text-slate-400 font-bold">{item.count}</span>
                      <div
                        className="w-full rounded-t-md transition-all duration-300"
                        style={{ height: `${heightPct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1">
                {scoreDistribution.map((item) => (
                  <span key={item.range} className="flex-1 text-center">
                    {item.range}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 text-center mt-1 font-medium">
                Site Readiness Score Range
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Selected Location & Insights (Col 9-12) ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Selected Location Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-1 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#16C6B5]" />
                <span className="text-xs font-bold text-slate-800">Selected Location</span>
              </div>
              <button
                onClick={() => {
                  alert(`Saved Hex #${activeSelectedHex?.h3?.substring(0, 8)} to your site shortlist!`);
                }}
                className="flex items-center gap-1 text-[11px] text-[#16C6B5] hover:underline font-semibold"
              >
                💾 Save Site
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-[#063B45] via-[#087F8C] to-[#16C6B5] flex items-center justify-center text-white font-bold text-xs shadow-inner flex-shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900 leading-tight">
                  {getSubareaName(0)}, {activeCity.name}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Lat {activeCity.center[1].toFixed(4)}° N, Long {activeCity.center[0].toFixed(4)}° E
                </div>
                <div className="text-[10px] text-[#075E68] font-semibold mt-0.5">
                  Zone: Mixed Commercial · Ward: 15
                </div>
              </div>
            </div>
          </div>

          {/* Site Readiness Score Circular Gauge Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
            <div className="text-xs font-bold text-slate-800 mb-3">Site Readiness Score</div>

            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full bg-[#e0f7f5] border-4 border-[#16C6B5] flex flex-col items-center justify-center shadow-xs flex-shrink-0">
                <span className="text-2xl font-extrabold text-[#063B45] leading-none">
                  {activeSelectedHex?.score100 || 87}
                </span>
                <span className="text-[9px] text-slate-400 font-mono">/ 100</span>
              </div>

              <div className="flex-1 space-y-1 text-xs">
                <div className="text-[11px] font-bold text-[#0B8F76] mb-1">
                  Excellent Opportunity
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-600">
                  <span>Demand</span>
                  <span className="font-bold text-[#16C6B5]">+32</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-600">
                  <span>Accessibility</span>
                  <span className="font-bold text-[#16C6B5]">+24</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-600">
                  <span>Competition</span>
                  <span className="font-bold text-rose-500">-8</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-600">
                  <span>Land Suitability</span>
                  <span className="font-bold text-[#16C6B5]">+18</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-600">
                  <span>Risk</span>
                  <span className="font-bold text-rose-500">-3</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insight Card */}
          <div className="bg-[#eefbfa] rounded-2xl p-4 border border-[#b2eceb]/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[#063B45] font-bold text-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>AI Strategic Insight</span>
              </div>
              <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-[#b2eceb]/70 text-[#063B45] uppercase">
                Beta
              </span>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              This location scores highly due to dense residential demand, excellent arterial road
              connectivity and low competitor saturation within 3 km. Well-suited for your{" "}
              <strong>{BUSINESS_PRESETS.find((p) => p.id === businessType)?.preset}</strong> deployment.
            </p>
          </div>

          {/* Reachable Population (Drive-time) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
            <div className="text-xs font-bold text-slate-800 mb-2.5">
              Reachable Population (Drive-time)
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                <div className="text-[10px] text-slate-500 font-medium">10 min</div>
                <div className="text-xs font-bold text-slate-900 font-mono mt-0.5">2,48,000</div>
                <div className="text-[9px] text-slate-400">people</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                <div className="text-[10px] text-slate-500 font-medium">20 min</div>
                <div className="text-xs font-bold text-slate-900 font-mono mt-0.5">6,12,000</div>
                <div className="text-[9px] text-slate-400">people</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                <div className="text-[10px] text-slate-500 font-medium">30 min</div>
                <div className="text-xs font-bold text-slate-900 font-mono mt-0.5">12,40,000</div>
                <div className="text-[9px] text-slate-400">people</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── 3. Bottom Action Bar ── */}
      <footer className="sticky bottom-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Active City: <strong>{activeCity.name}</strong></span>
          <span>·</span>
          <span>Hexagons: <strong>{scored.length}</strong></span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => alert("Polygon tool activated. Click on the map to define custom zone bounds.")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Draw Polygon</span>
          </button>

          <button
            onClick={() => setIsCompareModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Sites</span>
          </button>

          <button
            onClick={() => setIsCopilotOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#087F8C] to-[#16C6B5] hover:from-[#075E68] hover:to-[#19B9A9] text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Talk to AI Copilot</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#063B45] hover:bg-[#075E68] text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </footer>

      {/* ── 4. Adjust Weights Drawer (Requirement 2 & 3) ── */}
      <AdjustWeightsDrawer
        isOpen={isAdjustWeightsOpen}
        initialConfig={currentActiveConfig}
        baseConfig={currentBaseConfig}
        onApply={handleApplyWeights}
        onLivePreview={(preview) => setLiveConfigState(preview)}
        onClose={() => setIsAdjustWeightsOpen(false)}
      />

      {/* ── 5. Toast Notification (Requirement 4) ── */}
      {toastMessage && (
        <div className="fixed bottom-14 right-6 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="w-6 h-6 rounded-full bg-[#16C6B5] text-white flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 6. Voice & Text AI Copilot Sliding Drawer ── */}
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
                  <div className="text-[10px] text-[#16C6B5] font-mono">
                    Voice (Speech) & Text Active
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsCopilotOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
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

      {/* ── 7. Compare Sites Modal ── */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-3xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-[#075E68]" />
                <h3 className="font-bold text-slate-900 text-base">
                  Side-by-Side Location Comparison
                </h3>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4">
              <CompareTab
                candidates={top5.slice(0, 3)}
                onRemove={(h3) => console.log("remove", h3)}
                business={BUSINESS_PRESETS.find((p) => p.id === businessType)?.preset ?? "EV Charging"}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
