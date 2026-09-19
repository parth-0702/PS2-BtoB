import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Answers, City, LayerId, ScoringConfig } from "./types";
import { DEFAULT_ANSWERS } from "./resolve";

export interface LayerViewState {
  visible: boolean;
  opacity: number;
}

export interface FactorWeights {
  demand: number;
  accessibility: number;
  complementary: number;
  competition: number;
  landuse: number;
  risk: number;
}

interface SiteScopeState {
  city: City | null;
  answers: Answers;
  baseConfig: ScoringConfig | null;
  activeConfig: ScoringConfig | null;
  config: ScoringConfig | null; // alias for activeConfig
  interpretation: string[];
  fallbackUsed: boolean;
  wizardStep: number;
  overlays: {
    hotspots: boolean;
    underserved: boolean;
    competitorHulls: boolean;
    isochrone: boolean;
  };
  layerView: Record<LayerId, LayerViewState>;
  customLayers: { id: string; name: string; points: [number, number][] }[];
  selectedH3: string | null;
  compare: string[];
  drawnPolygon: [number, number][] | null;
  setCity: (city: City) => void;
  setAnswer: (id: string, value: Answers[string]) => void;
  setAnswers: (answers: Answers) => void;
  useDefaults: () => void;
  setResolved: (config: ScoringConfig, interpretation: string[], fallbackUsed: boolean) => void;
  setActiveConfig: (config: ScoringConfig) => void;
  resetToMyAnswers: () => void;
  setWeight: (layer: LayerId, value: number) => void;
  patchConfig: (patch: Partial<ScoringConfig>) => void;
  setWizardStep: (n: number) => void;
  toggleOverlay: (key: keyof SiteScopeState["overlays"]) => void;
  setLayerView: (layer: LayerId, patch: Partial<LayerViewState>) => void;
  addCustomLayer: (layer: { id: string; name: string; points: [number, number][] }) => void;
  selectHex: (h3: string | null) => void;
  toggleCompare: (h3: string) => void;
  setDrawnPolygon: (poly: [number, number][] | null) => void;
  reset: () => void;
}

const defaultLayerView = (): Record<LayerId, LayerViewState> => ({
  population: { visible: true, opacity: 0.8 },
  footfall: { visible: true, opacity: 0.8 },
  accessibility: { visible: true, opacity: 0.8 },
  complementary: { visible: true, opacity: 0.8 },
  competition: { visible: true, opacity: 0.8 },
  rent: { visible: true, opacity: 0.8 },
  demand: { visible: true, opacity: 0.8 },
  landuse: { visible: true, opacity: 0.8 },
  risk: { visible: true, opacity: 0.8 },
});

export const useSiteScope = create<SiteScopeState>()(
  persist(
    (set) => ({
      city: null,
      answers: {},
      baseConfig: null,
      activeConfig: null,
      config: null,
      interpretation: [],
      fallbackUsed: false,
      wizardStep: 0,
      overlays: { hotspots: false, underserved: false, competitorHulls: false, isochrone: false },
      layerView: defaultLayerView(),
      customLayers: [],
      selectedH3: null,
      compare: [],
      drawnPolygon: null,
      setCity: (city) => set({ city }),
      setAnswer: (id, value) => set((s) => ({ answers: { ...s.answers, [id]: value } })),
      setAnswers: (answers) => set({ answers }),
      useDefaults: () => set({ answers: DEFAULT_ANSWERS }),
      setResolved: (config, interpretation, fallbackUsed) =>
        set({
          baseConfig: config,
          activeConfig: config,
          config: config,
          interpretation,
          fallbackUsed,
        }),
      setActiveConfig: (config) => set({ activeConfig: config, config }),
      resetToMyAnswers: () =>
        set((s) => (s.baseConfig ? { activeConfig: s.baseConfig, config: s.baseConfig } : s)),
      setWeight: (layer, value) =>
        set((s) => {
          if (!s.activeConfig) return s;
          const updated = {
            ...s.activeConfig,
            weights: { ...s.activeConfig.weights, [layer]: value },
          };
          return { activeConfig: updated, config: updated };
        }),
      patchConfig: (patch) =>
        set((s) => {
          if (!s.activeConfig) return s;
          const updated = { ...s.activeConfig, ...patch };
          return { activeConfig: updated, config: updated };
        }),
      setWizardStep: (n) => set({ wizardStep: n }),
      toggleOverlay: (key) => set((s) => ({ overlays: { ...s.overlays, [key]: !s.overlays[key] } })),
      setLayerView: (layer, patch) =>
        set((s) => ({ layerView: { ...s.layerView, [layer]: { ...s.layerView[layer], ...patch } } })),
      addCustomLayer: (layer) => set((s) => ({ customLayers: [...s.customLayers, layer] })),
      selectHex: (h3) => set({ selectedH3: h3 }),
      toggleCompare: (h3) =>
        set((s) => ({
          compare: s.compare.includes(h3)
            ? s.compare.filter((x) => x !== h3)
            : [...s.compare, h3].slice(-3),
        })),
      setDrawnPolygon: (poly) => set({ drawnPolygon: poly }),
      reset: () =>
        set({
          city: null,
          answers: {},
          baseConfig: null,
          activeConfig: null,
          config: null,
          interpretation: [],
          wizardStep: 0,
          selectedH3: null,
          compare: [],
          drawnPolygon: null,
        }),
    }),
    {
      name: "sitescope-session",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
          : window.sessionStorage,
      ),
      partialize: (s) => ({
        city: s.city,
        answers: s.answers,
        baseConfig: s.baseConfig,
        activeConfig: s.activeConfig,
        config: s.activeConfig,
        interpretation: s.interpretation,
        fallbackUsed: s.fallbackUsed,
        overlays: s.overlays,
        layerView: s.layerView,
        compare: s.compare,
        selectedH3: s.selectedH3,
      }),
    },
  ),
);
