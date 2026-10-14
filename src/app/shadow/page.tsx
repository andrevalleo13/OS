"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { ComposerMode, ShadowConversationMeta } from "@/components/shadow/types";
import {
  makeShadowId,
  normalizeShadowMessages,
  readStoredJson,
  useShadowChat,
  type ShadowMessageMap,
} from "@/components/shadow/useShadowChat";

const PRIMARY_KEY = "dashboard:primary";
const CONVERSATION_INDEX_KEY = "valleos.shadow.conversations.v2";
const DRAFTS_KEY = "valleos.shadow.drafts.v1";
const LEGACY_HISTORY_KEY = "valleos.shadow.history.v1";

type DraftMap = Record<string, string>;

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

/** El historial anterior a las conversaciones múltiples vive en la principal. */
function withLegacyHistory(cache: ShadowMessageMap): ShadowMessageMap {
  const legacyRaw = readStoredJson<unknown[]>(LEGACY_HISTORY_KEY, []);
  const oldLegacyRaw = readStoredJson<unknown[]>("shadow_logs", []);
  const legacy = normalizeShadowMessages(legacyRaw.length ? legacyRaw : oldLegacyRaw);
  if (!cache[PRIMARY_KEY]?.length && legacy.length) cache[PRIMARY_KEY] = legacy;
  return cache;
}

export default function ShadowPage() {
  const voice = useShadowVoice();
  const [conversations, setConversations] = useState<ShadowConversationMeta[]>([]);
  const [activeKey, setActiveKey] = useState(PRIMARY_KEY);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [composerMode, setComposerMode] = useState<ComposerMode>("ask");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);

  const pendingQuery = useRef<string | null>(null);

  const updateConversation = useCallback((key: string, update: Partial<ShadowConversationMeta>) => {
    setConversations((current) => current.map((conversation) => conversation.key === key ? { ...conversation, ...update } : conversation));
  }, []);

  const hydrateConversations = useCallback((cache: ShadowMessageMap) => {
    const now = new Date().toISOString();
    const storedIndex = readStoredJson<ShadowConversationMeta[]>(CONVERSATION_INDEX_KEY, []);
    const requested = new URLSearchParams(window.location.search).get("c")?.trim() || PRIMARY_KEY;
    pendingQuery.current = new URLSearchParams(window.location.search).get("q")?.trim() || null;

    let index = storedIndex.filter((conversation) => conversation && typeof conversation.key === "string");
    if (!index.some((conversation) => conversation.key === PRIMARY_KEY)) {
      const firstUserMessage = cache[PRIMARY_KEY]?.find((message) => message.sender === "USR")?.text;
      index.push({ ...newConversationMeta(PRIMARY_KEY, now), title: firstUserMessage ? titleFromMessage(firstUserMessage) : "Conversación principal", preview: cache[PRIMARY_KEY]?.at(-1)?.text ?? "Contexto principal de Shadow" });
    }
    if (!index.some((conversation) => conversation.key === requested)) index = upsertConversation(index, newConversationMeta(requested, now));

    setConversations(index);
    setDrafts(readStoredJson<DraftMap>(DRAFTS_KEY, {}));
    setActiveKey(requested);
    window.localStorage.removeItem("shadow_logs");
  }, []);

  const chat = useShadowChat({
    conversationKey: activeKey,
    prepareCache: withLegacyHistory,
    onHydrate: hydrateConversations,
    onSend: (key, message) => {
      setDrafts((current) => ({ ...current, [key]: "" }));
      setComposerMode("ask");
      setConversations((current) => current.map((conversation) => conversation.key === key ? {
        ...conversation,
        title: conversation.title === "Nueva conversación" ? titleFromMessage(message.text) : conversation.title,
        preview: message.text,
        updatedAt: message.createdAt ?? new Date().toISOString(),
        archived: false,
      } : conversation));
    },
    onResult: (key, result) => updateConversation(key, { preview: result.text, updatedAt: new Date().toISOString() }),
  });
  const { hydrated, appendMessage, setStatus, settle, send, decideAction, startConversation } = chat;

  const logs = chat.messages;
  const status = chat.status;
  const draft = drafts[activeKey] ?? "";
  const activeConversation = conversations.find((conversation) => conversation.key === activeKey) ?? newConversationMeta(activeKey);
  const pendingActions = logs.filter((message) => message.pendingAction).length;

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SHADOW_ACTIVE_CONVERSATION_KEY, activeKey);
    const url = new URL(window.location.href);
    url.searchParams.set("c", activeKey);
    url.searchParams.delete("q");
    window.history.replaceState({ shadowConversation: activeKey }, "", `${url.pathname}${url.search}`);
  }, [activeKey, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CONVERSATION_INDEX_KEY, JSON.stringify(conversations));
  }, [conversations, hydrated]);

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

  useEffect(() => {
    const handleUserMessage = (event: Event) => {
      const { conversationKey, message } = (event as CustomEvent<ShadowVoiceMessageDetail>).detail;
      appendMessage(conversationKey, message);
      setStatus(conversationKey, "thinking");
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
      setStatus(conversationKey, "speaking");
      updateConversation(conversationKey, { preview: message.text, updatedAt: message.createdAt ?? new Date().toISOString() });
      settle(conversationKey, message.mood, Math.min(3_800, Math.max(1_200, message.text.split(/\s+/).length * 70)));
    };
    window.addEventListener(SHADOW_VOICE_USER_EVENT, handleUserMessage);
    window.addEventListener(SHADOW_VOICE_ASSISTANT_EVENT, handleAssistantMessage);
    return () => {
      window.removeEventListener(SHADOW_VOICE_USER_EVENT, handleUserMessage);
      window.removeEventListener(SHADOW_VOICE_ASSISTANT_EVENT, handleAssistantMessage);
    };
  }, [appendMessage, setStatus, settle, updateConversation]);

  const processCommand = useCallback((command: string) => send(command), [send]);

  useEffect(() => {
    if (!hydrated || !pendingQuery.current) return;
    const query = pendingQuery.current;
    pendingQuery.current = null;
    void processCommand(query);
  }, [hydrated, processCommand]);

  const createConversation = useCallback(() => {
    const key = `dashboard:${makeShadowId("conversation")}`;
    const meta = newConversationMeta(key);
    setConversations((current) => upsertConversation(current, meta));
    startConversation(key);
    pushConversationUrl(key);
    setActiveKey(key);
    setHistoryOpen(false);
    setComposerMode("ask");
  }, [startConversation]);

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
          loading={chat.loading && logs.length === 0}
          error={chat.error}
          motionPaused={motionPaused}
          onToggleMotion={() => setMotionPaused((value) => !value)}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenContext={() => setContextOpen(true)}
          onRetryLoad={chat.retryLoad}
          onSuggestion={(value) => void processCommand(value)}
          onActionDecision={(messageId, action, approved) => void decideAction(messageId, action, approved)}
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
