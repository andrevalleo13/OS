"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getShadowConversation, importShadowConversation } from "@/app/actions/shadow";
import { streamShadow } from "@/components/shadow/ai/streamShadow";
import { approveShadowAction } from "@/app/actions/shadow-actions";
import { ShadowComposer } from "@/components/shadow/ShadowComposer";
import { ShadowContextRail } from "@/components/shadow/ShadowContextRail";
import { ShadowConversationRail } from "@/components/shadow/ShadowConversationRail";
import { ShadowWorkspace } from "@/components/shadow/ShadowWorkspace";
import {
  SHADOW_ACTIVE_CONVERSATION_KEY,
  SHADOW_VOICE_ASSISTANT_EVENT,
  SHADOW_VOICE_USER_EVENT,
  useShadowVoice,
  type ShadowVoiceMessageDetail,
} from "@/components/shadow/ShadowVoiceProvider";
import type { ComposerMode, ShadowConversationMeta, ShadowMessage, ShadowStatus } from "@/components/shadow/types";
import { statusFromMood } from "@/components/shadow/face/expressions";
import type { PendingShadowAction } from "@/features/shadow/file-actions";
import { uiAudio } from "@/utils/audio";

const PRIMARY_KEY = "dashboard:primary";
const CONVERSATION_INDEX_KEY = "valleos.shadow.conversations.v2";
const MESSAGE_CACHE_KEY = "valleos.shadow.message-cache.v2";
const DRAFTS_KEY = "valleos.shadow.drafts.v1";
const LEGACY_HISTORY_KEY = "valleos.shadow.history.v1";

type MessageMap = Record<string, ShadowMessage[]>;
type StatusMap = Record<string, ShadowStatus>;
type DraftMap = Record<string, string>;

function makeId(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function parseStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function normalizeMessage(value: unknown, index: number): ShadowMessage | null {
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

function titleFromMessage(message: string) {
  const clean = message.replace(/[#*_`>\n]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return "Nueva conversación";
  return clean.length > 46 ? `${clean.slice(0, 43)}…` : clean;
}

function newConversationMeta(key: string, now = new Date().toISOString()): ShadowConversationMeta {
  return {
    key,
    title: "Nueva conversación",
    preview: "Contexto limpio, memoria global activa",
    createdAt: now,
    updatedAt: now,
    pinned: false,
    archived: false,
  };
}

function upsertConversation(list: ShadowConversationMeta[], conversation: ShadowConversationMeta) {
  const exists = list.some((item) => item.key === conversation.key);
  return exists ? list.map((item) => item.key === conversation.key ? conversation : item) : [conversation, ...list];
}

function pushConversationUrl(key: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("c", key);
  url.searchParams.delete("q");
  window.history.pushState({ shadowConversation: key }, "", `${url.pathname}${url.search}`);
}

export default function ShadowPage() {
  const voice = useShadowVoice();
  const [conversations, setConversations] = useState<ShadowConversationMeta[]>([]);
  const [activeKey, setActiveKey] = useState(PRIMARY_KEY);
  const [messagesByConversation, setMessagesByConversation] = useState<MessageMap>({});
  const [statusByConversation, setStatusByConversation] = useState<StatusMap>({});
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [composerMode, setComposerMode] = useState<ComposerMode>("ask");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loadErrors, setLoadErrors] = useState<Record<string, string | null>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const loadedKeys = useRef(new Set<string>());
  const pendingQuery = useRef<string | null>(null);
  const timersRef = useRef(new Set<number>());

  const logs = messagesByConversation[activeKey] ?? [];
  const status = statusByConversation[activeKey] ?? "idle";
  const draft = drafts[activeKey] ?? "";
  const activeConversation = conversations.find((conversation) => conversation.key === activeKey) ?? newConversationMeta(activeKey);
  const pendingActions = logs.filter((message) => message.pendingAction).length;

  const updateConversation = useCallback((key: string, update: Partial<ShadowConversationMeta>) => {
    setConversations((current) => current.map((conversation) => conversation.key === key ? { ...conversation, ...update } : conversation));
  }, []);

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
    const now = new Date().toISOString();
    const storedIndex = parseStored<ShadowConversationMeta[]>(CONVERSATION_INDEX_KEY, []);
    const storedCacheRaw = parseStored<Record<string, unknown[]>>(MESSAGE_CACHE_KEY, {});
    const legacyRaw = parseStored<unknown[]>(LEGACY_HISTORY_KEY, []);
    const oldLegacyRaw = parseStored<unknown[]>("shadow_logs", []);
    const legacy = (legacyRaw.length ? legacyRaw : oldLegacyRaw).map(normalizeMessage).filter((message): message is ShadowMessage => Boolean(message));
    const cache = Object.fromEntries(Object.entries(storedCacheRaw).map(([key, values]) => [key, values.map(normalizeMessage).filter((message): message is ShadowMessage => Boolean(message))]));
    if (!cache[PRIMARY_KEY]?.length && legacy.length) cache[PRIMARY_KEY] = legacy;

    const requested = new URLSearchParams(window.location.search).get("c")?.trim() || PRIMARY_KEY;
    pendingQuery.current = new URLSearchParams(window.location.search).get("q")?.trim() || null;

    let index = storedIndex.filter((conversation) => conversation && typeof conversation.key === "string");
    if (!index.some((conversation) => conversation.key === PRIMARY_KEY)) {
      const firstUserMessage = cache[PRIMARY_KEY]?.find((message) => message.sender === "USR")?.text;
      index.push({ ...newConversationMeta(PRIMARY_KEY, now), title: firstUserMessage ? titleFromMessage(firstUserMessage) : "Conversación principal", preview: cache[PRIMARY_KEY]?.at(-1)?.text ?? "Contexto principal de Shadow" });
    }
    if (!index.some((conversation) => conversation.key === requested)) index = upsertConversation(index, newConversationMeta(requested, now));

    setConversations(index);
    setMessagesByConversation(cache);
    setDrafts(parseStored<DraftMap>(DRAFTS_KEY, {}));
    setActiveKey(requested);
    setHydrated(true);
    window.localStorage.removeItem("shadow_logs");
  }, []);

  const loadConversation = useCallback(async (key: string, force = false) => {
    if (!hydrated || (!force && loadedKeys.current.has(key))) return;
    setLoadingKey(key);
    setLoadErrors((current) => ({ ...current, [key]: null }));
    const cached = messagesByConversation[key] ?? [];

    const result = await getShadowConversation(key);
    if (result.success) {
      const serverMessages = result.messages.map((message, index) => normalizeMessage(message, index)).filter((message): message is ShadowMessage => Boolean(message));
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
    void loadConversation(activeKey);
    window.localStorage.setItem(SHADOW_ACTIVE_CONVERSATION_KEY, activeKey);
    const url = new URL(window.location.href);
    url.searchParams.set("c", activeKey);
    url.searchParams.delete("q");
    window.history.replaceState({ shadowConversation: activeKey }, "", `${url.pathname}${url.search}`);
  }, [activeKey, hydrated, loadConversation]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CONVERSATION_INDEX_KEY, JSON.stringify(conversations));
  }, [conversations, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const serializable = Object.fromEntries(Object.entries(messagesByConversation).map(([key, messages]) => [key, messages.filter((message) => !message.streaming).slice(-80).map(({ id, sender, text, mood, widget, createdAt }) => ({ id, sender, text, mood, widget, createdAt }))]));
    window.localStorage.setItem(MESSAGE_CACHE_KEY, JSON.stringify(serializable));
  }, [messagesByConversation, hydrated]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  }, [drafts, hydrated]);

  useEffect(() => {
    const onPopState = () => {
      const key = new URLSearchParams(window.location.search).get("c")?.trim();
      if (key) {
        setConversations((current) => current.some((conversation) => conversation.key === key) ? current : upsertConversation(current, newConversationMeta(key)));
        setActiveKey(key);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    const handleUserMessage = (event: Event) => {
      const { conversationKey, message } = (event as CustomEvent<ShadowVoiceMessageDetail>).detail;
      appendMessage(conversationKey, message);
      setConversationStatus(conversationKey, "thinking");
      setConversations((current) => {
        const existing = current.find((conversation) => conversation.key === conversationKey);
        const base = existing ?? newConversationMeta(conversationKey, message.createdAt);
        const next = {
          ...base,
          title: base.title === "Nueva conversación" ? titleFromMessage(message.text) : base.title,
          preview: message.text,
          updatedAt: message.createdAt ?? new Date().toISOString(),
          archived: false,
        };
        return upsertConversation(current, next);
      });
    };
    const handleAssistantMessage = (event: Event) => {
      const { conversationKey, message } = (event as CustomEvent<ShadowVoiceMessageDetail>).detail;
      appendMessage(conversationKey, message);
      setConversationStatus(conversationKey, "speaking");
      updateConversation(conversationKey, { preview: message.text, updatedAt: message.createdAt ?? new Date().toISOString() });
      settleConversation(conversationKey, message.mood, Math.min(3_800, Math.max(1_200, message.text.split(/\s+/).length * 70)));
    };
    window.addEventListener(SHADOW_VOICE_USER_EVENT, handleUserMessage);
    window.addEventListener(SHADOW_VOICE_ASSISTANT_EVENT, handleAssistantMessage);
    return () => {
      window.removeEventListener(SHADOW_VOICE_USER_EVENT, handleUserMessage);
      window.removeEventListener(SHADOW_VOICE_ASSISTANT_EVENT, handleAssistantMessage);
    };
  }, [appendMessage, setConversationStatus, settleConversation, updateConversation]);

  const processCommand = useCallback(async (rawCommand: string) => {
    const command = rawCommand.trim();
    const conversationKey = activeKey;
    if (!command || (statusByConversation[conversationKey] ?? "idle") === "thinking") return;

    const now = new Date().toISOString();
    const userMessage: ShadowMessage = { id: makeId("usr"), sender: "USR", text: command, createdAt: now };
    appendMessage(conversationKey, userMessage);
    setDrafts((current) => ({ ...current, [conversationKey]: "" }));
    setConversationStatus(conversationKey, "thinking");
    setComposerMode("ask");
    updateConversation(conversationKey, {
      title: activeConversation.title === "Nueva conversación" ? titleFromMessage(command) : activeConversation.title,
      preview: command,
      updatedAt: now,
      archived: false,
    });
    uiAudio.playSend();

    // La respuesta nace como un mensaje vivo: los pasos reales y el texto se
    // escriben sobre él mientras llegan, y al final se sella con el resultado.
    const responseId = makeId("shdw");
    let responseStarted = false;
    let receivedText = false;
    const patchResponse = (update: (message: ShadowMessage) => ShadowMessage) =>
      setMessagesByConversation((current) => ({
        ...current,
        [conversationKey]: (current[conversationKey] ?? []).map((message) => message.id === responseId ? update(message) : message),
      }));
    const ensureResponse = () => {
      if (responseStarted) return;
      responseStarted = true;
      appendMessage(conversationKey, { id: responseId, sender: "SHDW", text: "", streaming: true, steps: [], createdAt: new Date().toISOString() });
    };

    try {
      const result = await streamShadow({ message: command, conversationKey, channel: "dashboard" }, {
        onStep: (step) => {
          ensureResponse();
          patchResponse((message) => ({ ...message, steps: [...(message.steps ?? []), { ...step, status: "running" }] }));
          setConversationStatus(conversationKey, "thinking");
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
          setConversationStatus(conversationKey, "speaking");
        },
        onReset: () => patchResponse((message) => ({ ...message, text: "" })),
      });
      ensureResponse();
      const finishedAt = new Date().toISOString();
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
      updateConversation(conversationKey, { preview: result.text, updatedAt: finishedAt });
      if (!receivedText) uiAudio.playReceive();
      if (result.widget && result.widget !== "none") {
        const widgetTimer = window.setTimeout(() => uiAudio.playWidgetSpawn(), 420);
        timersRef.current.add(widgetTimer);
      }
      // El texto ya se "dijo" mientras llegaba: el cierre es breve.
      setConversationStatus(conversationKey, "speaking");
      settleConversation(conversationKey, result.mood, receivedText ? 600 : Math.min(2600, Math.max(900, result.text.split(/\s+/).length * 55)));
    } catch {
      const failure = "No pude completar la solicitud. El mensaje permanece en este hilo para que puedas reintentarlo.";
      if (responseStarted) patchResponse((message) => ({ ...message, text: failure, mood: "urgent", streaming: false, steps: undefined }));
      else appendMessage(conversationKey, { id: responseId, sender: "SHDW", text: failure, mood: "urgent", createdAt: new Date().toISOString() });
      setConversationStatus(conversationKey, "error");
      settleConversation(conversationKey, undefined, 2_600);
    }
  }, [activeConversation.title, activeKey, appendMessage, setConversationStatus, settleConversation, statusByConversation, updateConversation]);

  useEffect(() => {
    if (!hydrated || !pendingQuery.current) return;
    const query = pendingQuery.current;
    pendingQuery.current = null;
    void processCommand(query);
  }, [hydrated, processCommand]);

  const createConversation = useCallback(() => {
    const key = `dashboard:${makeId("conversation")}`;
    const meta = newConversationMeta(key);
    setConversations((current) => upsertConversation(current, meta));
    setMessagesByConversation((current) => ({ ...current, [key]: [] }));
    loadedKeys.current.add(key);
    pushConversationUrl(key);
    setActiveKey(key);
    setHistoryOpen(false);
    setComposerMode("ask");
  }, []);

  const selectConversation = useCallback((key: string) => {
    if (key !== activeKey) pushConversationUrl(key);
    setActiveKey(key);
    setHistoryOpen(false);
    setContextOpen(false);
  }, [activeKey]);

  const toggleArchive = useCallback((key: string) => {
    const target = conversations.find((conversation) => conversation.key === key);
    if (!target) return;
    const next = conversations.map((conversation) => conversation.key === key ? { ...conversation, archived: !conversation.archived, pinned: conversation.archived ? conversation.pinned : false } : conversation);
    setConversations(next);
    if (key === activeKey && !target.archived) {
      const replacement = next.find((conversation) => !conversation.archived && conversation.key !== key);
      if (replacement) {
        pushConversationUrl(replacement.key);
        setActiveKey(replacement.key);
      }
      else createConversation();
    }
  }, [activeKey, conversations, createConversation]);

  const handleActionDecision = useCallback(async (messageId: string, action: PendingShadowAction, approved: boolean) => {
    const conversationKey = activeKey;
    setMessagesByConversation((current) => ({
      ...current,
      [conversationKey]: (current[conversationKey] ?? []).map((message) => message.id === messageId ? { ...message, pendingAction: undefined } : message),
    }));
    if (!approved) {
      appendMessage(conversationKey, { id: makeId("cancelled"), sender: "SHDW", text: "Acción cancelada. No cambié nada.", mood: "neutral", createdAt: new Date().toISOString() });
      return;
    }
    setConversationStatus(conversationKey, "thinking");
    const result = await approveShadowAction(action.id);
    const mood = result.success ? "success" : "urgent";
    appendMessage(conversationKey, { id: makeId("action"), sender: "SHDW", text: result.message, mood, createdAt: new Date().toISOString() });
    setConversationStatus(conversationKey, statusFromMood(mood));
    settleConversation(conversationKey, undefined, 1_800);
  }, [activeKey, appendMessage, setConversationStatus, settleConversation]);

  const sortedConversations = useMemo(() => [...conversations].sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [conversations]);

  if (!hydrated) {
    return <div className="h-[calc(100dvh-11rem)] animate-pulse rounded-[28px] border border-white/[0.055] bg-white/[0.018] md:h-[calc(100dvh-7.25rem)]" aria-label="Cargando Shadow" />;
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-11rem)] min-h-0 w-full max-w-[1600px] overflow-hidden rounded-[26px] border border-white/[0.065] bg-[#0a0a0a] text-[#ededed] shadow-[0_28px_90px_rgba(0,0,0,0.32)] md:h-[calc(100dvh-7.25rem)] md:rounded-[30px]">
      <ShadowConversationRail
        conversations={sortedConversations}
        activeKey={activeKey}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onNew={createConversation}
        onSelect={selectConversation}
        onRename={(key, title) => updateConversation(key, { title: title.trim() || "Sin título", updatedAt: new Date().toISOString() })}
        onTogglePin={(key) => setConversations((current) => current.map((conversation) => conversation.key === key ? { ...conversation, pinned: !conversation.pinned, archived: false } : conversation))}
        onArchive={toggleArchive}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <ShadowWorkspace
          title={activeConversation.title}
          logs={logs}
          status={status}
          loading={loadingKey === activeKey && logs.length === 0}
          error={loadErrors[activeKey] ?? null}
          motionPaused={motionPaused}
          onToggleMotion={() => setMotionPaused((value) => !value)}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenContext={() => setContextOpen(true)}
          onRetryLoad={() => { loadedKeys.current.delete(activeKey); void loadConversation(activeKey, true); }}
          onSuggestion={(value) => void processCommand(value)}
          onActionDecision={(messageId, action, approved) => void handleActionDecision(messageId, action, approved)}
        />
        <ShadowComposer
          value={draft}
          mode={composerMode}
          status={status}
          onChange={(value) => setDrafts((current) => ({ ...current, [activeKey]: value }))}
          onModeChange={setComposerMode}
          onSubmit={() => void processCommand(draft)}
          voiceEnabled={voice.enabled}
          voicePhase={voice.phase}
          onListening={voice.listenNow}
        />
      </div>

      <ShadowContextRail
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        status={status}
        messageCount={logs.length}
        title={activeConversation.title}
        pendingActions={pendingActions}
      />
    </div>
  );
}
