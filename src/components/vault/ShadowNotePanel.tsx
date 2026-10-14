"use client";

import { useCallback, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, RefreshCw, ShieldCheck } from "lucide-react";
import ShadowOrb from "@/components/ShadowOrb";
import { ShadowConversation } from "@/components/shadow/ai/ShadowConversation";
import { ShadowLoader } from "@/components/shadow/ai/ShadowLoader";
import { ShadowResponse } from "@/components/shadow/ai/ShadowResponse";
import { ShadowSources } from "@/components/shadow/ai/ShadowSources";
import { ShadowSteps } from "@/components/shadow/ai/ShadowSteps";
import { ShadowSuggestions, type ShadowSuggestion } from "@/components/shadow/ai/ShadowSuggestions";
import { STATUS_LABEL } from "@/components/shadow/face/palette";
import type { ShadowMessage, ShadowStatus } from "@/components/shadow/types";
import { useShadowChat } from "@/components/shadow/useShadowChat";
import type { PendingShadowAction } from "@/features/shadow/file-actions";
import { NOTE_WRITE_TOOLS } from "@/features/shadow/sources";
import { refreshVault, useVaultSnapshot } from "./useVault";

/** Hilo propio de la bóveda: no se mezcla con las conversaciones de /shadow. */
export const VAULT_CONVERSATION_KEY = "vault";
const VAULT_CACHE_KEY = "valleos.shadow.vault-cache.v1";
const COMPOSER_MAX_HEIGHT = 144;

const QUICK_ACTIONS: ShadowSuggestion[] = [
  { id: "resumen", label: "Resume esta nota" },
  { id: "conectar", label: "Conecta esta nota con el resto" },
  { id: "falta", label: "¿Qué le falta?" },
  { id: "diario", label: "Pásalo al diario de hoy" },
];

type Props = {
  notePath: string | null;
  onOpenNote: (path: string) => void;
};

function noteTitle(notePath: string) {
  return (notePath.split("/").pop() ?? notePath).replace(/\.md$/i, "");
}

/**
 * Shadow en la barra lateral de la bóveda: un chat compacto que siempre
 * recibe la nota abierta como contexto, ofrece atajos para trabajar sobre
 * ella y refresca el explorador cuando Shadow escribe en la bóveda.
 */
export function ShadowNotePanel({ notePath, onOpenNote }: Props) {
  const { resolve } = useVaultSnapshot();
  const chat = useShadowChat({
    conversationKey: VAULT_CONVERSATION_KEY,
    storageKey: VAULT_CACHE_KEY,
    onResult: (_key, _result, steps) => {
      if (steps.some((step) => step.tool && NOTE_WRITE_TOOLS.has(step.tool))) refreshVault();
    },
  });
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { messages, status, send } = chat;
  const busy = status === "thinking";
  const title = notePath ? noteTitle(notePath) : null;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, [draft]);

  const ask = useCallback((text: string) => {
    if (!text.trim() || busy) return false;
    void send(text, { notePath });
    return true;
  }, [busy, notePath, send]);

  const submitDraft = () => {
    if (ask(draft)) setDraft("");
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitDraft();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submitDraft();
  };

  const openSource = useCallback((target: string) => onOpenNote(resolve(target) ?? target), [onOpenNote, resolve]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.05] px-3 py-2.5">
        <div className="h-6 w-6 shrink-0">
          <ShadowOrb status={status} hideBackground gaze={false} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-white/40" title={notePath ?? undefined}>
            {title ? <>Hablando sobre: <span className="text-white/80">{title}</span></> : "Sin nota abierta"}
          </p>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.15em] text-white/22">
            {status === "idle" ? "Ve lo que tienes abierto" : STATUS_LABEL[status]}
          </p>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {!chat.hydrated || (chat.loading && messages.length === 0) ? (
          <PanelSkeleton />
        ) : chat.error ? (
          <PanelError message={chat.error} onRetry={chat.retryLoad} />
        ) : messages.length === 0 ? (
          <EmptyPanel status={status} hasNote={Boolean(title)} />
        ) : (
          <ShadowConversation contentKey={`${messages.length}:${status}`} innerClassName="px-3 py-4">
            <div className="space-y-5 pb-2">
              {messages.map((message) => (
                <PanelMessage
                  key={message.id}
                  message={message}
                  onOpenNote={openSource}
                  onDecision={(action, approved) => void chat.decideAction(message.id, action, approved)}
                />
              ))}
              {busy && !messages.at(-1)?.streaming ? <ShadowLoader variant="dots" label="Entendiendo" showElapsed /> : null}
            </div>
          </ShadowConversation>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.05] px-2 pb-2 pt-2.5">
        {title ? (
          <ShadowSuggestions
            suggestions={QUICK_ACTIONS}
            disabled={busy}
            onSelect={(suggestion) => ask(suggestion.label)}
            className="mb-2.5 px-1"
          />
        ) : null}
        <form onSubmit={onSubmit} className="flex items-end gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5 transition-colors focus-within:border-white/[0.16]">
          <label htmlFor="shadow-note-composer" className="sr-only">Mensaje para Shadow</label>
          <textarea
            id="shadow-note-composer"
            ref={textareaRef}
            rows={1}
            value={draft}
            maxLength={20_000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={title ? `Pregunta sobre ${title}…` : "Escríbele a Shadow…"}
            className="min-h-[28px] flex-1 resize-none bg-transparent px-1.5 py-1 text-[12px] leading-relaxed text-white/80 outline-none placeholder:text-white/20"
            style={{ maxHeight: COMPOSER_MAX_HEIGHT }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || busy}
            aria-label="Enviar mensaje"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-black transition hover:bg-white/90 active:scale-95 disabled:bg-white/[0.06] disabled:text-white/25"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </form>
        <p className="mt-1.5 px-1 font-mono text-[8px] text-white/18">Enter envía · Shift+Enter nueva línea</p>
      </div>
    </div>
  );
}

function PanelMessage({
  message,
  onOpenNote,
  onDecision,
}: {
  message: ShadowMessage;
  onOpenNote: (path: string) => void;
  onDecision: (action: PendingShadowAction, approved: boolean) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const user = message.sender === "USR";
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={user ? "ml-auto w-fit max-w-[88%]" : "min-w-0"}
    >
      {user ? (
        <div className={`whitespace-pre-wrap break-words rounded-2xl rounded-tr-md border px-3 py-2 text-[12px] leading-relaxed ${message.failed ? "border-white/15 bg-white/[0.025] text-white/45" : "border-white/[0.06] bg-white/[0.05] text-white/70"}`}>
          {message.text}
        </div>
      ) : (
        <>
          {message.streaming && message.steps?.length ? <ShadowSteps steps={message.steps} className={message.text ? "mb-2" : ""} /> : null}
          {message.text ? (
            <div className="[&_.prose]:text-[12px]">
              <ShadowResponse text={message.text} createdAt={message.createdAt} streaming={message.streaming} />
            </div>
          ) : null}
          {!message.streaming && message.sources?.length ? <ShadowSources sources={message.sources} onOpenNote={onOpenNote} className="mt-2" /> : null}
          {message.pendingAction ? <ActionReview action={message.pendingAction} onDecision={onDecision} /> : null}
        </>
      )}
    </motion.div>
  );
}

function ActionReview({ action, onDecision }: { action: PendingShadowAction; onDecision: (action: PendingShadowAction, approved: boolean) => void }) {
  return (
    <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
        <div className="min-w-0">
          <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/25">Revisión requerida</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/60">{action.label}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-1.5 pl-5">
        <button type="button" onClick={() => onDecision(action, true)} className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-medium text-black transition hover:bg-white/90 active:scale-95">Confirmar</button>
        <button type="button" onClick={() => onDecision(action, false)} className="rounded-lg border border-white/[0.075] px-2.5 py-1.5 text-[10px] text-white/40 transition hover:bg-white/[0.04] hover:text-white/70 active:scale-95">Cancelar</button>
      </div>
    </div>
  );
}

function EmptyPanel({ status, hasNote }: { status: ShadowStatus; hasNote: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", bounce: 0.1, duration: 0.3 }} className="h-12 w-12">
        <ShadowOrb status={status} hideBackground gaze={false} />
      </motion.div>
      <p className="mt-4 text-[12px] text-white/70">{hasNote ? "Trabajemos sobre esta nota" : "Abre una nota"}</p>
      <p className="mt-1.5 text-[10px] leading-relaxed text-white/30">
        {hasNote
          ? "Puedo resumirla, conectarla con el resto de tu bóveda o pasar lo importante al diario."
          : "Shadow ve la nota que tengas abierta mientras hablan."}
      </p>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-5 px-3 py-5" aria-label="Cargando conversación">
      {[0, 1, 2].map((item) => (
        <div key={item} className={`animate-pulse ${item === 1 ? "ml-auto w-2/3" : "w-full"}`}>
          <div className="h-2.5 w-full rounded-full bg-white/[0.045]" />
          <div className="mt-2 h-2.5 w-4/5 rounded-full bg-white/[0.03]" />
        </div>
      ))}
    </div>
  );
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div>
        <p className="text-[12px] text-white/60">No pude cargar la conversación.</p>
        <p className="mt-1.5 text-[10px] text-white/25">{message}</p>
        <button type="button" onClick={onRetry} className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-white/50 transition hover:bg-white/[0.04] hover:text-white active:scale-95">
          <RefreshCw className="h-3 w-3" /> Reintentar
        </button>
      </div>
    </div>
  );
}

export default ShadowNotePanel;
