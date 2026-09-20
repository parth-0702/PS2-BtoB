import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/LandingPage";
import { CityLoadingAnimation } from "@/components/CityLoadingAnimation";
import { Wizard } from "@/components/Wizard";
import { ProcessingPipelineLoading } from "@/components/ProcessingPipelineLoading";
import { MapView } from "@/components/MapView";
import { useSiteScope } from "@/lib/sitescope/store";
import type { City } from "@/lib/sitescope/types";

export const Route = createFileRoute("/")({
  component: Index,
});

type AppFlowState = "landing" | "city-loading" | "wizard" | "process-loading" | "map";

function Index() {
  const [view, setView] = useState<AppFlowState>("landing");
  const { city, config, reset, setWizardStep, setCity } = useSiteScope();

  function handleStartCity(selectedCity: City) {
    setCity(selectedCity);
    setView("city-loading");
  }

  function handleCityLoadComplete() {
    setView("wizard");
  }

  function handleWizardFinish() {
    setView("process-loading");
  }

  function handleProcessPipelineComplete() {
    setView("map");
  }

  function handleReset() {
    reset();
    setWizardStep(0);
    setView("landing");
  }

  return (
    <>
      {/* 1. Landing Page with City Dropdown */}
      {view === "landing" && (
        <LandingPage onStart={handleStartCity} />
      )}

      {/* 2. Unique City Mesh Loading Animation */}
      {view === "city-loading" && city && (
        <CityLoadingAnimation
          city={city}
          onComplete={handleCityLoadComplete}
        />
      )}

      {/* 3. Multi-Choice Business Questionnaire */}
      {view === "wizard" && (
        <Wizard
          onBack={() => setView("landing")}
          onFinish={handleWizardFinish}
        />
      )}

      {/* 4. Realistic Real-Time Processing Pipeline Animation */}
      {view === "process-loading" && city && (
        <ProcessingPipelineLoading
          city={city}
          config={config}
          onComplete={handleProcessPipelineComplete}
        />
      )}

      {/* 5. Main Dashboard with Left Sidebar & Voice Copilot */}
      {view === "map" && (
        <MapView
          onBack={() => setView("wizard")}
          onReset={handleReset}
        />
      )}
    </>
  );
}
