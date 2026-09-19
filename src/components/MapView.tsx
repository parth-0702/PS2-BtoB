import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  MapPin, Search, ChevronDown, CheckCircle2,
  SlidersHorizontal, Download,
  GitCompare, Edit3, Bot, Sparkles, X,
  TrendingUp, Activity, Check, ChevronRight,
  Users,
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
  { id: "ev",      label: "⚡ EV Charging Station", preset: "EV Charging" },
  { id: "cafe",    label: "☕ Cafe & Bakery",        preset: "Cafe" },
  { id: "retail",  label: "🛍️ Retail Store",         preset: "Retail" },
  { id: "clinic",  label: "🏥 Healthcare Clinic",    preset: "Healthcare" },
  { id: "kitchen", label: "📦 Cloud Kitchen",        preset: "Cloud Kitchen" },
  { id: "gym",     label: "💪 Fitness Center",       preset: "Fitness" },
];

const DEFAULT_FACTOR_WEIGHTS: FactorWeights = {
  demand: 30,
  accessibility: 25,
  complementary: 15,
  competition: 20,
  landuse: 15,
  risk: 10,
};

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Excellent Opportunity", color: "#059669" };
  if (score >= 70) return { label: "Strong Opportunity",    color: "#0f766e" };
  if (score >= 55) return { label: "Good Potential",        color: "#0891b2" };
  if (score >= 40) return { label: "Moderate Fit",          color: "#d97706" };
  return                   { label: "Low Suitability",      color: "#dc2626" };
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

  const [selectedCityId, setSelectedCityId]   = useState<string>(city?.id ?? "surat");
  const [isCityMenuOpen, setIsCityMenuOpen]   = useState(false);
  const [businessType, setBusinessType]       = useState(BUSINESS_PRESETS[0]!.id);
  const [activeNavTab, setActiveNavTab]       = useState<"dashboard" | "analyze" | "compare" | "reports">("dashboard");
  const [isAdjustWeightsOpen, setIsAdjustWeightsOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen]     = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [toastMessage, setToastMessage]       = useState<string | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const currentActiveConfig: DrawerConfig = useMemo(() => ({
    weights: {
      demand:        activeConfig?.weights?.['demand']        ?? DEFAULT_FACTOR_WEIGHTS.demand,
      accessibility: activeConfig?.weights?.['accessibility'] ?? DEFAULT_FACTOR_WEIGHTS.accessibility,
      complementary: activeConfig?.weights?.['complementary'] ?? DEFAULT_FACTOR_WEIGHTS.complementary,
      competition:   activeConfig?.weights?.['competition']   ?? DEFAULT_FACTOR_WEIGHTS.competition,
      landuse:       activeConfig?.weights?.['landuse']       ?? DEFAULT_FACTOR_WEIGHTS.landuse,
      risk:          activeConfig?.weights?.['risk']          ?? DEFAULT_FACTOR_WEIGHTS.risk,
    },
    decayType:              (activeConfig?.decay as any)?.type ?? "exponential",
    decayD0Km:              (activeConfig?.decay as any)?.d0_km ?? (activeConfig?.decayD0 ? activeConfig.decayD0 / 1000 : 1.2),
    competitionMode:        (activeConfig?.competition as any)?.mode ?? activeConfig?.competitionMode ?? "penalise",
    competitionRadiusKm:    (activeConfig?.competition as any)?.radius_km ?? 1.0,
    competitionSaturation:  (activeConfig?.competition as any)?.saturation ?? 5,
    constraints:            activeConfig?.constraints ?? ["no_flood"],
  }), [activeConfig]);

  const currentBaseConfig: DrawerConfig = useMemo(() => ({
    weights: {
      demand:        baseConfig?.weights?.['demand']        ?? DEFAULT_FACTOR_WEIGHTS.demand,
      accessibility: baseConfig?.weights?.['accessibility'] ?? DEFAULT_FACTOR_WEIGHTS.accessibility,
      complementary: baseConfig?.weights?.['complementary'] ?? DEFAULT_FACTOR_WEIGHTS.complementary,
      competition:   baseConfig?.weights?.['competition']   ?? DEFAULT_FACTOR_WEIGHTS.competition,
      landuse:       baseConfig?.weights?.['landuse']       ?? DEFAULT_FACTOR_WEIGHTS.landuse,
      risk:          baseConfig?.weights?.['risk']          ?? DEFAULT_FACTOR_WEIGHTS.risk,
    },
    decayType:             (baseConfig?.decay as any)?.type ?? "exponential",
    decayD0Km:             (baseConfig?.decay as any)?.d0_km ?? (baseConfig?.decayD0 ? baseConfig.decayD0 / 1000 : 1.2),
    competitionMode:       (baseConfig?.competition as any)?.mode ?? baseConfig?.competitionMode ?? "penalise",
    competitionRadiusKm:   (baseConfig?.competition as any)?.radius_km ?? 1.0,
    competitionSaturation: (baseConfig?.competition as any)?.saturation ?? 5,
    constraints:           baseConfig?.constraints ?? ["no_flood"],
  }), [baseConfig]);

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

  const scored = useMemo(() => {
    if (!cityData) return [];
    const compMode = liveConfigState.competitionMode === "cluster_bonus" ? "cluster" : "avoid";
    return scoreCity(cityData, {
      weights: liveConfigState.weights,
      decayD0: liveConfigState.decayD0Km * 1000,
      decay:   { type: liveConfigState.decayType, d0_km: liveConfigState.decayD0Km },
      competitionMode: compMode,
      competition: {
        mode:       compMode,
        radius_km:  liveConfigState.competitionRadiusKm,
        saturation: liveConfigState.competitionSaturation,
      },
      constraints: liveConfigState.constraints,
    } as any);
  }, [cityData, liveConfigState]);

  const top5 = useMemo(() => topSites(scored, 5), [scored]);

  const activeSelectedHex = useMemo(() => {
    if (selectedH3) return scored.find((h) => h.h3 === selectedH3) ?? top5[0] ?? null;
    return top5[0] ?? null;
  }, [selectedH3, scored, top5]);

  const getSubareaName = (index: number) => {
    const names = ["Vesu", "Adajan", "Pal", "Udhna", "Dumas", "Katargam", "Varachha", "Piplod"];
    return names[index % names.length]!;
  };

  const getKeyAdvantage = (index: number) => {
    const adv = [
      "High population, good access",
      "Growing commercial area",
      "Underserved opportunity",
      "Good road connectivity",
      "Tourism + commercial mix",
    ];
    return adv[index % adv.length]!;
  };

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
    setToastMessage(`Weights updated — top recommendations refreshed.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleExportCSV = () => exportCSV(scored, activeCity.name);
  const handleExportPDF = () =>
    exportPDF(
      activeCity.name,
      BUSINESS_PRESETS.find((p) => p.id === businessType)?.preset ?? "EV Charging",
      top5.slice(0, 3),
      liveConfigState.weights as unknown as Record<string, number>,
      activeSelectedHex ? (activeSelectedHex.score100 || Math.round(activeSelectedHex.score * 100)) : 94,
    );

  const selectedLocIndex = Math.max(0, top5.findIndex((h) => h.h3 === activeSelectedHex?.h3));
  const selectedLocName  = getSubareaName(selectedLocIndex);
  const currentScore     = activeSelectedHex ? (activeSelectedHex.score100 || Math.round(activeSelectedHex.score * 100)) : 94;
  const scoreInfo        = getScoreLabel(currentScore);

  // Factor contributions — scale weight to a readable contribution number (min 1)
  const factorContribs = [
    { label: "Demand",           val: liveConfigState.weights.demand,        positive: true  },
    { label: "Accessibility",    val: liveConfigState.weights.accessibility,  positive: true  },
    { label: "Competition",      val: liveConfigState.weights.competition,    positive: false },
    { label: "Land Suitability", val: liveConfigState.weights.landuse,        positive: true  },
    { label: "Risk",             val: liveConfigState.weights.risk,           positive: false },
  ];
  const maxWeight = Math.max(...factorContribs.map(f => f.val), 1);

  return (
    <div className="min-h-screen h-screen bg-[#F7FAFC] text-[#102A43] flex flex-col font-sans antialiased selection:bg-[#16C6B5] selection:text-white overflow-hidden">

      {/* ── TOP NAVBAR ── */}
      <header className="flex-shrink-0 sticky top-0 z-40 bg-white border-b border-slate-200/90 px-4 h-12 flex items-center justify-between shadow-xs">
        {/* Left: Brand + City + Nav */}
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 cursor-pointer flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#087F8C] to-[#063B45] flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
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
                    onClick={() => { setSelectedCityId(c.id); setCity(c); setIsCityMenuOpen(false); }}
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
                onChange={(e) => setBusinessType(e.target.value)}
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
          <div className="flex-1 min-h-0 w-full">
            <HexMap
              scored={scored}
              center={activeCity.center}
              onHexClick={(h3) => selectHex(h3)}
              selectedH3={activeSelectedHex?.h3 ?? null}
              topSitesList={top5}
              competitors={cityData?.competitors || []}
            />
          </div>

          {/* ── BOTTOM ACTION BAR ── */}
          <div className="flex-shrink-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-600">{activeCity.name}</span>
              <span>·</span>
              <span>{scored.length} hexagons</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Ghost secondary actions */}
              <button
                onClick={() => alert("Polygon tool: click on the map to define custom zone bounds.")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-medium transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Draw Zone</span>
              </button>
              <button
                onClick={() => setIsCompareModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-medium transition-colors"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compare Sites</span>
              </button>
              {/* Divider */}
              <span className="w-px h-5 bg-slate-200 mx-0.5" />
              {/* Secondary CTA — Talk to AI */}
              <button
                onClick={() => setIsCopilotOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#16C6B5] text-[#075E68] hover:bg-[#e6faf8] text-xs font-semibold transition-colors"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
              {/* Primary CTA — Export */}
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

          {/* Score Card — Primary Focus */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-3.5 h-3.5 text-[#16C6B5]" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">{selectedLocName}, {activeCity.name}</div>
                <div className="text-[10px] text-slate-400">Selected Location</div>
              </div>
              <button
                onClick={() => alert(`Saved hex to shortlist.`)}
                className="text-[11px] text-[#16C6B5] font-semibold hover:underline whitespace-nowrap"
              >
                Save
              </button>
            </div>

            {/* Score display — flat, no inner box */}
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
                {factorContribs.map((f) => {
                  const displayVal = Math.max(1, Math.round((f.val / maxWeight) * 32));
                  return (
                    <div key={f.label} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">{f.label}</span>
                      <span
                        className="font-bold tabular-nums w-8 text-right"
                        style={{ color: f.positive ? "#059669" : "#dc2626" }}
                      >
                        {f.positive ? "+" : "-"}{displayVal}
                      </span>
                    </div>
                  );
                })}
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
              Strong residential demand, good road connectivity and low competitor density make this
              location well-suited for your{" "}
              <strong className="text-slate-800">
                {BUSINESS_PRESETS.find((p) => p.id === businessType)?.preset}
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

          {/* Detail panel — hidden by default */}
          {showDetailPanel && (
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
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
                  { time: "10 min", pop: "2,48,000" },
                  { time: "20 min", pop: "6,12,000" },
                  { time: "30 min", pop: "12,40,000" },
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
                  {scored.filter(h => (h.score100 || Math.round(h.score * 100)) >= 80).length} high-potential hexes out of {scored.length}
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
                const scoreVal  = h.score100 || Math.round(h.score * 100);
                const isSelected = activeSelectedHex?.h3 === h.h3;
                const locName   = getSubareaName(i);
                return (
                  <button
                    key={h.h3}
                    onClick={() => selectHex(h.h3)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-[#e6faf8] border-[#b2eceb]"
                        : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <span className={`text-[11px] font-bold w-4 ${isSelected ? "text-[#075E68]" : "text-slate-400"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-[#16C6B5] flex-shrink-0" />
                        <span className="text-[11px] font-semibold text-slate-800 truncate">{locName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{getKeyAdvantage(i)}</div>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${
                        scoreVal >= 80 ? "bg-[#e0f7f5] text-[#063B45]" : "bg-amber-100 text-amber-800"
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
                business={BUSINESS_PRESETS.find((p) => p.id === businessType)?.preset ?? "EV Charging"}
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
