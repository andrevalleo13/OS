"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, X } from "lucide-react";
import { askShadow } from "@/app/actions/shadow";
import ShadowOrb from "@/components/ShadowOrb";
import type { ShadowConversationMeta, ShadowMessage, ShadowStatus } from "./types";

export const SHADOW_ACTIVE_CONVERSATION_KEY = "valleos.shadow.active-conversation.v1";
export const SHADOW_CONVERSATION_INDEX_KEY = "valleos.shadow.conversations.v2";
export const SHADOW_VOICE_ENABLED_KEY = "valleos.shadow.voice-enabled.v1";
export const SHADOW_VOICE_USER_EVENT = "valleos:shadow-voice-user";
export const SHADOW_VOICE_ASSISTANT_EVENT = "valleos:shadow-voice-assistant";

const VOICE_CONVERSATION_KEY = "dashboard:voice";
const WAKE_PATTERN = /^\s*(?:oye\s+)?(?:shadow|shado|shadou|chado|chato|yado)\b/i;
const LISTENING_TIMEOUT_MS = 8_000;

export type ShadowVoicePhase =
  | "booting"
  | "armed"
  | "listening"
  | "processing"
  | "speaking"
  | "blocked"
  | "unsupported"
  | "muted";

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type SpeechRecognitionErrorEvent = { error: string };

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

export type ShadowVoiceMessageDetail = {
  conversationKey: string;
  message: ShadowMessage;
};

type ShadowVoiceContextValue = {
  enabled: boolean;
  supported: boolean;
  phase: ShadowVoicePhase;
  transcript: string;
  lastResponse: string;
  error: string | null;
  toggleEnabled: () => void;
  listenNow: () => void;
  cancelVoice: () => void;
};

const ShadowVoiceContext = createContext<ShadowVoiceContextValue | null>(null);

function makeId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function parseConversationIndex(): ShadowConversationMeta[] {
  try {
    const value = window.localStorage.getItem(SHADOW_CONVERSATION_INDEX_KEY);
    return value ? JSON.parse(value) as ShadowConversationMeta[] : [];
  } catch {
    return [];
  }
}

function updateVoiceConversation(conversationKey: string, preview: string) {
  const now = new Date().toISOString();
  const current = parseConversationIndex();
  const existing = current.find((conversation) => conversation.key === conversationKey);
  const next: ShadowConversationMeta = existing
    ? { ...existing, preview, updatedAt: now, archived: false }
    : {
        key: conversationKey,
        title: conversationKey === VOICE_CONVERSATION_KEY ? "Voz con Shadow" : "Conversación con Shadow",
        preview,
        createdAt: now,
        updatedAt: now,
        pinned: false,
        archived: false,
      };
  window.localStorage.setItem(
    SHADOW_CONVERSATION_INDEX_KEY,
    JSON.stringify([next, ...current.filter((conversation) => conversation.key !== conversationKey)]),
  );
}

function cleanForSpeech(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_#>`~\[\]()|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_800);
}

function voiceStatus(phase: ShadowVoicePhase): ShadowStatus {
  if (phase === "listening") return "listening";
  if (phase === "processing") return "thinking";
  if (phase === "speaking") return "speaking";
  return "idle";
}

function phaseLabel(phase: ShadowVoicePhase) {
  if (phase === "listening") return "Te escucho";
  if (phase === "processing") return "Pensando";
  if (phase === "speaking") return "Respondiendo";
  if (phase === "blocked") return "Permiso de micrófono requerido";
  if (phase === "unsupported") return "Voz no disponible en este navegador";
  return "Voz activa";
}

export function ShadowVoiceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(true);
  const [supported, setSupported] = useState(true);
  const [phase, setPhaseState] = useState<ShadowVoicePhase>("booting");
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pathnameRef = useRef(pathname);
  const enabledRef = useRef(true);
  const phaseRef = useRef<ShadowVoicePhase>("booting");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recognitionRunningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const listeningTimerRef = useRef<number | null>(null);
  const executingRef = useRef(false);
  const voiceTurnRef = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const executeCommandRef = useRef<(command: string) => void>(() => undefined);

  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  const setPhase = useCallback((next: ShadowVoicePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const clearListeningTimer = useCallback(() => {
    if (listeningTimerRef.current !== null) {
      window.clearTimeout(listeningTimerRef.current);
      listeningTimerRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    clearRestartTimer();
    if (!recognitionRunningRef.current) return;
    try {
      recognitionRef.current?.stop();
    } catch {
      recognitionRunningRef.current = false;
    }
  }, [clearRestartTimer]);

  const startRecognition = useCallback(() => {
    if (!enabledRef.current || recognitionRunningRef.current || executingRef.current) return;
    if (phaseRef.current !== "armed" && phaseRef.current !== "listening") return;
    try {
      recognitionRef.current?.start();
    } catch {
      // The browser may still be completing a previous stop. onend will retry.
    }
  }, []);

  const scheduleRecognition = useCallback((delay = 350) => {
    clearRestartTimer();
    if (!enabledRef.current || executingRef.current) return;
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      startRecognition();
    }, delay);
  }, [clearRestartTimer, startRecognition]);

  const armListeningTimeout = useCallback(() => {
    clearListeningTimer();
    listeningTimerRef.current = window.setTimeout(() => {
      listeningTimerRef.current = null;
      setTranscript("");
      if (enabledRef.current && !executingRef.current) {
        setPhase("armed");
        scheduleRecognition();
      }
    }, LISTENING_TIMEOUT_MS);
  }, [clearListeningTimer, scheduleRecognition, setPhase]);

  const finishVoiceTurn = useCallback(() => {
    executingRef.current = false;
    utteranceRef.current = null;
    setTranscript("");
    if (enabledRef.current) {
      setPhase("armed");
      scheduleRecognition(450);
    } else {
      setPhase("muted");
    }
  }, [scheduleRecognition, setPhase]);

  const speak = useCallback((rawText: string) => {
    const text = cleanForSpeech(rawText);
    if (!text || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      finishVoiceTurn();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === "es-mx")
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("es"))
      ?? null;
    utterance.lang = utterance.voice?.lang ?? "es-MX";
    utterance.rate = 1.02;
    utterance.pitch = 0.92;
    utterance.onend = finishVoiceTurn;
    utterance.onerror = finishVoiceTurn;
    utteranceRef.current = utterance;
    setPhase("speaking");
    window.speechSynthesis.speak(utterance);
  }, [finishVoiceTurn, setPhase]);

  const getConversationKey = useCallback(() => {
    if (pathnameRef.current === "/shadow") {
      return window.localStorage.getItem(SHADOW_ACTIVE_CONVERSATION_KEY)?.trim() || "dashboard:primary";
    }
    return VOICE_CONVERSATION_KEY;
  }, []);

  const executeCommand = useCallback(async (rawCommand: string) => {
    const command = rawCommand.trim();
    if (!command || executingRef.current) return;

    executingRef.current = true;
    const voiceTurn = ++voiceTurnRef.current;
    clearListeningTimer();
    stopRecognition();
    setTranscript(command);
    setError(null);
    setPhase("processing");

    const conversationKey = getConversationKey();
    const userMessage: ShadowMessage = {
      id: makeId("voice-usr"),
      sender: "USR",
      text: command,
      createdAt: new Date().toISOString(),
    };
    updateVoiceConversation(conversationKey, command);
    window.dispatchEvent(new CustomEvent<ShadowVoiceMessageDetail>(SHADOW_VOICE_USER_EVENT, {
      detail: { conversationKey, message: userMessage },
    }));

    try {
      const result = await askShadow({ message: command, conversationKey, channel: "dashboard" });
      const assistantMessage: ShadowMessage = {
        id: makeId("voice-shdw"),
        sender: "SHDW",
        text: result.text,
        mood: result.mood,
        widget: result.widget,
        pendingAction: result.pendingAction,
        createdAt: new Date().toISOString(),
      };
      setLastResponse(result.text);
      updateVoiceConversation(conversationKey, result.text);
      window.dispatchEvent(new CustomEvent<ShadowVoiceMessageDetail>(SHADOW_VOICE_ASSISTANT_EVENT, {
        detail: { conversationKey, message: assistantMessage },
      }));
      if (voiceTurn !== voiceTurnRef.current || !enabledRef.current) {
        executingRef.current = false;
        setPhase(enabledRef.current ? "armed" : "muted");
        if (enabledRef.current) scheduleRecognition();
        return;
      }
      speak(result.text);
    } catch {
      const fallback = "No pude completar esa solicitud. Inténtalo de nuevo.";
      setLastResponse(fallback);
      setError(fallback);
      const assistantMessage: ShadowMessage = {
        id: makeId("voice-error"),
        sender: "SHDW",
        text: fallback,
        mood: "urgent",
        createdAt: new Date().toISOString(),
      };
      window.dispatchEvent(new CustomEvent<ShadowVoiceMessageDetail>(SHADOW_VOICE_ASSISTANT_EVENT, {
        detail: { conversationKey, message: assistantMessage },
      }));
      if (voiceTurn !== voiceTurnRef.current || !enabledRef.current) {
        executingRef.current = false;
        setPhase(enabledRef.current ? "armed" : "muted");
        if (enabledRef.current) scheduleRecognition();
        return;
      }
      speak(fallback);
    }
  }, [clearListeningTimer, getConversationKey, scheduleRecognition, setPhase, speak, stopRecognition]);

  useEffect(() => { executeCommandRef.current = (command) => { void executeCommand(command); }; }, [executeCommand]);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    const storedEnabled = window.localStorage.getItem(SHADOW_VOICE_ENABLED_KEY) !== "false";
    enabledRef.current = storedEnabled;
    setEnabled(storedEnabled);

    if (!Recognition) {
      setSupported(false);
      setPhase("unsupported");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "es-MX";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => { recognitionRunningRef.current = true; };
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const heard = result?.[0]?.transcript?.trim() ?? "";
        if (!heard) continue;

        const currentPhase = phaseRef.current;
        if (currentPhase === "armed") {
          const wake = heard.match(WAKE_PATTERN);
          if (!wake) continue;
          const command = heard.slice((wake.index ?? 0) + wake[0].length).replace(/^\s*[,.:;-]?\s*/, "").trim();
          setTranscript(command);
          setPhase("listening");
          armListeningTimeout();
          if (result.isFinal && command) executeCommandRef.current(command);
          continue;
        }

        if (currentPhase === "listening") {
          const command = heard.replace(WAKE_PATTERN, " ").replace(/^\s*[,.:;-]?\s*/, "").trim();
          setTranscript(command);
          armListeningTimeout();
          if (result.isFinal && command) executeCommandRef.current(command);
        }
      }
    };
    recognition.onerror = (event) => {
      recognitionRunningRef.current = false;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Permite el micrófono una vez para dejar a Shadow en espera.");
        setPhase("blocked");
        return;
      }
      if (event.error === "no-speech" && phaseRef.current === "listening") {
        setTranscript("");
        setPhase("armed");
      }
    };
    recognition.onend = () => {
      recognitionRunningRef.current = false;
      if (enabledRef.current && !executingRef.current && (phaseRef.current === "armed" || phaseRef.current === "listening")) {
        scheduleRecognition(500);
      }
    };
    recognitionRef.current = recognition;
    setSupported(true);

    if (storedEnabled) {
      setPhase("armed");
      scheduleRecognition(500);
    } else {
      setPhase("muted");
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && enabledRef.current && !executingRef.current) {
        if (phaseRef.current !== "listening") setPhase("armed");
        scheduleRecognition(300);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearRestartTimer();
      clearListeningTimer();
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
      recognitionRunningRef.current = false;
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, [armListeningTimeout, clearListeningTimer, clearRestartTimer, scheduleRecognition, setPhase]);

  const toggleEnabled = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    window.localStorage.setItem(SHADOW_VOICE_ENABLED_KEY, String(next));
    setError(null);

    if (!next) {
      clearListeningTimer();
      voiceTurnRef.current += 1;
      executingRef.current = false;
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      window.speechSynthesis?.cancel();
      stopRecognition();
      setTranscript("");
      setPhase("muted");
      return;
    }

    if (!supported) {
      setPhase("unsupported");
      return;
    }
    setPhase("armed");
    scheduleRecognition(50);
  }, [clearListeningTimer, scheduleRecognition, setPhase, stopRecognition, supported]);

  const listenNow = useCallback(() => {
    if (!supported) {
      setPhase("unsupported");
      return;
    }
    if (phaseRef.current === "listening") {
      setTranscript("");
      clearListeningTimer();
      setPhase(enabledRef.current ? "armed" : "muted");
      return;
    }
    enabledRef.current = true;
    setEnabled(true);
    window.localStorage.setItem(SHADOW_VOICE_ENABLED_KEY, "true");
    setError(null);
    setTranscript("");
    setPhase("listening");
    armListeningTimeout();
    scheduleRecognition(30);
  }, [armListeningTimeout, clearListeningTimer, scheduleRecognition, setPhase, supported]);

  const cancelVoice = useCallback(() => {
    clearListeningTimer();
    voiceTurnRef.current += 1;
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
    }
    window.speechSynthesis?.cancel();
    executingRef.current = false;
    setTranscript("");
    setPhase(enabledRef.current ? "armed" : "muted");
    if (enabledRef.current) scheduleRecognition(300);
  }, [clearListeningTimer, scheduleRecognition, setPhase]);

  const value = useMemo<ShadowVoiceContextValue>(() => ({
    enabled,
    supported,
    phase,
    transcript,
    lastResponse,
    error,
    toggleEnabled,
    listenNow,
    cancelVoice,
  }), [cancelVoice, enabled, error, lastResponse, listenNow, phase, supported, toggleEnabled, transcript]);

  const showHud = phase === "listening" || phase === "processing" || phase === "speaking" || phase === "blocked" || phase === "unsupported";

  return (
    <ShadowVoiceContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {showHud ? (
          <motion.aside
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 left-1/2 z-[70] flex w-[min(430px,calc(100vw-24px))] -translate-x-1/2 items-center gap-3 rounded-[22px] border border-white/[0.09] bg-[#0b0b0b]/95 p-2.5 pr-3 shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur-2xl"
            aria-live="polite"
          >
            <div className="h-14 w-14 shrink-0"><ShadowOrb status={voiceStatus(phase)} /></div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/30">{phaseLabel(phase)}</p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/65">
                {phase === "blocked" ? error : phase === "unsupported" ? "Puedes seguir usando Shadow por texto." : transcript || (phase === "speaking" ? lastResponse : "Di tu instrucción después de Shadow.")}
              </p>
            </div>
            {phase === "blocked" ? (
              <button type="button" onClick={listenNow} className="flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-[9px] font-medium text-black transition active:scale-95" aria-label="Solicitar permiso del micrófono">
                <Mic className="h-3.5 w-3.5" /> Activar
              </button>
            ) : (
              <button type="button" onClick={cancelVoice} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/35 transition hover:bg-white/[0.06] hover:text-white/75" aria-label="Cancelar interacción de voz">
                <X className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={toggleEnabled} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/35 transition hover:bg-white/[0.06] hover:text-white/75" aria-label="Desactivar voz siempre activa">
              <MicOff className="h-4 w-4" />
            </button>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </ShadowVoiceContext.Provider>
  );
}

export function useShadowVoice() {
  const context = useContext(ShadowVoiceContext);
  if (!context) throw new Error("useShadowVoice debe usarse dentro de ShadowVoiceProvider");
  return context;
}
