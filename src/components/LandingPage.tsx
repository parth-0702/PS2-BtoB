import { useState } from "react";
import {
  MapPin, ArrowRight, Play, Check, ChevronDown, CheckCircle2,
  Users, Route, Store, Layers, ShieldAlert, Globe, Compass,
  Building2, ShoppingCart, Zap, Stethoscope, GraduationCap, Truck,
  Sparkles, X
} from "lucide-react";
import { listCities } from "@/lib/sitescope/mock-data";
import { useSiteScope } from "@/lib/sitescope/store";
import type { City } from "@/lib/sitescope/types";

interface LandingPageProps {
  onStart: (selectedCity: City) => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  const cities = listCities();
  const { city, setCity } = useSiteScope();
  const [selectedCityId, setSelectedCityId] = useState<string>(city?.id ?? cities[0]?.id ?? "surat");
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Live Layers toggle state in Hero
  const [liveLayers, setLiveLayers] = useState({
    population: true,
    roads: true,
    competitors: true,
    landuse: true,
    flood: false,
    transit: true,
  });

  const activeCity = cities.find((c) => c.id === selectedCityId) ?? cities[0]!;

  function handleSelectCity(id: string) {
    setSelectedCityId(id);
    const found = cities.find((c) => c.id === id);
    if (found) setCity(found);
    setIsCityDropdownOpen(false);
  }

  function handleLaunch() {
    setCity(activeCity);
    onStart(activeCity);
  }

  const toggleLayer = (key: keyof typeof liveLayers) => {
    setLiveLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* ── 1. Top Navbar ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 lg:px-12 py-3.5 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#059669] to-[#0f766e] flex items-center justify-center shadow-md shadow-emerald-700/15">
            {/* Hexagon icon */}
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div>
            <div className="font-display font-bold text-lg text-[#0f172a] tracking-tight leading-none">
              SiteScope
            </div>
            <div className="text-[10px] font-medium text-slate-500 tracking-tight mt-0.5">
              Location Intelligence. Real Opportunities.
            </div>
          </div>
        </div>


        {/* Right Side: City Picker + Start Analysis (No signin system) */}
        <div className="flex items-center gap-3">
          {/* City Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
            >
              <MapPin className="w-3.5 h-3.5 text-[#059669]" />
              <span>{activeCity.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isCityDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Select Metro City
                </div>
                {cities.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCity(c.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      c.id === selectedCityId
                        ? "bg-[#ecfdf5] text-[#065f46] font-bold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{c.hexCount} Analytical Hexes</div>
                    </div>
                    {c.id === selectedCityId && <CheckCircle2 className="w-4 h-4 text-[#059669]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Start Analysis CTA Button */}
          <button
            onClick={handleLaunch}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white text-xs font-semibold shadow-md shadow-emerald-900/15 hover:shadow-lg transition-all"
          >
            <span>Start Analysis</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── 2. Hero Section ── */}
      <section id="home" className="relative pt-12 pb-16 px-6 lg:px-12 overflow-hidden">
        {/* Soft subtle radial backdrop */}
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(45% 45% at 20% 25%, rgba(16, 185, 129, 0.08) 0%, transparent 70%), radial-gradient(55% 55% at 85% 35%, rgba(6, 78, 59, 0.12) 0%, transparent 80%)",
          }}
        />

        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Headlines & Stats */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#0f766e]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
              Geospatial Intelligence for a Smarter Tomorrow
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-bold leading-[1.12] tracking-tight text-[#0f172a]">
              Better Locations <br />
              <span className="font-serif italic font-normal text-[#065f46]">
                Build Brighter Futures
              </span>
            </h1>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
              SiteScope helps businesses, investors and organizations make smarter location decisions
              using the power of geospatial data, advanced analytics and AI-driven insights.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleLaunch}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white font-semibold text-sm shadow-md shadow-emerald-950/20 hover:shadow-lg transition-all"
              >
                <span>Start Site Analysis</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowDemoModal(true)}
                className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-200/90 shadow-sm transition-all"
              >
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 text-slate-700 fill-slate-700 ml-0.5" />
                </div>
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4 pt-6 border-t border-slate-200/80 max-w-xl">
              <div>
                <div className="text-2xl font-bold font-display text-[#0f172a]">3+</div>
                <div className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                  Pre-processed Cities
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-display text-[#0f172a]">5+</div>
                <div className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                  Geospatial Data Layers
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-display text-[#0f172a]">1000s</div>
                <div className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                  Locations Analyzed
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-display text-[#065f46]">Smarter</div>
                <div className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                  Data-driven Decisions
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive 3D Spatial Globe / Heatmap Card */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            {/* Outer stylized globe container */}
            <div className="relative w-full aspect-[16/11] max-w-[620px] rounded-3xl bg-gradient-to-br from-[#0c1626] via-[#091522] to-[#040e1a] p-4 shadow-2xl border border-slate-700/50 overflow-hidden flex flex-col justify-between">
              {/* Globe background mesh texture */}
              <div
                className="absolute inset-0 opacity-40 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 60% 40%, rgba(16, 185, 129, 0.25) 0%, transparent 60%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
                  backgroundSize: "100% 100%, 28px 28px, 28px 28px",
                }}
              />

              {/* Realistic Map Canvas / Hexagon Map Visualisation over India Region */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg className="w-[88%] h-[88%] opacity-85" viewBox="0 0 500 400" fill="none">
                  {/* Subtle earth contours */}
                  <ellipse cx="250" cy="200" rx="210" ry="170" stroke="rgba(56, 189, 248, 0.15)" strokeWidth="1.5" strokeDasharray="4 4" />
                  <ellipse cx="250" cy="200" rx="170" ry="140" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="1" />

                  {/* India land polygon approximation */}
                  <path
                    d="M170,120 Q220,100 280,110 Q320,130 310,180 Q290,240 260,300 Q240,320 230,290 Q210,230 180,200 Q160,160 170,120 Z"
                    fill="rgba(15, 23, 42, 0.7)"
                    stroke="rgba(16, 185, 129, 0.4)"
                    strokeWidth="1.5"
                  />

                  {/* Hexagon grid mesh over Gujarat / India */}
                  {[
                    { cx: 200, cy: 170, color: "#10b981", r: 16 },
                    { cx: 225, cy: 160, color: "#10b981", r: 16 },
                    { cx: 250, cy: 155, color: "#f59e0b", r: 16 },
                    { cx: 275, cy: 165, color: "#ef4444", r: 16 },
                    { cx: 215, cy: 190, color: "#10b981", r: 16 },
                    { cx: 240, cy: 185, color: "#f97316", r: 16 },
                    { cx: 265, cy: 195, color: "#ef4444", r: 16 },
                    { cx: 230, cy: 215, color: "#10b981", r: 16 },
                    { cx: 255, cy: 220, color: "#06b6d4", r: 16 },
                    { cx: 220, cy: 245, color: "#10b981", r: 16 },
                    { cx: 245, cy: 250, color: "#10b981", r: 16 },
                  ].map((hex, i) => (
                    <polygon
                      key={i}
                      points={`${hex.cx},${hex.cy - hex.r} ${hex.cx + hex.r * 0.86},${hex.cy - hex.r * 0.5} ${hex.cx + hex.r * 0.86},${hex.cy + hex.r * 0.5} ${hex.cx},${hex.cy + hex.r} ${hex.cx - hex.r * 0.86},${hex.cy + hex.r * 0.5} ${hex.cx - hex.r * 0.86},${hex.cy - hex.r * 0.5}`}
                      fill={hex.color}
                      fillOpacity="0.45"
                      stroke={hex.color}
                      strokeWidth="1.5"
                    />
                  ))}

                  {/* Underserved Radar Ring */}
                  <circle cx="215" cy="270" r="32" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" fill="rgba(16, 185, 129, 0.08)" />
                  <circle cx="215" cy="270" r="4" fill="#10b981" />
                </svg>
              </div>

              {/* Top Row: Floating Smart Tooltip Badges */}
              <div className="relative z-10 flex justify-between items-start">
                {/* High Potential Badge */}
                <div className="bg-[#0f172a]/85 border border-emerald-500/40 rounded-xl px-3 py-1.5 backdrop-blur-md shadow-lg flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <div className="text-[11px] font-bold text-white leading-none">High Potential</div>
                    <div className="text-[9px] text-emerald-300">High demand area</div>
                  </div>
                </div>

                {/* Live Layers Floating Panel (Top Right) */}
                <div className="bg-[#0f172a]/90 border border-slate-700/80 rounded-2xl p-3 backdrop-blur-md shadow-xl w-44">
                  <div className="text-[11px] font-bold text-white mb-2 pb-1 border-b border-slate-700/70 flex items-center justify-between">
                    <span>Live Layers</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="space-y-1.5 text-[10px]">
                    {[
                      { key: "population", label: "Population Density", icon: <Users className="w-3 h-3 text-sky-400" /> },
                      { key: "roads", label: "Road Network", icon: <Route className="w-3 h-3 text-emerald-400" /> },
                      { key: "competitors", label: "Competitors", icon: <Store className="w-3 h-3 text-rose-400" /> },
                      { key: "landuse", label: "Land Use", icon: <Layers className="w-3 h-3 text-purple-400" /> },
                      { key: "flood", label: "Flood Risk", icon: <ShieldAlert className="w-3 h-3 text-amber-400" /> },
                      { key: "transit", label: "Transit", icon: <Compass className="w-3 h-3 text-teal-400" /> },
                    ].map((item) => {
                      const isChecked = liveLayers[item.key as keyof typeof liveLayers];
                      return (
                        <div
                          key={item.key}
                          onClick={() => toggleLayer(item.key as keyof typeof liveLayers)}
                          className="flex items-center justify-between cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-1.5 text-slate-300">
                            {item.icon}
                            <span>{item.label}</span>
                          </div>
                          {/* Mini toggle pill */}
                          <div
                            className={`w-5 h-2.5 rounded-full flex items-center p-0.5 transition-colors ${
                              isChecked ? "bg-emerald-500 justify-end" : "bg-slate-700 justify-start"
                            }`}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-white shadow" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Middle Badges */}
              <div className="relative z-10 flex flex-col gap-2 my-auto">
                {/* Competitor Cluster */}
                <div className="self-end bg-[#0f172a]/85 border border-rose-500/40 rounded-xl px-2.5 py-1.5 backdrop-blur-md shadow-lg flex items-center gap-2 mr-6">
                  <Store className="w-3.5 h-3.5 text-rose-400" />
                  <div>
                    <div className="text-[10px] font-bold text-white leading-none">Competitor Cluster</div>
                    <div className="text-[9px] text-rose-300">High saturation</div>
                  </div>
                </div>

                {/* Underserved Area */}
                <div className="self-start bg-[#0f172a]/85 border border-emerald-500/40 rounded-xl px-2.5 py-1.5 backdrop-blur-md shadow-lg flex items-center gap-2 ml-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div>
                    <div className="text-[10px] font-bold text-white leading-none">Underserved Area</div>
                    <div className="text-[9px] text-emerald-300">Opportunity for growth</div>
                  </div>
                </div>
              </div>

              {/* Bottom Row inside Globe card */}
              <div className="relative z-10 flex items-end justify-between">
                {/* Good Accessibility Badge */}
                <div className="bg-[#0f172a]/85 border border-teal-500/40 rounded-xl px-3 py-1.5 backdrop-blur-md shadow-lg flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300 font-bold text-[10px]">
                    A
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-white leading-none">Good Accessibility</div>
                    <div className="text-[9px] text-teal-300">Near transit & major roads</div>
                  </div>
                </div>

                {/* Bottom glass summary */}
                <div className="bg-[#0f172a]/90 border border-slate-700/80 rounded-xl px-3 py-2 text-right">
                  <div className="text-[10px] text-slate-300 font-medium">
                    Turn complex geospatial data into clear opportunities.
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                    <div className="w-2/3 h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Explore Insights Across Multiple Factors ── */}
      <section id="features" className="py-14 px-6 lg:px-12 border-t border-slate-200/80 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Explore Insights Across Multiple Factors
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] mt-1 font-display">
                Comprehensive Spatial Evaluation
              </h2>
            </div>
            <button
              onClick={handleLaunch}
              className="text-xs font-semibold text-[#059669] hover:text-[#047857] flex items-center gap-1 transition-colors"
            >
              <span>See all features</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 5 Factors Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Card 1: Population & Demand */}
            <div className="group bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="w-16 h-10 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-700 opacity-80" />
                </div>
                <h3 className="font-bold text-sm text-[#0f172a] mb-1">Population & Demand</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Understand where your customers are and how demand varies across the city.
                </p>
              </div>
              <button
                onClick={handleLaunch}
                className="mt-4 w-6 h-6 rounded-full bg-slate-200 group-hover:bg-[#059669] group-hover:text-white flex items-center justify-center text-slate-600 transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Card 2: Accessibility */}
            <div className="group bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Route className="w-4 h-4" />
                  </div>
                  <div className="w-16 h-10 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-700 opacity-80" />
                </div>
                <h3 className="font-bold text-sm text-[#0f172a] mb-1">Accessibility</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Analyze connectivity, transit and travel-time across different regions.
                </p>
              </div>
              <button
                onClick={handleLaunch}
                className="mt-4 w-6 h-6 rounded-full bg-slate-200 group-hover:bg-[#059669] group-hover:text-white flex items-center justify-center text-slate-600 transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Card 3: Competition */}
            <div className="group bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="w-16 h-10 rounded-lg bg-gradient-to-tr from-rose-600 to-pink-700 opacity-80" />
                </div>
                <h3 className="font-bold text-sm text-[#0f172a] mb-1">Competition</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Identify competitor density and market saturation.
                </p>
              </div>
              <button
                onClick={handleLaunch}
                className="mt-4 w-6 h-6 rounded-full bg-slate-200 group-hover:bg-[#059669] group-hover:text-white flex items-center justify-center text-slate-600 transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Card 4: Land Suitability */}
            <div className="group bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="w-16 h-10 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-700 opacity-80" />
                </div>
                <h3 className="font-bold text-sm text-[#0f172a] mb-1">Land Suitability</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Find areas that match your development requirements.
                </p>
              </div>
              <button
                onClick={handleLaunch}
                className="mt-4 w-6 h-6 rounded-full bg-slate-200 group-hover:bg-[#059669] group-hover:text-white flex items-center justify-center text-slate-600 transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Card 5: Risk & Constraints */}
            <div className="group bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div className="w-16 h-10 rounded-lg bg-gradient-to-tr from-amber-600 to-orange-700 opacity-80" />
                </div>
                <h3 className="font-bold text-sm text-[#0f172a] mb-1">Risk & Constraints</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Account for flood, environmental and geographic risks.
                </p>
              </div>
              <button
                onClick={handleLaunch}
                className="mt-4 w-6 h-6 rounded-full bg-slate-200 group-hover:bg-[#059669] group-hover:text-white flex items-center justify-center text-slate-600 transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Sustainable Growth + How It Works + Ready to Explore ── */}
      <section id="how-it-works" className="py-14 px-6 lg:px-12 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Card 1 (Left): Sustainable Growth */}
          <div className="lg:col-span-4 rounded-3xl bg-gradient-to-b from-[#1e293b] to-[#0f172a] text-white p-7 flex flex-col justify-between shadow-sm relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.4) 0%, transparent 60%)",
              }}
            />
            <div className="relative z-10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono mb-2">
                Sustainable Growth
              </div>
              <h3 className="text-2xl font-bold font-display leading-snug mb-3">
                Data for a <br />Better Tomorrow
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                From businesses to better infrastructure, SiteScope enables smarter, more sustainable and more inclusive growth.
              </p>
            </div>
            <div className="relative z-10 pt-6">
              <div className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                <span>Transparent rule-based scoring</span>
              </div>
            </div>
          </div>

          {/* Card 2 (Center): How It Works */}
          <div className="lg:col-span-5 rounded-3xl bg-white border border-slate-200 p-7 flex flex-col justify-between shadow-sm">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-4">
                How It Works
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center">
                      01
                    </span>
                    <span className="text-xs font-bold text-slate-800">Select a City</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Choose from pre-processed cities with rich spatial data.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center">
                      02
                    </span>
                    <span className="text-xs font-bold text-slate-800">Define Your Needs</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Answer a few questions about your business.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center">
                      03
                    </span>
                    <span className="text-xs font-bold text-slate-800">Analyze</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    We evaluate thousands of locations using geospatial intelligence.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center">
                      04
                    </span>
                    <span className="text-xs font-bold text-slate-800">Discover & Decide</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Explore results, compare sites and export reports.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3 (Right): Ready to Explore */}
          <div className="lg:col-span-3 rounded-3xl bg-[#ecfdf5] border border-emerald-200/80 p-7 flex flex-col justify-between shadow-sm">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono mb-2">
                Ready to Explore?
              </div>
              <h3 className="text-xl font-bold font-display text-[#064e3b] leading-tight mb-2">
                Find your next opportunity.
              </h3>
              <p className="text-xs text-emerald-800/80 leading-relaxed mb-6">
                Instant site scoring across {activeCity.name} and top metro areas.
              </p>
            </div>
            <button
              onClick={handleLaunch}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white font-semibold text-xs shadow-md shadow-emerald-950/10 transition-all"
            >
              <span>Start Site Analysis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── 5. Trusted By Innovators Bar ── */}
      <footer className="py-6 px-6 lg:px-12 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-xs">
          <div className="flex flex-wrap items-center gap-5">
            <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 font-mono">
              Trusted by Innovators
            </span>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Governments</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Real Estate</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
              <span>Retail & FMCG</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Zap className="w-3.5 h-3.5 text-slate-400" />
              <span>Energy & Utilities</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
              <span>Healthcare</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
              <span>Education</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <span>Logistics</span>
            </div>
            <span className="text-slate-400 text-[11px]">... and more</span>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Locations today. Opportunities tomorrow.
          </div>
        </div>
      </footer>

      {/* ── Demo Modal (if clicked) ── */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-[#059669]">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">SiteScope Platform Overview</h3>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-6 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#059669] flex items-center justify-center mx-auto shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-lg text-slate-800">
                End-to-End Location Intelligence in Action
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Watch how SiteScope scores 1000s of urban hexagons, derives multi-criteria weights, identifies Getis-Ord Gi* hotspots, and lets you speak with the AI Copilot.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    setShowDemoModal(false);
                    handleLaunch();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-[#064e3b] text-white text-xs font-bold hover:bg-[#047857] transition-all shadow"
                >
                  Try Interactive Live Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
