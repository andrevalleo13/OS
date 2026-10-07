"use client";

import { memo, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  History,
  MoreHorizontal,
  PanelRight,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import ShadowOrb from "@/components/ShadowOrb";
import { ShadowConversation } from "@/components/shadow/ai/ShadowConversation";
import { ShadowLoader } from "@/components/shadow/ai/ShadowLoader";
import { ShadowResponse } from "@/components/shadow/ai/ShadowResponse";
import { ShadowSources } from "@/components/shadow/ai/ShadowSources";
import { ShadowSuggestions } from "@/components/shadow/ai/ShadowSuggestions";
import { STATUS_LABEL } from "@/components/shadow/face/palette";
import { ShadowWidgetRenderer } from "@/components/widgets/ShadowWidgetRenderer";
import type { PendingShadowAction } from "@/features/shadow/file-actions";
import type { ShadowMessage, ShadowStatus } from "./types";

type Props = {
  title: string;
  logs: ShadowMessage[];
  status: ShadowStatus;
  loading: boolean;
  error: string | null;
  motionPaused: boolean;
  onToggleMotion: () => void;
  onOpenHistory: () => void;
  onOpenContext: () => void;
  onRetryLoad: () => void;
  onSuggestion: (value: string) => void;
  onActionDecision: (messageId: string, action: PendingShadowAction, approved: boolean) => void;
};

const SUGGESTIONS = [
  { id: "organizar", eyebrow: "ORGANIZAR", label: "Planea el resto de mi día" },
  { id: "situacion", eyebrow: "SITUACIÓN", label: "¿Qué merece mi atención ahora?" },
  { id: "cierre", eyebrow: "CIERRE", label: "Ayúdame a cerrar el día" },
];

export function ShadowWorkspace({
  title,
  logs,
  status,
  loading,
  error,
  motionPaused,
  onToggleMotion,
  onOpenHistory,
  onOpenContext,
  onRetryLoad,
  onSuggestion,
  onActionDecision,
}: Props) {
  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#090909]">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_50%_-10%,rgba(255,255,255,0.055),transparent_34rem),linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] [background-size:auto,44px_44px,44px_44px]" />

      <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.055] bg-[#0b0b0b]/80 px-3 backdrop-blur-xl sm:px-5">
        <button onClick={onOpenHistory} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/35 transition hover:bg-white/[0.05] hover:text-white/75 active:scale-95 xl:hidden" aria-label="Abrir conversaciones">
          <History className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
          <ShadowOrb status={status} hideBackground paused={motionPaused} gaze={false} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium tracking-[-0.01em] text-white/80">{title}</p>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.15em] text-white/22">
            {status === "idle" ? "Contexto listo" : STATUS_LABEL[status]}
          </p>
        </div>
        <button onClick={onToggleMotion} className="hidden h-8 items-center gap-2 rounded-lg px-2 text-[9px] text-white/25 transition hover:bg-white/[0.04] hover:text-white/60 sm:flex" aria-label={motionPaused ? "Reanudar animaciones" : "Pausar animaciones"}>
          {motionPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {motionPaused ? "Reanudar" : "Pausar"}
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 transition hover:bg-white/[0.04] hover:text-white/60" aria-label="Opciones de conversación">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <button onClick={onOpenContext} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/35 transition hover:bg-white/[0.05] hover:text-white/75 active:scale-95 xl:hidden" aria-label="Abrir contexto">
          <PanelRight className="h-4 w-4" />
        </button>
      </header>

      <main className="relative z-10 min-h-0 flex-1">
        {loading ? <ConversationSkeleton /> : error ? <ConversationError message={error} onRetry={onRetryLoad} /> : logs.length === 0 ? (
          <EmptyConversation status={status} motionPaused={motionPaused} onSuggestion={onSuggestion} />
        ) : (
          <MessageTimeline logs={logs} status={status} motionPaused={motionPaused} onActionDecision={onActionDecision} />
        )}
      </main>
    </div>
  );
}

const EmptyConversation = memo(function EmptyConversation({ status, motionPaused, onSuggestion }: { status: ShadowStatus; motionPaused: boolean; onSuggestion: (value: string) => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto px-5 py-8 sm:justify-center sm:py-10">
      <motion.div initial={{ opacity: 0, scale: 0.86, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 160, damping: 18 }} className="relative h-32 w-32 sm:h-40 sm:w-40">
        <ShadowOrb status={status} paused={motionPaused} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="mt-7 text-center">
        <p className="text-xl font-light tracking-[-0.04em] text-white/85 sm:text-2xl">¿Qué vamos a resolver?</p>
        <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-white/30 sm:text-xs">Este es un contexto nuevo. Shadow conserva tu memoria personal, pero este hilo comienza limpio.</p>
      </motion.div>
      <ShadowSuggestions
        variant="cards"
        suggestions={SUGGESTIONS}
        disabled={status === "thinking"}
        onSelect={(suggestion) => onSuggestion(suggestion.label)}
        className="mt-8 max-w-2xl"
      />
    </div>
  );
});

function MessageTimeline({ logs, status, motionPaused, onActionDecision }: { logs: ShadowMessage[]; status: ShadowStatus; motionPaused: boolean; onActionDecision: Props["onActionDecision"] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyMessage = async (message: ShadowMessage) => {
    await navigator.clipboard.writeText(message.text);
    setCopiedId(message.id);
    window.setTimeout(() => setCopiedId(null), 1300);
  };

  return (
    <ShadowConversation contentKey={`${logs.length}:${status}`} innerClassName="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-8 pb-8">
        <div className="flex items-center gap-3"><span className="h-px flex-1 bg-white/[0.045]" /><span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/18">Hoy</span><span className="h-px flex-1 bg-white/[0.045]" /></div>
        {logs.map((message) => {
          const user = message.sender === "USR";
          return (
            <motion.article key={message.id} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className={`group/message relative ${user ? "ml-auto max-w-[82%] sm:max-w-[72%]" : "max-w-full"}`}>
              {user ? (
                <div className={`rounded-[18px] rounded-tr-md border px-4 py-3 text-[13px] leading-relaxed ${message.failed ? "border-white/15 bg-white/[0.025] text-white/45" : "border-white/[0.065] bg-white/[0.055] text-white/68"}`}>
                  {message.text}
                  {message.failed ? <p className="mt-2 flex items-center gap-1.5 text-[9px] text-white/30"><RefreshCw className="h-3 w-3" /> No se pudo enviar</p> : null}
                </div>
              ) : (
                <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 sm:grid-cols-[32px_minmax(0,1fr)] sm:gap-4">
                  <div className="mt-0.5 h-7 w-7 sm:h-8 sm:w-8"><ShadowOrb mood={message.mood} hideBackground paused /></div>
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2"><span className="text-[10px] font-medium text-white/60">Shadow</span>{message.createdAt ? <time className="font-mono text-[8px] text-white/18">{new Date(message.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</time> : null}</div>
                    <ShadowResponse text={message.text} createdAt={message.createdAt} reveal={!motionPaused} />
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                      {message.sources?.length ? <ShadowSources sources={message.sources} /> : null}
                      <button onClick={() => void copyMessage(message)} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[8px] text-white/0 transition hover:bg-white/[0.035] hover:text-white/45 group-hover/message:text-white/20 focus-visible:text-white/45" aria-label="Copiar respuesta">
                        {copiedId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copiedId === message.id ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!user && message.widget && message.widget !== "none" ? <div className="ml-10 mt-3 sm:ml-12"><ShadowWidgetRenderer widget={message.widget} /></div> : null}
              {!user && message.pendingAction ? (
                <ActionReview messageId={message.id} action={message.pendingAction} onDecision={onActionDecision} />
              ) : null}
            </motion.article>
          );
        })}
        <AnimatePresence>{status === "thinking" ? <ThinkingTrace motionPaused={motionPaused} /> : null}</AnimatePresence>
      </div>
    </ShadowConversation>
  );
}

const THINKING_STEPS = ["Interpretando", "Leyendo tu contexto", "Construyendo respuesta"];

function ThinkingTrace({ motionPaused }: { motionPaused: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setStep((current) => Math.min(current + 1, THINKING_STEPS.length - 1)), 1400);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 sm:grid-cols-[32px_minmax(0,1fr)] sm:gap-4">
      <div className="h-7 w-7 sm:h-8 sm:w-8"><ShadowOrb status="thinking" hideBackground paused={motionPaused} gaze={false} /></div>
      <div className="flex flex-col gap-2.5 pt-1.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={step} initial={{ opacity: 0, y: 4, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -4, filter: "blur(4px)" }} transition={{ duration: 0.22 }}>
            <ShadowLoader variant="dots" label={THINKING_STEPS[step]} showElapsed />
          </motion.span>
        </AnimatePresence>
        <ShadowLoader variant="bar" />
      </div>
    </motion.div>
  );
}

function ActionReview({ messageId, action, onDecision }: { messageId: string; action: PendingShadowAction; onDecision: Props["onActionDecision"] }) {
  return (
    <div className="ml-10 mt-4 max-w-xl border-y border-white/[0.075] bg-white/[0.018] py-4 sm:ml-12">
      <div className="flex items-start gap-3"><span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035]"><ShieldCheck className="h-3.5 w-3.5 text-white/45" /></span><div className="min-w-0 flex-1"><p className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/25">Revisión requerida</p><p className="mt-1.5 text-[11px] leading-relaxed text-white/60">{action.label}</p></div></div>
      <div className="mt-4 flex gap-2 pl-10"><button onClick={() => onDecision(messageId, action, true)} className="rounded-xl bg-white px-3 py-2 text-[10px] font-medium text-black transition hover:bg-white/90 active:scale-95">Confirmar acción</button><button onClick={() => onDecision(messageId, action, false)} className="rounded-xl border border-white/[0.075] px-3 py-2 text-[10px] text-white/40 transition hover:bg-white/[0.04] hover:text-white/70 active:scale-95">Cancelar</button></div>
    </div>
  );
}

function ConversationSkeleton() {
  return <div className="mx-auto max-w-3xl space-y-7 px-5 py-10"><div className="h-2 w-20 animate-pulse rounded-full bg-white/[0.055]" />{[0, 1, 2].map((item) => <div key={item} className={`animate-pulse ${item === 1 ? "ml-auto w-2/3" : "w-full"}`}><div className="h-3 w-24 rounded-full bg-white/[0.05]" /><div className="mt-3 h-3 w-full rounded-full bg-white/[0.035]" /><div className="mt-2 h-3 w-4/5 rounded-full bg-white/[0.025]" /></div>)}</div>;
}

function ConversationError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex h-full items-center justify-center p-6 text-center"><div><p className="text-sm text-white/60">No pude cargar este contexto.</p><p className="mt-2 text-[10px] text-white/25">{message}</p><button onClick={onRetry} className="mx-auto mt-5 flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-[10px] text-white/50 transition hover:bg-white/[0.04] hover:text-white"><RefreshCw className="h-3.5 w-3.5" /> Reintentar</button></div></div>;
}
