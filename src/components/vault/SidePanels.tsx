"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Bookmark, ChevronRight, CornerDownLeft, Hash, Search, X } from "lucide-react";
import { searchVaultNotes, type VaultSnapshot } from "@/app/actions/vault";
import type { SearchHit } from "@/features/vault/types";
import { basenameOf, folderOf } from "@/features/vault/parse";
import { useVaultStore } from "./store";
import { Kbd } from "./ui";

function Highlighted({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const trimmedStart = Math.max(0, (ranges[0]?.[0] ?? 0) - 48);
  const parts: { text: string; hit: boolean }[] = [];
  let cursor = trimmedStart;
  for (const [from, to] of ranges) {
    if (to <= cursor) continue;
    if (from > cursor) parts.push({ text: text.slice(cursor, from), hit: false });
    parts.push({ text: text.slice(Math.max(from, cursor), to), hit: true });
    cursor = to;
  }
  parts.push({ text: text.slice(cursor, cursor + 160), hit: false });
  return (
    <span>
      {trimmedStart > 0 && "…"}
      {parts.map((part, index) => part.hit
        ? <mark key={index} className="rounded-[3px] bg-white/[0.18] px-0.5 text-white">{part.text}</mark>
        : <span key={index}>{part.text}</span>)}
    </span>
  );
}

function SearchResult({ hit, query }: { hit: SearchHit; query: string }) {
  const openNote = useVaultStore((state) => state.openNote);
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={(event) => openNote(hit.path, { newTab: event.metaKey || event.ctrlKey })}
        className="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-white/[0.05]"
      >
        <span
          role="button"
          tabIndex={-1}
          aria-label={open ? "Contraer" : "Expandir"}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(!open);
          }}
          className="flex h-4 w-4 items-center justify-center text-white/30 hover:text-white/70"
        >
          <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${open && hit.matches.length ? "rotate-90" : ""}`} />
        </span>
        <span className="truncate text-[12.5px] font-medium text-white/85">{hit.title}</span>
        <span className="ml-auto shrink-0 font-mono text-[9.5px] text-white/25">{hit.matches.length || ""}</span>
      </button>
      {open && hit.matches.length > 0 && (
        <div className="ml-5 border-l border-white/[0.06] pl-2">
          {hit.matches.map((match) => (
            <button
              key={match.line}
              type="button"
              onClick={() => openNote(hit.path, { line: match.line })}
              className="block w-full rounded-md px-2 py-1 text-left text-[11.5px] leading-snug text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white/80"
              title={query}
            >
              <Highlighted text={match.text} ranges={match.ranges} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SearchPanel() {
  const query = useVaultStore((state) => state.searchQuery);
  const setQuery = useVaultStore((state) => state.setSearchQuery);
  const [debounced, setDebounced] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 160);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data, isLoading } = useSWR(debounced ? `vault:search:${debounced}` : null, () => searchVaultNotes(debounced), { keepPreviousData: true });
  const total = data?.reduce((sum, hit) => sum + Math.max(1, hit.matches.length), 0) ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-2 pb-2 pt-1">
        <div className="flex h-8 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 transition focus-within:border-white/20 focus-within:bg-white/[0.05]">
          <Search className="h-3.5 w-3.5 shrink-0 text-white/35" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Buscar en la bóveda…"
            className="vault-plain-input min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/30"
          />
          {query && (
            <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery("")} className="text-white/30 transition hover:text-white/80 active:scale-90">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between px-0.5 font-mono text-[9.5px] text-white/25">
          <span>{debounced ? (isLoading && !data ? "buscando…" : `${data?.length ?? 0} notas · ${total} coincidencias`) : "file: path: tag: -excluir \"frase\""}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-6 [scrollbar-width:thin]">
        {data?.map((hit) => <SearchResult key={hit.path} hit={hit} query={debounced} />)}
        {debounced && data && !data.length && (
          <div className="px-3 py-8 text-center text-[11px] text-white/30">Nada coincide con “{debounced}”.</div>
        )}
        {!debounced && (
          <div className="space-y-2 px-3 py-6 text-[11px] leading-relaxed text-white/35">
            <p>Busca por texto, nombre, carpeta o tag.</p>
            <ul className="space-y-1 font-mono text-[10px] text-white/30">
              <li>tag:#persona</li>
              <li>path:&quot;100 - Proyectos&quot; cord</li>
              <li>file:diego -primo</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

type TagNode = { name: string; full: string; count: number; children: TagNode[] };

function buildTagTree(tags: { tag: string; count: number }[]): TagNode[] {
  const root: TagNode = { name: "", full: "", count: 0, children: [] };
  for (const { tag, count } of tags) {
    let cursor = root;
    const parts = tag.split("/");
    parts.forEach((part, index) => {
      const full = parts.slice(0, index + 1).join("/");
      let child = cursor.children.find((node) => node.full === full);
      if (!child) {
        child = { name: part, full, count: 0, children: [] };
        cursor.children.push(child);
      }
      child.count += count;
      cursor = child;
    });
  }
  const sort = (nodes: TagNode[]) => {
    nodes.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
    nodes.forEach((node) => sort(node.children));
  };
  sort(root.children);
  return root.children;
}

function TagRow({ node, depth }: { node: TagNode; depth: number }) {
  const search = useVaultStore((state) => state.search);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => search(`tag:#${node.full}`)}
        style={{ paddingLeft: 8 + depth * 14 }}
        className="group flex h-[26px] w-full items-center gap-1.5 rounded-md pr-2 text-left text-[12px] text-white/60 transition-colors hover:bg-white/[0.045] hover:text-white"
      >
        {node.children.length ? (
          <span role="button" tabIndex={-1} aria-label="Expandir" onClick={(event) => {
            event.stopPropagation();
            setOpen(!open);
          }} className="flex h-3.5 w-3.5 items-center justify-center text-white/30">
            <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
          </span>
        ) : <Hash className="h-3 w-3 text-white/25" />}
        <span className="truncate">{node.name}</span>
        <span className="ml-auto rounded-full bg-white/[0.05] px-1.5 font-mono text-[9.5px] text-white/35">{node.count}</span>
      </button>
      {open && node.children.map((child) => <TagRow key={child.full} node={child} depth={depth + 1} />)}
    </div>
  );
}

export function TagsPanel({ snapshot }: { snapshot: VaultSnapshot }) {
  const [filter, setFilter] = useState("");
  const tree = useMemo(() => buildTagTree(snapshot.tags.filter((item) => item.tag.toLowerCase().includes(filter.toLowerCase()))), [snapshot.tags, filter]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-2 pb-2 pt-1">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filtrar tags…"
          className="vault-plain-input h-8 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 text-[12px] text-white outline-none transition placeholder:text-white/30 focus:border-white/20"
        />
        <div className="mt-1.5 px-0.5 font-mono text-[9.5px] text-white/25">{snapshot.tags.length} tags</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-6 [scrollbar-width:thin]">
        {tree.map((node) => <TagRow key={node.full} node={node} depth={0} />)}
        {!tree.length && <div className="px-3 py-8 text-center text-[11px] text-white/30">Sin tags</div>}
      </div>
    </div>
  );
}

export function BookmarksPanel({ snapshot }: { snapshot: VaultSnapshot }) {
  const bookmarks = useVaultStore((state) => state.bookmarks);
  const openNote = useVaultStore((state) => state.openNote);
  const toggleBookmark = useVaultStore((state) => state.toggleBookmark);
  const recent = useMemo(() => [...snapshot.files].filter((file) => file.ext === "md").sort((a, b) => b.mtime - a.mtime).slice(0, 12), [snapshot.files]);
  const known = new Set(snapshot.files.map((file) => file.path));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-1.5 pb-6 pt-1 [scrollbar-width:thin]">
      <div className="px-2 pb-1.5 text-[9.5px] font-medium uppercase tracking-[0.14em] text-white/30">Fijadas</div>
      {bookmarks.filter((path) => known.has(path)).map((path) => (
        <motion.div layout key={path} className="group flex h-[26px] items-center gap-1.5 rounded-md px-2 text-[12px] text-white/65 transition-colors hover:bg-white/[0.045] hover:text-white">
          <Bookmark className="h-3 w-3 shrink-0 fill-white/35 text-white/35" />
          <button type="button" onClick={(event) => openNote(path, { newTab: event.metaKey || event.ctrlKey })} className="min-w-0 flex-1 truncate text-left">{basenameOf(path)}</button>
          <button type="button" aria-label="Quitar" onClick={() => toggleBookmark(path)} className="opacity-0 transition group-hover:opacity-100 active:scale-90"><X className="h-3 w-3 text-white/40" /></button>
        </motion.div>
      ))}
      {!bookmarks.length && <div className="px-2 pb-3 text-[11px] leading-relaxed text-white/30">Fija notas desde el menú contextual o con <Kbd>⌘⇧B</Kbd>.</div>}
      <div className="mt-3 px-2 pb-1.5 text-[9.5px] font-medium uppercase tracking-[0.14em] text-white/30">Recientes</div>
      {recent.map((file) => (
        <button
          key={file.path}
          type="button"
          onClick={(event) => openNote(file.path, { newTab: event.metaKey || event.ctrlKey })}
          className="group flex h-[26px] items-center gap-2 rounded-md px-2 text-left text-[12px] text-white/60 transition-colors hover:bg-white/[0.045] hover:text-white"
        >
          <span className="min-w-0 flex-1 truncate">{basenameOf(file.path)}</span>
          <span className="shrink-0 truncate font-mono text-[9px] text-white/20 group-hover:text-white/35">{folderOf(file.path).split("/").pop()}</span>
          <CornerDownLeft className="h-3 w-3 shrink-0 text-white/0 transition group-hover:text-white/30" />
        </button>
      ))}
    </div>
  );
}
