import { useState, useEffect, useRef } from "react";
import {
  Mic, MicOff, Volume2, VolumeX, Send, Sparkles, Bot, User,
  HelpCircle, ChevronRight, Square, MessageSquare, Flame, MapPin
} from "lucide-react";
import type { ScoredHex } from "@/lib/sitescope/scoring";
import type { City, ScoringConfig } from "@/lib/sitescope/types";
import { resolveNeighborhood } from "@/lib/sitescope/neighborhoods";

interface AiVoiceCopilotProps {
  city: City;
  config: ScoringConfig | null;
  selectedHex: ScoredHex | null;
  top3: ScoredHex[];
  scored: ScoredHex[];
  onSelectHex?: (h3: string) => void;
}

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  isVoice?: boolean;
}

export function AiVoiceCopilot({
  city,
  config,
  selectedHex,
  top3,
  scored,
  onSelectHex,
}: AiVoiceCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: `Hello! I'm your SiteScope AI Copilot for **${city.name}**. You can ask me any question using **Voice** 🎙️ or **Text** 💬 — for example, ask me why a highlighted area is optimal for your business, or compare the top locations!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isThinking, setIsThinking] = useState(false);

  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false;
      recognizer.interimResults = false;
      recognizer.lang = "en-US";

      recognizer.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript?.trim()) {
          handleSendMessage(transcript, true);
        }
        setIsListening(false);
      };

      recognizer.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognizer.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognizer;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Text to speech function
  const speakText = (text: string) => {
    if (!speechEnabled || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    // Strip markdown formatting for cleaner speech output
    const cleanText = text
      .replace(/\*\*/g, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .replace(/#+\s/g, "")
      .replace(/`.*?`/g, "")
      .replace(/[•\-\*]\s/g, ", ");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.lang = "en-US";

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      stopSpeaking();
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.warn("Could not start speech recognition:", err);
      }
    }
  };

  // Generate intelligent context-aware response
  const generateResponse = async (query: string): Promise<string> => {
    const q = query.toLowerCase();
    const preset = config?.scale || "retail business";
    const getPlaceName = (hex: ScoredHex) =>
      resolveNeighborhood(city.id, hex.center[1], hex.center[0]).name;

    // 1. Question about selected/highlighted area
    if (q.includes("highlighted") || q.includes("selected") || q.includes("this area") || q.includes("proper for my business") || q.includes("why this area")) {
      if (!selectedHex) {
        const best = top3[0];
        const bestPlace = best ? getPlaceName(best) : "the city center";
        return `You have not selected a specific area yet. The strongest current opportunity is ${bestPlace}, with a score of ${best ? (best.score100 || Math.round(best.score * 100)) : 92} out of 100. It combines strong demand and accessibility with manageable competition. Select any hexagon on the map for a more detailed local assessment.`;
      }

      const scorePct = selectedHex.score100 || Math.round((selectedHex.score || 0) * 100);
      const isHotspot = (selectedHex as any).gi_z > 1.65;
      const isUnderserved = (selectedHex as any).underserved;

      const ff = selectedHex.footfall ?? selectedHex.subscores?.['footfall'] ?? 0.5;
      const acc = selectedHex.accessibility ?? selectedHex.subscores?.['accessibility'] ?? 0.5;
      const pop = selectedHex.population ?? selectedHex.subscores?.['demand'] ?? 0.5;
      const rnt = selectedHex.rent ?? selectedHex.subscores?.['rent'] ?? 0.5;
      const cmp = selectedHex.competition ?? selectedHex.subscores?.['competition'] ?? 0.4;
      const fld = selectedHex.floodRisk ?? selectedHex.subscores?.['risk'] ?? 0.2;

      const placeName = getPlaceName(selectedHex);
      let answer = `${placeName} has an overall Site Readiness Score of ${scorePct} out of 100.\n\n`;

      if (scorePct >= 75) {
        answer += `Why it stands out:\n`;
        answer += `• Demand is strong, with a ${Math.round(ff > 1 ? ff : ff * 100)}% footfall indicator.\n`;
        answer += `• Accessibility is rated ${Math.round(acc > 1 ? acc : acc * 100)}%, making the area easy for customers to reach.\n`;
        if (isHotspot) answer += `• It sits within a statistically significant high-demand cluster.\n`;
        if (isUnderserved) answer += `• It appears underserved, leaving room for a new business to grow.\n`;
      } else if (scorePct >= 50) {
        answer += `This is a balanced opportunity. It has ${Math.round(pop > 1 ? pop : pop * 100)}% residential demand, while rent is indexed at ${Math.round(rnt > 1 ? rnt : rnt * 100)}% and competitor density at ${Math.round(cmp > 1 ? cmp : cmp * 100)}%.\n`;
      } else {
        answer += `This area is below the current benchmark. The main concerns are lower footfall (${Math.round(ff > 1 ? ff : ff * 100)}%) and higher relative operating costs or flood risk (${Math.round(fld > 1 ? fld : fld * 100)}%).`;
      }

      return answer;
    }

    // 2. Question about Top recommendations
    if (q.includes("top") || q.includes("best") || q.includes("recommend") || q.includes("where should i open")) {
      if (top3.length === 0) return `Based on current scoring parameters, no eligible sites met all strict thresholds. Try adjusting weight sliders.`;
      let res = `Here are the three strongest opportunities in ${city.name}:\n\n`;
      top3.forEach((h, i) => {
        const ff = h.footfall ?? h.subscores?.['footfall'] ?? 0.5;
        const acc = h.accessibility ?? h.subscores?.['accessibility'] ?? 0.5;
        const rnt = h.rent ?? h.subscores?.['rent'] ?? 0.5;
        res += `${i + 1}. ${getPlaceName(h)} — score ${h.score100 || Math.round(h.score * 100)} out of 100.\n`;
        res += `   Demand: ${Math.round(ff > 1 ? ff : ff * 100)}% · Accessibility: ${Math.round(acc > 1 ? acc : acc * 100)}% · Rent index: ${Math.round(rnt > 1 ? rnt : rnt * 100)}%\n`;
      });
      res += `\nWould you like me to highlight the #1 location on the map?`;
      return res;
    }

    // 3. Question about Competition
    if (q.includes("competit") || q.includes("rival")) {
      const totalComp = scored.reduce((a, b) => a + (b.competition ?? b.subscores?.['competition'] ?? 0.4), 0);
      const avgCompVal = scored.length > 0 ? totalComp / scored.length : 0.4;
      const avgCompPct = Math.round(avgCompVal > 1 ? avgCompVal : avgCompVal * 100);
      return `In **${city.name}**, competitor saturation averages **${avgCompPct}%** across commercial corridors. Your current scoring policy is set to **${config?.competitionMode ?? "penalize"}** nearby competitors with a distance decay of **${((config?.decayD0 ?? 1000) / 1000).toFixed(1)} km**. Sites marked as "Underserved" on the map have heavy footfall with below-average competition.`;
    }

    // 4. Question about Hotspots / Getis-Ord Gi*
    if (q.includes("hotspot") || q.includes("getis") || q.includes("gi*") || q.includes("clustering")) {
      return `**Getis-Ord Gi*** identifies spatial autocorrelation by comparing each hex and its neighbours against the citywide mean. A z-score > 1.65 (shown in orange/red) indicates a statistically significant cluster of high footfall and demand (90–99% confidence), rather than random noise.`;
    }

    // 5. Question about Isochrones / Reachability
    if (q.includes("isochrone") || q.includes("reach") || q.includes("drive") || q.includes("walk") || q.includes("travel time")) {
      return `The Isochrone module computes reachable road network catchments at **5, 10, and 15-minute** intervals for walking or driving from any selected site. This reveals total addressable population living within easy customer transit distance.`;
    }

    // General intelligent response
    return `In **${city.name}**, our analysis evaluated **${scored.length} hexagonal zones** for your business profile. The citywide average score is **${(scored.reduce((a, b) => a + b.score, 0) / (scored.length || 1) * 100).toFixed(0)}/100**. Click any cell on the map or ask me specifically: "Why is the top location best?", "Explain footfall vs rent trade-offs", or "Show underserved opportunities".`;
  };

  const handleSendMessage = async (textToSend?: string, wasVoice = false) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    setInput("");

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isVoice: wasVoice,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      // Simulate slight realistic AI response delay
      await new Promise((r) => setTimeout(r, 450));
      const aiReply = await generateResponse(query);

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: "assistant",
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);

      // Speak response if user spoke via voice or speech is enabled
      if (wasVoice || speechEnabled) {
        speakText(aiReply);
      }
    } catch (err) {
      console.error("AI Copilot error:", err);
    } finally {
      setIsThinking(false);
    }
  };

  const quickPrompts = [
    "Why is the highlighted area proper for my business?",
    "Show me the top 3 recommended locations",
    "Where are the lowest competition hotspots?",
    "Explain the Getis-Ord Gi* hot spot calculation",
  ];

  return (
    <div className="flex flex-col h-full bg-[#111622] rounded-xl overflow-hidden border border-slate-700/40 select-none">
      {/* Copilot Header */}
      <div className="flex-shrink-0 p-3 bg-[#141a29] border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-amber-500 flex items-center justify-center shadow-md shadow-sky-500/20">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">SiteScope AI Copilot</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Voice & Text Ready</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Speaking Indicator & Stop button */}
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] animate-pulse"
              title="Stop speaking"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Speaking</span>
            </button>
          )}

          {/* Voice Toggle */}
          <button
            onClick={() => {
              if (isSpeaking) stopSpeaking();
              setSpeechEnabled(!speechEnabled);
            }}
            className={`p-1.5 rounded-lg border transition-colors ${
              speechEnabled
                ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
            }`}
            title={speechEnabled ? "Voice output enabled (Click to mute)" : "Voice output muted"}
          >
            {speechEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Selected Hex Context Banner if selected */}
      {selectedHex && (
        <div className="bg-sky-950/40 border-b border-sky-500/20 px-3 py-1.5 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-sky-300 truncate">
            <MapPin className="w-3 h-3 text-sky-400 flex-shrink-0" />
            <span>Active area: <strong>{resolveNeighborhood(city.id, selectedHex.center[1], selectedHex.center[0]).name}</strong> (Score: {selectedHex.score100 || Math.round(selectedHex.score * 100)})</span>
          </div>
          <button
            onClick={() => handleSendMessage("Why is the highlighted area proper for my business?")}
            className="text-[10px] text-amber-400 hover:underline flex-shrink-0 ml-2"
          >
            Ask AI
          </button>
        </div>
      )}

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m) => {
          const isUser = m.sender === "user";
          return (
            <div
              key={m.id}
              className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-6 h-6 rounded-md bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-gradient-to-r from-sky-600 to-sky-700 text-white rounded-br-none shadow-md shadow-sky-900/30"
                    : "bg-[#182030] text-slate-200 border border-slate-700/60 rounded-bl-none shadow-sm"
                }`}
              >
                {/* Voice badge if message was spoken */}
                {m.isVoice && (
                  <div className="flex items-center gap-1 text-[10px] text-sky-200 mb-1 font-mono">
                    <Mic className="w-3 h-3" /> Spoken via microphone
                  </div>
                )}
                <div>{m.text}</div>
                <div className="text-[9px] text-slate-400 text-right mt-1.5 font-mono">
                  {m.timestamp}
                </div>
              </div>

              {isUser && (
                <div className="w-6 h-6 rounded-md bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-300" />
                </div>
              )}
            </div>
          );
        })}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex items-center gap-2 text-xs text-sky-400 p-2 bg-sky-500/10 rounded-xl w-fit">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span className="font-mono text-[11px]">SiteScope AI is analyzing spatial data...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="p-2 border-t border-slate-800/80 bg-[#0e131d] overflow-x-auto">
        <div className="flex gap-1.5 pb-1 no-scrollbar">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(p)}
              className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/50 hover:text-white transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Voice / Text Input Box */}
      <div className="p-2.5 bg-[#141a29] border-t border-slate-700/50 flex items-center gap-2">
        {/* Microphone Button */}
        <button
          type="button"
          onClick={toggleListening}
          className={`relative p-2 rounded-xl border transition-all flex items-center justify-center ${
            isListening
              ? "bg-rose-500 text-white border-rose-400 animate-pulse shadow-lg shadow-rose-500/40"
              : "bg-slate-800/90 text-sky-400 border-slate-700 hover:bg-slate-700"
          }`}
          title={isListening ? "Listening... Click to cancel" : "Click to speak with Voice"}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {isListening && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-400 animate-ping" />
          )}
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder={
            isListening
              ? "Listening to your voice..."
              : "Ask anything about this city or highlighted area..."
          }
          className="flex-1 bg-[#0c1018] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!input.trim()}
          className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white transition-colors"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
