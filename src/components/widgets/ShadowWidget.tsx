"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, ArrowUpRight, Check, ChevronRight, Mic, MicOff, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { approveShadowAction } from "@/app/actions/shadow-actions";
import { askShadow, getShadowConversation } from "@/app/actions/shadow";
import ShadowOrb from "@/components/ShadowOrb";
import { ShadowLoader } from "@/components/shadow/ai/ShadowLoader";
import { ShadowSuggestions } from "@/components/shadow/ai/ShadowSuggestions";
import { statusFromMood } from "@/components/shadow/face/expressions";
import { STATUS_LABEL } from "@/components/shadow/face/palette";
import { useShadowVoice } from "@/components/shadow/ShadowVoiceProvider";
import type { ShadowStatus } from "@/components/shadow/types";
import { shouldPlayDashboardIntro } from "@/components/dashboard/intro";
import { buildBriefing, greetingFor, OWNER_NAME, type BriefingItem } from "@/components/dashboard/briefing";
import type { DashboardInitialData } from "@/components/dashboard/types";
import { WidgetCard, useWidget } from "@/components/ui/widget";
import { useDashboardShortcut } from "@/hooks/useDashboardShortcut";
import type { PendingShadowAction } from "@/features/shadow/file-actions";

type Message = {
  sender: "USR" | "SHDW";
  text: string;
  mood?: string;
  pendingAction?: PendingShadowAction;
};

const CONVERSATION_KEY = "dashboard:primary";
const SUGGESTIONS = [
  { id: "tarde", label: "Planea mi tarde con lo más importante" },
  { id: "semana", label: "¿Qué tengo pendiente esta semana?" },
  { id: "estado", label: "Resume mi estado y dime qué atacar ahora" },
];

const TONE_DOT: Record<BriefingItem["tone"], string> = {
  focus: "bg-white/70",
  care: "bg-white/35 ring-2 ring-white/10",
  good: "bg-white/20",
};

export default function ShadowWidget({ initialData }: { initialData: DashboardInitialData }) {
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState<ShadowStatus>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [dateLabel, setDateLabel] = useState("Centro de mando");
  const [greeting, setGreeting] = useState("Hola");
  const [briefing, setBriefing] = useState<BriefingItem[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef(new Set<number>());
  /** Se decide una sola vez por montaje (StrictMode ejecuta los efectos dos veces). */
  const introRef = useRef<boolean | null>(null);
  const router = useRouter();
  const { activeWidgetId, setActiveWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "shadow";
  const voice = useShadowVoice();
  const isListening = voice.phase === "listening";
  const voiceStatus: ShadowStatus = voice.phase === "processing" ? "thinking" : voice.phase === "speaking" ? "speaking" : isListening ? "listening" : "idle";
  // Mientras escribes, Shadow presta atención: el mismo gesto que al escucharte.
  const attentive = inputValue.trim().length > 0 ? "listening" : "idle";
  const visibleStatus: ShadowStatus = status !== "idle" ? status : voiceStatus !== "idle" ? voiceStatus : attentive;

  useEffect(() => {
    const now = new Date();
    setDateLabel(new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(now));
    setGreeting(greetingFor(now.getHours()));
    setBriefing(buildBriefing(initialData, now));
  }, [initialData]);

  useEffect(() => {
    let cancelled = false;
    void getShadowConversation(CONVERSATION_KEY).then((result) => {
      if (!cancelled && result.success) setMessages(result.messages.slice(-8));
    });
    const timers = timersRef.current;
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  // Entrada coordinada, una vez por sesión: la cara despierta, el saludo
  // sube palabra por palabra y después llega lo demás.
  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    if (introRef.current === null) introRef.current = shouldPlayDashboardIntro();
    if (!introRef.current) return;
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .from("[data-intro='face']", { scale: 0.6, autoAlpha: 0, duration: 0.7, ease: "back.out(1.6)" })
        .from("[data-intro='word']", { yPercent: 60, autoAlpha: 0, filter: "blur(8px)", duration: 0.55, stagger: 0.06 }, "-=0.45")
        .from("[data-intro='line']", { y: 8, autoAlpha: 0, filter: "blur(6px)", duration: 0.5, stagger: 0.07 }, "-=0.3")
        .from("[data-intro='input']", { y: 10, autoAlpha: 0, duration: 0.5 }, "-=0.35");
    }, hero);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (voice.transcript && isListening) setInputValue(voice.transcript);
    if (isListening) setActiveWidgetId("shadow");
  }, [isListening, setActiveWidgetId, voice.transcript]);

  useDashboardShortcut("/", () => {
    setActiveWidgetId("shadow");
    window.setTimeout(() => inputRef.current?.focus(), 120);
  });

  useEffect(() => {
    if (isExpanded) window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [isExpanded]);

  const later = useCallback((callback: () => void, ms: number) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, ms);
    timersRef.current.add(timer);
  }, []);

  /** Habla, muestra el gesto del resultado un instante y vuelve a reposo. */
  const settle = useCallback((mood: string | undefined, speakingMs: number) => {
    later(() => {
      const finale = statusFromMood(mood);
      setStatus((current) => current === "thinking" ? current : finale);
      if (finale !== "idle") later(() => setStatus((current) => current === "thinking" ? current : "idle"), finale === "error" ? 2_600 : 1_600);
    }, speakingMs);
  }, [later]);

  const processCommand = useCallback(async (rawCommand: string) => {
    const command = rawCommand.trim();
    if (!command || status === "thinking") return;

    setInputValue("");
    setStatus("thinking");
    setMessages((current) => [...current, { sender: "USR" as const, text: command }].slice(-10));
    try {
      const result = await askShadow({ message: command, conversationKey: CONVERSATION_KEY, channel: "dashboard" });
      setMessages((current) => [...current, {
        sender: "SHDW" as const,
        text: result.text,
        mood: result.mood,
        pendingAction: result.pendingAction,
      }].slice(-10));
      router.refresh();
      setStatus("speaking");
      settle(result.mood, Math.min(2_200, Math.max(900, result.text.split(/\s+/).length * 45)));
    } catch {
      setMessages((current) => [...current, { sender: "SHDW" as const, text: "No pude completar la solicitud.", mood: "urgent" }].slice(-10));
      setStatus("error");
      settle(undefined, 2_600);
    }
  }, [router, settle, status]);

  const decideAction = async (action: PendingShadowAction, approved: boolean) => {
    setMessages((current) => current.map((message) => message.pendingAction?.id === action.id ? { ...message, pendingAction: undefined } : message));
    if (!approved) {
      setMessages((current) => [...current, { sender: "SHDW" as const, text: "Acción cancelada. No cambié nada.", mood: "neutral" }].slice(-10));
      return;
    }
    setStatus("thinking");
    const result = await approveShadowAction(action.id);
    const mood = result.success ? "success" : "urgent";
    setMessages((current) => [...current, { sender: "SHDW" as const, text: result.message, mood }].slice(-10));
    setStatus(statusFromMood(mood));
    settle(undefined, 1_800);
  };

  const lastShadowMessage = messages.toReversed().find((message) => message.sender === "SHDW");
  const pendingAction = messages.toReversed().find((message) => message.pendingAction)?.pendingAction;
  const visibleMessages = isExpanded ? messages.slice(-6) : [];
  const shadowLine =
    visibleStatus === "listening" ? (inputValue ? "Te sigo…" : "Te escucho…")
      : visibleStatus === "thinking" ? null
        : visibleStatus === "speaking" ? voice.lastResponse || lastShadowMessage?.text
          : lastShadowMessage?.text || "Dime qué quieres lograr; yo conecto las piezas.";

  return (
    <WidgetCard
      id="shadow"
      defaultClassName="min-h-[360px] md:col-span-6 xl:col-span-8"
      expandedClassName="min-h-[540px] md:col-span-6 xl:col-span-12"
      shrunkClassName="min-h-[200px] md:col-span-6 xl:col-span-8"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-white/[0.022] blur-[90px]" />

      <div ref={heroRef} className="relative z-10 flex h-full min-h-[312px] flex-col">
        <div className="flex items-center justify-between" data-intro="line">
          <div className="flex items-center gap-2.5">
            <motion.span
              animate={{ opacity: visibleStatus === "idle" ? 0.35 : 1 }}
              className="h-1.5 w-1.5 rounded-full bg-white"
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
              Shadow · {visibleStatus === "idle" ? dateLabel : STATUS_LABEL[visibleStatus]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={voice.toggleEnabled}
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition active:scale-95 ${isListening ? "bg-white/[0.09] text-white" : "text-white/30 hover:bg-white/[0.045] hover:text-white/70"}`}
              aria-label={voice.enabled ? "Desactivar voz siempre activa" : "Activar voz siempre activa"}
            >
              {voice.enabled ? <Mic className={`h-3.5 w-3.5 ${isListening ? "animate-pulse" : ""}`} /> : <MicOff className="h-3.5 w-3.5" />}
            </button>
            <Link href="/shadow" data-no-expand className="flex h-8 items-center gap-1 rounded-xl px-2.5 text-[10px] text-white/30 transition hover:bg-white/[0.045] hover:text-white/70 active:scale-[0.98]">
              Abrir <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className={`grid flex-1 items-center gap-6 py-6 ${isExpanded ? "lg:grid-cols-[0.72fr_1.28fr]" : ""}`}>
          <div className={`flex items-center ${isExpanded ? "justify-center" : "gap-6"}`}>
            <div data-intro="face" className={`${isExpanded ? "h-32 w-32" : "h-24 w-24 sm:h-28 sm:w-28"} shrink-0`}>
              <ShadowOrb status={visibleStatus} />
            </div>
            {!isExpanded && (
              <div className="min-w-0 flex-1">
                <p className="text-[26px] font-light leading-none tracking-[-0.045em] text-white/90 sm:text-[30px]" aria-label={`${greeting}, ${OWNER_NAME}.`}>
                  {`${greeting}, ${OWNER_NAME}.`.split(" ").map((word, index) => (
                    <span key={`${word}-${index}`} data-intro="word" className="mr-[0.24em] inline-block" aria-hidden="true">{word}</span>
                  ))}
                </p>
                <div data-intro="line" className="mt-3 min-h-[2.6em]" aria-live="polite">
                  <AnimatePresence mode="wait" initial={false}>
                    {shadowLine === null ? (
                      <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <ShadowLoader variant="dots" label="Conectando las piezas" showElapsed />
                      </motion.div>
                    ) : (
                      <motion.p
                        key={shadowLine}
                        initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="line-clamp-2 max-w-xl text-[13px] leading-relaxed text-white/45"
                      >
                        {shadowLine}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          {!isExpanded && briefing && briefing.length > 0 ? (
            <div data-no-expand className="border-t border-white/[0.05] pt-4">
              <p data-intro="line" className="mb-2.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/22">Lo importante ahora</p>
              <ul className="grid gap-1 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] sm:gap-2">
                {briefing.map((item) => (
                  <li key={item.id} data-intro="line">
                    <Link href={item.href} className="group flex h-full items-start gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.035]">
                      <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[item.tone]}`} />
                      <span className="flex-1 text-[11px] leading-snug text-white/55 transition-colors group-hover:text-white/85">{item.label}</span>
                      <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-white/0 transition-colors group-hover:text-white/40" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="max-h-[280px] space-y-3 overflow-y-auto border-l border-white/[0.055] pl-5 pr-2">
                {visibleMessages.length === 0 ? (
                  <div className="flex min-h-40 items-center justify-center text-xs text-white/25">La conversación aparecerá aquí.</div>
                ) : visibleMessages.map((message, index) => (
                  <div key={`${message.sender}-${index}`} className={message.sender === "USR" ? "pl-12 text-right" : "flex gap-2.5 pr-12"}>
                    {message.sender === "SHDW" ? <div className="mt-0.5 h-5 w-5 shrink-0"><ShadowOrb mood={message.mood} hideBackground paused /></div> : null}
                    <div className="min-w-0">
                      <p className="mb-1 font-mono text-[8px] uppercase tracking-widest text-white/20">{message.sender === "USR" ? "Tú" : "Shadow"}</p>
                      <p className="text-[12px] leading-relaxed text-white/60">{message.text}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {pendingAction && (
          <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3 sm:flex-row sm:items-center">
            <p className="flex-1 text-[11px] text-white/55">{pendingAction.label}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void decideAction(pendingAction, true)} className="flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[10px] font-medium text-[#111111] transition active:scale-[0.98]"><Check className="h-3 w-3" />Confirmar</button>
              <button type="button" onClick={() => void decideAction(pendingAction, false)} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 text-[10px] text-white/45 transition hover:text-white/75 active:scale-[0.98]"><X className="h-3 w-3" />Cancelar</button>
            </div>
          </div>
        )}

        <form data-intro="input" onSubmit={(event) => { event.preventDefault(); void processCommand(inputValue); }} className="relative" data-no-expand>
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={isListening ? "Escuchando…" : "Dile a Shadow qué debe resolver o actualizar…"}
            disabled={status === "thinking"}
            className="os-message-input h-13 w-full rounded-2xl border border-white/[0.075] bg-white/[0.025] pl-4 pr-14 text-[13px] text-white/80 outline-none transition placeholder:text-white/20 focus:border-white/[0.17] focus:bg-white/[0.04]"
            aria-label="Comando para Shadow"
          />
          <motion.button
            type="submit"
            disabled={!inputValue.trim() || status === "thinking"}
            animate={{ scale: inputValue.trim() ? 1 : 0.92 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-white text-[#111111] transition-colors hover:bg-white/90 disabled:opacity-25"
            aria-label="Enviar comando"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        </form>

        {!isExpanded && !lastShadowMessage && (
          <div className="mt-3" data-no-expand>
            <ShadowSuggestions suggestions={SUGGESTIONS} disabled={status === "thinking"} onSelect={(suggestion) => void processCommand(suggestion.label)} />
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
