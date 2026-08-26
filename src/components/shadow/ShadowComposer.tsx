"use client";

import { ArrowUp, Command, LoaderCircle, Mic, MicOff } from "lucide-react";
import type { ShadowVoicePhase } from "./ShadowVoiceProvider";
import type { ComposerMode, ShadowStatus } from "./types";

const MODES: Array<{ id: ComposerMode; label: string }> = [
  { id: "ask", label: "Pregunta" },
  { id: "plan", label: "Plan" },
  { id: "act", label: "Actúa" },
];

export function ShadowComposer({
  value,
  mode,
  status,
  onChange,
  onModeChange,
  onSubmit,
  onListening,
  voiceEnabled,
  voicePhase,
}: {
  value: string;
  mode: ComposerMode;
  status: ShadowStatus;
  onChange: (value: string) => void;
  onModeChange: (mode: ComposerMode) => void;
  onSubmit: () => void;
  onListening: () => void;
  voiceEnabled: boolean;
  voicePhase: ShadowVoicePhase;
}) {
  const busy = status === "thinking";
  const listening = voicePhase === "listening";
  const voiceBusy = voicePhase === "processing" || voicePhase === "speaking";
  const placeholders: Record<ComposerMode, string> = {
    ask: "Pregúntale a Shadow…",
    plan: "Describe el resultado que quieres planear…",
    act: "Dale una instrucción concreta…",
  };

  return (
    <div className="border-t border-white/[0.055] bg-[#0b0b0b]/92 px-3 py-3 backdrop-blur-2xl sm:px-5 sm:py-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-1" aria-label="Modo de interacción">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onModeChange(item.id)}
                className={`rounded-lg px-2 py-1 text-[9px] transition active:scale-95 ${mode === item.id ? "bg-white/[0.09] text-white/75" : "text-white/25 hover:text-white/55"}`}
                aria-pressed={mode === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="hidden items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.13em] text-white/18 sm:flex"><Command className="h-3 w-3" /> Enter para enviar</span>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="group relative rounded-[22px] border border-white/[0.075] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_55px_rgba(0,0,0,0.28)] transition focus-within:border-white/[0.18] focus-within:bg-white/[0.045]">
          <div className="flex items-end gap-2 p-2">
            <button
              type="button"
              onClick={onListening}
              disabled={voiceBusy}
              className={`mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-30 ${listening ? "bg-white/[0.09] text-white" : "text-white/30 hover:bg-white/[0.055] hover:text-white/70"}`}
              aria-label={listening ? "Dejar de escuchar" : "Hablar con Shadow ahora"}
            >
              {voiceEnabled ? <Mic className={`h-4 w-4 ${listening ? "animate-pulse" : ""}`} /> : <MicOff className="h-4 w-4" />}
            </button>
            <textarea
              rows={1}
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
                event.target.style.height = "auto";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              placeholder={placeholders[mode]}
              className="os-message-input min-h-11 max-h-40 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-3 text-[14px] leading-relaxed text-white/85 outline-none placeholder:text-white/20"
              disabled={busy}
              aria-label="Mensaje para Shadow"
            />
            <button type="submit" disabled={!value.trim() || busy} className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:scale-[1.03] active:scale-95 disabled:opacity-25 disabled:hover:scale-100" aria-label="Enviar mensaje">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4 stroke-[2.4]" />}
            </button>
          </div>
        </form>
        <p className="mt-2 text-center text-[9px] text-white/16">{voiceEnabled ? "Voz activa · Di “Shadow” y después tu instrucción." : "Voz pausada · Actívala desde el micrófono."} Las acciones sensibles siempre requieren confirmación.</p>
      </div>
    </div>
  );
}
