"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Check, ChevronRight, CircleDot, Mic, MicOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { approveShadowAction } from "@/app/actions/shadow-actions";
import { askShadow, getShadowConversation } from "@/app/actions/shadow";
import ShadowOrb from "@/components/ShadowOrb";
import { useShadowVoice } from "@/components/shadow/ShadowVoiceProvider";
import type { ShadowStatus } from "@/components/shadow/types";
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
const suggestions = [
  "Planea mi tarde con lo más importante",
  "¿Qué tengo pendiente esta semana?",
  "Resume mi estado y dime qué atacar ahora",
];

export default function ShadowWidget() {
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState<ShadowStatus>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [dateLabel, setDateLabel] = useState("Centro de mando");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { activeWidgetId, setActiveWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "shadow";
  const voice = useShadowVoice();
  const isListening = voice.phase === "listening";
  const voiceStatus: ShadowStatus = voice.phase === "processing" ? "thinking" : voice.phase === "speaking" ? "speaking" : isListening ? "listening" : "idle";
  const visibleStatus = status === "idle" ? voiceStatus : status;

  useEffect(() => {
    setDateLabel(new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(new Date()));
    let cancelled = false;
    void getShadowConversation(CONVERSATION_KEY).then((result) => {
      if (!cancelled && result.success) setMessages(result.messages.slice(-8));
    });
    return () => { cancelled = true; };
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
      window.setTimeout(() => setStatus("idle"), 900);
    } catch {
      setMessages((current) => [...current, { sender: "SHDW" as const, text: "No pude completar la solicitud.", mood: "urgent" }].slice(-10));
      setStatus("idle");
    }
  }, [router, status]);

  const decideAction = async (action: PendingShadowAction, approved: boolean) => {
    setMessages((current) => current.map((message) => message.pendingAction?.id === action.id ? { ...message, pendingAction: undefined } : message));
    if (!approved) {
      setMessages((current) => [...current, { sender: "SHDW" as const, text: "Acción cancelada. No cambié nada.", mood: "neutral" }].slice(-10));
      return;
    }
    setStatus("thinking");
    const result = await approveShadowAction(action.id);
    setMessages((current) => [...current, { sender: "SHDW" as const, text: result.message, mood: result.success ? "success" : "urgent" }].slice(-10));
    setStatus("idle");
  };

  const lastShadowMessage = messages.toReversed().find((message) => message.sender === "SHDW");
  const pendingAction = messages.toReversed().find((message) => message.pendingAction)?.pendingAction;
  const visibleMessages = isExpanded ? messages.slice(-6) : [];

  return (
    <WidgetCard
      id="shadow"
      defaultClassName="min-h-[330px] md:col-span-6 xl:col-span-8"
      expandedClassName="min-h-[520px] md:col-span-6 xl:col-span-12"
      shrunkClassName="min-h-[190px] md:col-span-6 xl:col-span-8"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-white/[0.022] blur-[90px]" />

      <div className="relative z-10 flex h-full min-h-[282px] flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`h-1.5 w-1.5 rounded-full ${status === "thinking" ? "animate-pulse bg-white" : "bg-white/35"}`} />
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">Shadow · {dateLabel}</span>
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

        <div className={`grid flex-1 items-center gap-6 py-7 ${isExpanded ? "lg:grid-cols-[0.72fr_1.28fr]" : "sm:grid-cols-[auto_1fr]"}`}>
          <div className={`flex items-center ${isExpanded ? "justify-center" : "gap-5"}`}>
            <motion.div
              animate={{ scale: visibleStatus === "thinking" ? 1.06 : 1 }}
              transition={{ type: "spring", stiffness: 150, damping: 20 }}
              className={`${isExpanded ? "h-28 w-28" : "h-20 w-20"} shrink-0`}
            >
              <ShadowOrb status={visibleStatus} hideBackground />
            </motion.div>
            {!isExpanded && (
              <div className="min-w-0">
                <p className="text-[11px] text-white/30">Tu sistema está listo</p>
                <p aria-live="polite" className="mt-1 line-clamp-3 max-w-xl text-lg font-light leading-snug tracking-[-0.025em] text-white/80">
                  {visibleStatus === "listening" ? "Te escucho…" : visibleStatus === "thinking" ? "Entendiendo el contexto y ejecutando…" : visibleStatus === "speaking" ? voice.lastResponse || lastShadowMessage?.text : lastShadowMessage?.text || "Dime qué quieres lograr; yo conecto las piezas."}
                </p>
              </div>
            )}
          </div>

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="max-h-[280px] space-y-3 overflow-y-auto border-l border-white/[0.055] pl-5 pr-2">
                {visibleMessages.length === 0 ? (
                  <div className="flex min-h-40 items-center justify-center text-xs text-white/25">La conversación aparecerá aquí.</div>
                ) : visibleMessages.map((message, index) => (
                  <div key={`${message.sender}-${index}`} className={message.sender === "USR" ? "pl-12 text-right" : "pr-12"}>
                    <p className="mb-1 font-mono text-[8px] uppercase tracking-widest text-white/20">{message.sender === "USR" ? "Tú" : "Shadow"}</p>
                    <p className="text-[12px] leading-relaxed text-white/60">{message.text}</p>
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
              <button type="button" onClick={() => void decideAction(pendingAction, true)} className="flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[10px] font-medium text-[#111] transition active:scale-[0.98]"><Check className="h-3 w-3" />Confirmar</button>
              <button type="button" onClick={() => void decideAction(pendingAction, false)} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 text-[10px] text-white/45 transition hover:text-white/75 active:scale-[0.98]"><X className="h-3 w-3" />Cancelar</button>
            </div>
          </div>
        )}

        <form onSubmit={(event) => { event.preventDefault(); void processCommand(inputValue); }} className="relative" data-no-expand>
          <CircleDot className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={isListening ? "Escuchando…" : "Dile a Shadow qué debe resolver o actualizar…"}
            disabled={status === "thinking"}
            className="os-message-input h-13 w-full rounded-2xl border border-white/[0.075] bg-white/[0.025] pl-11 pr-14 text-[13px] text-white/80 outline-none transition placeholder:text-white/20 focus:border-white/[0.17] focus:bg-white/[0.04]"
            aria-label="Comando para Shadow"
          />
          <button type="submit" disabled={!inputValue.trim() || status === "thinking"} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-white text-[#111] transition hover:bg-white/90 active:scale-[0.96] disabled:opacity-25" aria-label="Enviar comando">
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>

        {!isExpanded && !lastShadowMessage && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" data-no-expand>
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => void processCommand(suggestion)} className="shrink-0 rounded-full border border-white/[0.06] px-3 py-1.5 text-[9px] text-white/30 transition hover:border-white/[0.12] hover:text-white/65 active:scale-[0.98]">{suggestion}</button>
            ))}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
