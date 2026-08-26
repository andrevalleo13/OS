"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ChevronLeft,
  Edit3,
  MessageSquareText,
  MoreHorizontal,
  PanelLeftClose,
  Pin,
  Plus,
  Search,
} from "lucide-react";
import type { ShadowConversationMeta } from "./types";

type Props = {
  conversations: ShadowConversationMeta[];
  activeKey: string;
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  onSelect: (key: string) => void;
  onRename: (key: string, title: string) => void;
  onTogglePin: (key: string) => void;
  onArchive: (key: string) => void;
};

function relativeLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((today - target) / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return "Últimos 7 días";
  return "Anteriores";
}

export function ShadowConversationRail(props: Props) {
  return (
    <>
      <aside className="hidden w-[236px] shrink-0 border-r border-white/[0.055] xl:flex">
        <RailContent {...props} />
      </aside>

      {props.open ? (
        <div className="fixed inset-0 z-[70] xl:hidden" role="dialog" aria-modal="true" aria-label="Conversaciones de Shadow">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={props.onClose} aria-label="Cerrar conversaciones" />
          <aside className="absolute bottom-3 left-3 top-3 flex w-[min(310px,calc(100vw-24px))] overflow-hidden rounded-[26px] border border-white/10 bg-[#0c0c0c]/98 shadow-2xl">
            <RailContent {...props} compact />
          </aside>
        </div>
      ) : null}
    </>
  );
}

function RailContent({
  conversations,
  activeKey,
  compact,
  onClose,
  onNew,
  onSelect,
  onRename,
  onTogglePin,
  onArchive,
}: Props & { compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-MX");
    return conversations
      .filter((conversation) => showArchived || !conversation.archived)
      .filter((conversation) => !normalized || `${conversation.title} ${conversation.preview}`.toLocaleLowerCase("es-MX").includes(normalized))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [conversations, query, showArchived]);

  const grouped = visible.reduce<Record<string, ShadowConversationMeta[]>>((groups, conversation) => {
    const label = conversation.pinned ? "Fijadas" : conversation.archived ? "Archivadas" : relativeLabel(conversation.updatedAt);
    groups[label] ??= [];
    groups[label].push(conversation);
    return groups;
  }, {});

  const order = ["Fijadas", "Hoy", "Ayer", "Últimos 7 días", "Anteriores", "Archivadas"];

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white/[0.012]">
      <div className="border-b border-white/[0.055] p-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <p className="text-[11px] font-medium text-white/70">Conversaciones</p>
            <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/20">Contextos independientes</p>
          </div>
          {compact ? (
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/[0.05] hover:text-white" aria-label="Cerrar conversaciones">
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5 text-white/15" aria-hidden="true" />
          )}
        </div>
        <button onClick={onNew} className="flex h-10 w-full items-center gap-2 rounded-xl bg-white text-black transition hover:bg-white/90 active:scale-[0.98]">
          <span className="ml-3 flex h-5 w-5 items-center justify-center rounded-full bg-black/10"><Plus className="h-3.5 w-3.5" /></span>
          <span className="text-[11px] font-medium">Nueva conversación</span>
        </button>
        <label className="mt-2 flex h-9 items-center gap-2 rounded-xl border border-white/[0.055] bg-black/20 px-3 text-white/30 focus-within:border-white/[0.14] focus-within:text-white/55">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="sr-only">Buscar conversaciones</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" className="os-message-input min-w-0 flex-1 bg-transparent text-[11px] text-white/70 outline-none placeholder:text-white/20" />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {visible.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <MessageSquareText className="mx-auto h-5 w-5 text-white/15" />
            <p className="mt-3 text-[11px] text-white/30">No hay conversaciones que coincidan.</p>
          </div>
        ) : null}

        {order.map((label) => grouped[label]?.length ? (
          <section key={label} className="mb-4">
            <p className="mb-1 px-2 font-mono text-[8px] uppercase tracking-[0.17em] text-white/20">{label}</p>
            <div className="space-y-0.5">
              {grouped[label].map((conversation) => {
                const active = conversation.key === activeKey;
                const editing = editingKey === conversation.key;
                return (
                  <div key={conversation.key} className="group/item relative">
                    {editing ? (
                      <div className={`w-full rounded-xl px-3 py-2.5 ${active ? "bg-white/[0.075]" : "bg-white/[0.025]"}`}>
                        <input
                          autoFocus
                          defaultValue={conversation.title}
                          onBlur={(event) => { onRename(conversation.key, event.target.value); setEditingKey(null); }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") event.currentTarget.blur();
                            if (event.key === "Escape") setEditingKey(null);
                          }}
                          className="os-message-input w-[calc(100%-28px)] rounded-md bg-black/35 px-1.5 py-0.5 text-[11px] text-white outline-none"
                        />
                        <p className="mt-1 truncate pr-6 text-[9px] leading-relaxed text-white/22">{conversation.preview || "Conversación nueva"}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => { onSelect(conversation.key); onClose(); }}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition active:scale-[0.99] ${active ? "bg-white/[0.075]" : "hover:bg-white/[0.035]"}`}
                      >
                        <p className={`truncate pr-7 text-[11px] ${active ? "text-white/90" : "text-white/55"}`}>{conversation.title}</p>
                        <p className="mt-1 truncate pr-6 text-[9px] leading-relaxed text-white/22">{conversation.preview || "Conversación nueva"}</p>
                      </button>
                    )}
                    <button
                      onClick={() => setMenuKey((current) => current === conversation.key ? null : conversation.key)}
                      className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-white/25 transition hover:bg-black/40 hover:text-white/70 ${active || menuKey === conversation.key ? "opacity-100" : "opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100"}`}
                      aria-label={`Opciones de ${conversation.title}`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                    {menuKey === conversation.key ? (
                      <div className="absolute right-2 top-10 z-20 w-36 rounded-xl border border-white/10 bg-[#161616] p-1 shadow-2xl">
                        <MenuButton icon={Edit3} label="Renombrar" onClick={() => { setEditingKey(conversation.key); setMenuKey(null); }} />
                        <MenuButton icon={Pin} label={conversation.pinned ? "Desfijar" : "Fijar"} onClick={() => { onTogglePin(conversation.key); setMenuKey(null); }} />
                        <MenuButton icon={Archive} label={conversation.archived ? "Restaurar" : "Archivar"} onClick={() => { onArchive(conversation.key); setMenuKey(null); }} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null)}
      </div>

      <button onClick={() => setShowArchived((value) => !value)} className="m-2 flex h-9 items-center justify-between rounded-xl border-t border-white/[0.04] px-3 text-[10px] text-white/30 transition hover:bg-white/[0.03] hover:text-white/55">
        <span>{showArchived ? "Ocultar archivadas" : "Ver archivadas"}</span>
        <Archive className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick }: { icon: typeof Pin; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[10px] text-white/45 transition hover:bg-white/[0.055] hover:text-white/80">
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
