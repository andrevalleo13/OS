"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getShadowConversation, importShadowConversation } from "@/app/actions/shadow";
import { approveShadowAction } from "@/app/actions/shadow-actions";
import { streamShadow } from "@/components/shadow/ai/streamShadow";
import { statusFromMood } from "@/components/shadow/face/expressions";
import type { ShadowMessage, ShadowStatus } from "@/components/shadow/types";
import type { PendingShadowAction } from "@/features/shadow/file-actions";
import type { ShadowResult, ShadowStep } from "@/features/shadow/protocol";
import { uiAudio } from "@/utils/audio";

/** Caché local de mensajes de la página de Shadow (por conversación). */
export const SHADOW_MESSAGE_CACHE_KEY = "valleos.shadow.message-cache.v2";

export type ShadowMessageMap = Record<string, ShadowMessage[]>;

const NO_MESSAGES: ShadowMessage[] = [];
const FAILURE_TEXT = "No pude completar la solicitud. El mensaje permanece en este hilo para que puedas reintentarlo.";

export function makeShadowId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

export function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeShadowMessage(value: unknown, index: number): ShadowMessage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ShadowMessage>;
  if ((candidate.sender !== "USR" && candidate.sender !== "SHDW") || typeof candidate.text !== "string") return null;
  return {
    ...candidate,
    id: typeof candidate.id === "string" ? candidate.id : `imported-${index}-${candidate.createdAt ?? candidate.text.slice(0, 20)}`,
    sender: candidate.sender,
    text: candidate.text,
  };
}

export function normalizeShadowMessages(values: unknown): ShadowMessage[] {
  return (Array.isArray(values) ? values : [])
    .map(normalizeShadowMessage)
    .filter((message): message is ShadowMessage => Boolean(message));
}

export type UseShadowChatOptions = {
  /** Conversación visible: `send`, `messages` y `status` se refieren a ella. */
  conversationKey: string;
  /** Clave de localStorage del caché de mensajes. */
  storageKey?: string;
  /** Ajusta el caché leído antes de usarlo (p. ej. migrar historial legado). */
  prepareCache?: (cache: ShadowMessageMap) => ShadowMessageMap;
  /** Se llama una vez, al hidratar, con el caché ya preparado. */
  onHydrate?: (cache: ShadowMessageMap) => void;
  /** El mensaje del usuario ya está en el hilo y el turno empezó. */
  onSend?: (conversationKey: string, message: ShadowMessage) => void;
  /** El turno terminó; `steps` son los pasos reales que se ejecutaron. */
  onResult?: (conversationKey: string, result: ShadowResult, steps: ShadowStep[]) => void;
};

export type ShadowSendOptions = {
  /** Nota abierta en el editor de la bóveda. */
  notePath?: string | null;
};

/**
 * Estado de un chat con Shadow: mensajes por conversación (con caché local e
 * historial del servidor), envío en streaming con pasos y texto en vivo,
 * aprobación de acciones pendientes y el estado de la cara (pensando,
 * hablando, gesto final). Lo usan la página de Shadow y el panel de la bóveda.
 */
export function useShadowChat(options: UseShadowChatOptions) {
  const { conversationKey, storageKey = SHADOW_MESSAGE_CACHE_KEY } = options;
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });

  const [messagesByConversation, setMessagesByConversation] = useState<ShadowMessageMap>({});
  const [statusByConversation, setStatusByConversation] = useState<Record<string, ShadowStatus>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loadErrors, setLoadErrors] = useState<Record<string, string | null>>({});
  const [hydrated, setHydrated] = useState(false);

  const loadedKeys = useRef(new Set<string>());
  const timersRef = useRef(new Set<number>());

  const appendMessage = useCallback((key: string, message: ShadowMessage) => {
    setMessagesByConversation((current) => ({
      ...current,
      [key]: [...(current[key] ?? []), message],
    }));
  }, []);

  const setConversationStatus = useCallback((key: string, nextStatus: ShadowStatus) => {
    // Se llama en cada fragmento del streaming: sin cambio real, sin render.
    setStatusByConversation((current) => current[key] === nextStatus ? current : { ...current, [key]: nextStatus });
  }, []);

  /**
   * Cierre de una respuesta: habla, muestra un instante el gesto del resultado
   * (contento, preocupado o mareado) y vuelve a reposo. Los temporizadores
   * nunca pisan un estado `thinking` que empezó después.
   */
  const settleConversation = useCallback((key: string, mood: string | undefined, speakingMs: number) => {
    const settleUnlessBusy = (next: ShadowStatus) =>
      setStatusByConversation((current) => current[key] === "thinking" ? current : { ...current, [key]: next });
    const finale = statusFromMood(mood);
    const speakingTimer = window.setTimeout(() => {
      timersRef.current.delete(speakingTimer);
      settleUnlessBusy(finale);
      if (finale === "idle") return;
      const finaleTimer = window.setTimeout(() => {
        timersRef.current.delete(finaleTimer);
        settleUnlessBusy("idle");
      }, finale === "error" ? 2_600 : 1_600);
      timersRef.current.add(finaleTimer);
    }, speakingMs);
    timersRef.current.add(speakingTimer);
  }, []);

  useEffect(() => {
    const raw = readStoredJson<Record<string, unknown>>(storageKey, {});
    const cache: ShadowMessageMap = Object.fromEntries(
      Object.entries(raw && typeof raw === "object" ? raw : {}).map(([key, values]) => [key, normalizeShadowMessages(values)]),
    );
    const prepared = callbacks.current.prepareCache?.(cache) ?? cache;
    setMessagesByConversation(prepared);
    setHydrated(true);
    callbacks.current.onHydrate?.(prepared);
  }, [storageKey]);

  const loadConversation = useCallback(async (key: string, force = false) => {
    if (!hydrated || (!force && loadedKeys.current.has(key))) return;
    setLoadingKey(key);
    setLoadErrors((current) => ({ ...current, [key]: null }));
    const cached = messagesByConversation[key] ?? [];

    const result = await getShadowConversation(key);
    if (result.success) {
      const serverMessages = result.messages.map((message, index) => normalizeShadowMessage(message, index)).filter((message): message is ShadowMessage => Boolean(message));
      if (serverMessages.length > 0 || cached.length === 0) {
        setMessagesByConversation((current) => ({ ...current, [key]: serverMessages }));
      } else if (cached.length > 0) {
        await importShadowConversation({
          conversationKey: key,
          channel: "dashboard",
          messages: cached.map(({ sender, text, mood, widget }) => ({ role: sender === "USR" ? "user" : "assistant", content: text, mood, widget })),
        });
      }
      loadedKeys.current.add(key);
    } else if (cached.length === 0) {
      setLoadErrors((current) => ({ ...current, [key]: "El historial no respondió. Tu conversación no fue modificada." }));
    }
    setLoadingKey((current) => current === key ? null : current);
  }, [hydrated, messagesByConversation]);

  useEffect(() => {
    if (!hydrated) return;
    void loadConversation(conversationKey);
  }, [conversationKey, hydrated, loadConversation]);

  useEffect(() => {
    if (!hydrated) return;
    const serializable = Object.fromEntries(Object.entries(messagesByConversation).map(([key, messages]) => [key, messages.filter((message) => !message.streaming).slice(-80).map(({ id, sender, text, mood, widget, createdAt }) => ({ id, sender, text, mood, widget, createdAt }))]));
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(serializable));
    } catch {
      // Sin almacenamiento local el historial sigue en el servidor.
    }
  }, [messagesByConversation, hydrated, storageKey]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const send = useCallback(async (rawCommand: string, sendOptions: ShadowSendOptions = {}) => {
    const command = rawCommand.trim();
    const key = conversationKey;
    if (!command || (statusByConversation[key] ?? "idle") === "thinking") return;

    const now = new Date().toISOString();
    const userMessage: ShadowMessage = { id: makeShadowId("usr"), sender: "USR", text: command, createdAt: now };
    appendMessage(key, userMessage);
    setConversationStatus(key, "thinking");
    callbacks.current.onSend?.(key, userMessage);
    uiAudio.playSend();

    // La respuesta nace como un mensaje vivo: los pasos reales y el texto se
    // escriben sobre él mientras llegan, y al final se sella con el resultado.
    const responseId = makeShadowId("shdw");
    const steps: ShadowStep[] = [];
    let responseStarted = false;
    let receivedText = false;
    const patchResponse = (update: (message: ShadowMessage) => ShadowMessage) =>
      setMessagesByConversation((current) => ({
        ...current,
        [key]: (current[key] ?? []).map((message) => message.id === responseId ? update(message) : message),
      }));
    const ensureResponse = () => {
      if (responseStarted) return;
      responseStarted = true;
      appendMessage(key, { id: responseId, sender: "SHDW", text: "", streaming: true, steps: [], createdAt: new Date().toISOString() });
    };

    try {
      const result = await streamShadow({ message: command, conversationKey: key, channel: "dashboard", notePath: sendOptions.notePath ?? undefined }, {
        onStep: (step) => {
          steps.push(step);
          ensureResponse();
          patchResponse((message) => ({ ...message, steps: [...(message.steps ?? []), { ...step, status: "running" }] }));
          setConversationStatus(key, "thinking");
        },
        onStepDone: (id, ok) => patchResponse((message) => ({
          ...message,
          steps: message.steps?.map((step) => step.id === id ? { ...step, status: ok ? "done" : "failed" } : step),
        })),
        onText: (delta) => {
          ensureResponse();
          if (!receivedText) uiAudio.playReceive();
          receivedText = true;
          patchResponse((message) => ({ ...message, text: message.text + delta }));
          setConversationStatus(key, "speaking");
        },
        onReset: () => patchResponse((message) => ({ ...message, text: "" })),
      });
      ensureResponse();
      patchResponse((message) => ({
        ...message,
        text: result.text,
        mood: result.mood,
        widget: result.widget,
        pendingAction: result.pendingAction,
        sources: result.sources,
        streaming: false,
        steps: undefined,
      }));
      callbacks.current.onResult?.(key, result, steps);
      if (!receivedText) uiAudio.playReceive();
      if (result.widget && result.widget !== "none") {
        const widgetTimer = window.setTimeout(() => uiAudio.playWidgetSpawn(), 420);
        timersRef.current.add(widgetTimer);
      }
      // El texto ya se "dijo" mientras llegaba: el cierre es breve.
      setConversationStatus(key, "speaking");
      settleConversation(key, result.mood, receivedText ? 600 : Math.min(2600, Math.max(900, result.text.split(/\s+/).length * 55)));
    } catch {
      if (responseStarted) patchResponse((message) => ({ ...message, text: FAILURE_TEXT, mood: "urgent", streaming: false, steps: undefined }));
      else appendMessage(key, { id: responseId, sender: "SHDW", text: FAILURE_TEXT, mood: "urgent", createdAt: new Date().toISOString() });
      setConversationStatus(key, "error");
      settleConversation(key, undefined, 2_600);
    }
  }, [conversationKey, appendMessage, setConversationStatus, settleConversation, statusByConversation]);

  const decideAction = useCallback(async (messageId: string, action: PendingShadowAction, approved: boolean) => {
    const key = conversationKey;
    setMessagesByConversation((current) => ({
      ...current,
      [key]: (current[key] ?? []).map((message) => message.id === messageId ? { ...message, pendingAction: undefined } : message),
    }));
    if (!approved) {
      appendMessage(key, { id: makeShadowId("cancelled"), sender: "SHDW", text: "Acción cancelada. No cambié nada.", mood: "neutral", createdAt: new Date().toISOString() });
      return;
    }
    setConversationStatus(key, "thinking");
    const result = await approveShadowAction(action.id);
    const mood = result.success ? "success" : "urgent";
    appendMessage(key, { id: makeShadowId("action"), sender: "SHDW", text: result.message, mood, createdAt: new Date().toISOString() });
    setConversationStatus(key, statusFromMood(mood));
    settleConversation(key, undefined, 1_800);
  }, [conversationKey, appendMessage, setConversationStatus, settleConversation]);

  /** Conversación nueva: vacía y sin historial que cargar. */
  const startConversation = useCallback((key: string) => {
    setMessagesByConversation((current) => ({ ...current, [key]: [] }));
    loadedKeys.current.add(key);
  }, []);

  const retryLoad = useCallback(() => {
    loadedKeys.current.delete(conversationKey);
    void loadConversation(conversationKey, true);
  }, [conversationKey, loadConversation]);

  return {
    hydrated,
    messages: messagesByConversation[conversationKey] ?? NO_MESSAGES,
    status: statusByConversation[conversationKey] ?? "idle",
    loading: loadingKey === conversationKey,
    error: loadErrors[conversationKey] ?? null,
    send,
    decideAction,
    retryLoad,
    startConversation,
    appendMessage,
    setStatus: setConversationStatus,
    settle: settleConversation,
  };
}

export type ShadowChat = ReturnType<typeof useShadowChat>;
