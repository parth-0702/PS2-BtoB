import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, SkipForward, Sparkles, MapPin } from "lucide-react";
import { QUESTIONS } from "@/lib/sitescope/questions";
import { useSiteScope } from "@/lib/sitescope/store";
import { resolveAnswers } from "@/lib/sitescope/resolve";
import type { Answers } from "@/lib/sitescope/types";

interface WizardProps {
  onBack: () => void;
  onFinish: () => void;
}

export function Wizard({ onBack, onFinish }: WizardProps) {
  const { answers, setAnswer, setResolved, wizardStep, setWizardStep, useDefaults, city } =
    useSiteScope();
  const [customText, setCustomText] = useState<Record<string, string>>({});

  const totalSteps = QUESTIONS.length;
  const q = QUESTIONS[wizardStep]!;
  const current = answers[q.id];
  const selectedIds = current?.optionIds ?? [];

  function toggle(optId: string) {
    if (q.multi) {
      const max = q.maxSelect ?? Infinity;
      let next = selectedIds.includes(optId)
        ? selectedIds.filter((x) => x !== optId)
        : selectedIds.length < max
          ? [...selectedIds, optId]
          : selectedIds;
      setAnswer(q.id, { optionIds: next, customText: customText[q.id] });
    } else {
      setAnswer(q.id, { optionIds: [optId], customText: customText[q.id] });
    }
  }

  function handleCustom(val: string) {
    setCustomText((prev) => ({ ...prev, [q.id]: val }));
    setAnswer(q.id, { optionIds: selectedIds, customText: val });
  }

  function canAdvance() {
    return selectedIds.length > 0 || (customText[q.id]?.trim() ?? "").length > 0;
  }

  function next() {
    if (wizardStep < totalSteps - 1) {
      setWizardStep(wizardStep + 1);
    } else {
      finish();
    }
  }

  function prev() {
    if (wizardStep === 0) onBack();
    else setWizardStep(wizardStep - 1);
  }

  function finish() {
    const result = resolveAnswers(answers as Answers);
    setResolved(result.config, result.interpretation, result.fallbackUsed);
    onFinish();
  }

  function skipAll() {
    useDefaults();
    const result = resolveAnswers(useSiteScope.getState().answers as Answers);
    setResolved(result.config, result.interpretation, result.fallbackUsed);
    onFinish();
  }

  const progress = ((wizardStep + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-[#0f172a] select-none font-sans">
      {/* Header bar */}
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200/90 bg-white shadow-xs">
        <button
          id="wizard-back-btn"
          onClick={prev}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {wizardStep === 0 ? "Change City" : "Previous Step"}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center text-[#064e3b]">
            <MapPin className="w-3 h-3" />
          </div>
          <span className="text-xs text-slate-800 font-bold">
            {city?.name ?? "City"} Spatial Analysis
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">
            {wizardStep + 1} of {totalSteps}
          </span>
          <button
            id="wizard-skip-btn"
            onClick={skipAll}
            className="flex items-center gap-1 text-xs text-[#059669] hover:underline font-semibold"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Use Defaults & Skip
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full transition-all duration-300 ease-out bg-gradient-to-r from-[#059669] to-[#0f766e]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main content card */}
      <div className="flex-1 flex items-start justify-center pt-8 pb-16 px-4">
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          {/* Question header */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full mb-3 bg-emerald-50 text-[#065f46] border border-emerald-200 font-mono">
              <ChevronRight className="w-3 h-3" />
              Step {wizardStep + 1} of {totalSteps}
              {q.multi && ` · Pick up to ${q.maxSelect ?? "multiple"}`}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0f172a] mb-2 leading-tight">
              {q.title}
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">{q.subtitle}</p>
          </div>

          {/* Options grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
            {q.options.map((opt) => {
              const selected = selectedIds.includes(opt.id);
              const isMultiSelected = q.multi && selected;
              const rank = q.multi ? selectedIds.indexOf(opt.id) + 1 : 0;

              return (
                <button
                  key={opt.id}
                  id={`opt-${q.id}-${opt.id}`}
                  onClick={() => toggle(opt.id)}
                  className={`relative text-left p-4 rounded-2xl border transition-all duration-150 ${
                    selected
                      ? "bg-emerald-50/80 border-[#059669] shadow-sm"
                      : "bg-slate-50/60 border-slate-200 hover:bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs sm:text-sm font-semibold text-slate-800">{opt.label}</div>
                      {opt.hint && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</div>
                      )}
                    </div>
                    {selected ? (
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#059669] text-white flex items-center justify-center shadow-xs">
                        {isMultiSelected ? (
                          <span className="text-[11px] font-bold leading-none">{rank}</span>
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-5 h-5 rounded-full border border-slate-300" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom text input */}
          <div className="mb-6">
            <input
              id={`custom-input-${q.id}`}
              type="text"
              value={customText[q.id] ?? ""}
              onChange={(e) => handleCustom(e.target.value)}
              placeholder={`Or specify custom requirement — ${q.customPlaceholder}`}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#059669] focus:bg-white transition-all shadow-xs"
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              id="wizard-prev-btn"
              onClick={prev}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {wizardStep === 0 ? "City Selection" : "Previous"}
            </button>

            <button
              id="wizard-next-btn"
              onClick={next}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-[#064e3b] hover:bg-[#047857] text-white shadow-md shadow-emerald-950/15"
            >
              {wizardStep === totalSteps - 1 ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Analyze & Open Dashboard
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mt-6">
            {QUESTIONS.map((_, i) => (
              <button
                key={i}
                id={`step-dot-${i}`}
                onClick={() => i <= wizardStep && setWizardStep(i)}
                className="transition-all duration-200"
                style={{
                  width: i === wizardStep ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background:
                    i < wizardStep
                      ? "rgb(5, 150, 105)"
                      : i === wizardStep
                        ? "rgb(6, 78, 59)"
                        : "rgb(226, 232, 240)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
