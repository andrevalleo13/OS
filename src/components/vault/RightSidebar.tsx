"use client";

import { useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, CircleDot, Link2, ListTree, Network, SlidersHorizontal, Unlink } from "lucide-react";
import { getVaultNote, getVaultNoteMeta, saveVaultNote, type VaultSnapshot } from "@/app/actions/vault";
import { foldText, type LinkResolver } from "@/features/vault/parse";
import GraphView from "./graph/GraphView";
import PropertiesView from "./reader/PropertiesView";
import ShadowNotePanel from "./ShadowNotePanel";
import { followLink } from "./actions";
import { activeNotePath, useVaultStore, type RightPanel } from "./store";
import { IconButton, toast } from "./ui";
import { refreshVault } from "./useVault";

const PANELS: { id: RightPanel; label: string; icon: typeof Link2 }[] = [
  { id: "links", label: "Enlaces", icon: Link2 },
  { id: "outline", label: "Esquema", icon: ListTree },
  { id: "properties", label: "Propiedades", icon: SlidersHorizontal },
  { id: "graph", label: "Grafo local", icon: Network },
  { id: "shadow", label: "Shadow", icon: CircleDot },
];

function Section({ title, count, icon, children, defaultOpen = true }: { title: string; count?: number; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-[0.13em] text-white/40 transition hover:text-white/75">
        <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
        <span className="text-white/35">{icon}</span>
        {title}
        {count !== undefined && <span className="ml-auto font-mono text-[9.5px] tracking-normal text-white/30">{count}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.16 }} className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Resalta el nombre de la nota dentro del contexto del backlink. */
function ContextLine({ text, needle }: { text: string; needle: string[] }) {
  const clean = text.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/^[-*+]\s+/, "").replace(/\*\*/g, "");
  const folded = foldText(clean);
  let from = -1;
  let length = 0;
  for (const name of needle) {
    const index = folded.indexOf(foldText(name));
    if (index !== -1 && (from === -1 || index < from)) {
      from = index;
      length = name.length;
    }
  }
  const start = Math.max(0, from - 60);
  if (from === -1) return <span>{clean.slice(0, 180)}</span>;
  return (
    <span>
      {start > 0 && "…"}
      {clean.slice(start, from)}
      <mark className="rounded-[3px] bg-white/[0.16] px-0.5 text-white">{clean.slice(from, from + length)}</mark>
      {clean.slice(from + length, from + length + 120)}
    </span>
  );
}

async function linkMention(sourcePath: string, line: number, names: string[], title: string) {
  const note = await getVaultNote(sourcePath);
  const lines = note.content.split("\n");
  const original = lines[line] ?? "";
  for (const name of names) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}\\[|])(${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\p{L}\\p{N}\\]])`, "iu");
    const match = pattern.exec(original);
    if (!match) continue;
    const at = (match.index ?? 0) + match[1].length;
    const found = match[2];
    const link = found === title ? `[[${title}]]` : `[[${title}|${found}]]`;
    lines[line] = `${original.slice(0, at)}${link}${original.slice(at + found.length)}`;
    const result = await saveVaultNote(sourcePath, lines.join("\n"), note.mtime);
    if (!result.ok) throw new Error("La nota cambió; inténtalo de nuevo.");
    return true;
  }
  return false;
}

function LinksPanel({ path, snapshot, resolve }: { path: string; snapshot: VaultSnapshot; resolve: LinkResolver }) {
  const openNote = useVaultStore((state) => state.openNote);
  const { data: meta, mutate } = useSWR(`vault:meta:${path}`, () => getVaultNoteMeta(path), { keepPreviousData: true });
  if (!meta) return <div className="space-y-2 p-3">{[0, 1, 2].map((index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-white/[0.03]" />)}</div>;
  const names = [meta.title, ...meta.aliases];

  return (
    <div className="px-1.5 pb-8">
      <Section title="Backlinks" count={meta.backlinks.length} icon={<ArrowDownLeft className="h-3 w-3" />}>
        {meta.backlinks.map((group) => (
          <div key={group.path} className="mb-1.5 rounded-lg border border-white/[0.05] bg-white/[0.015] p-1">
            <button type="button" onClick={(event) => openNote(group.path, { newTab: event.metaKey || event.ctrlKey })} className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] font-medium text-white/80 transition hover:bg-white/[0.05] hover:text-white">
              <span className="truncate">{group.title}</span>
              <span className="ml-auto font-mono text-[9px] text-white/25">{group.contexts.length}</span>
            </button>
            {group.contexts.slice(0, 4).map((context) => (
              <button key={context.line} type="button" onClick={() => openNote(group.path, { line: context.line })} className="block w-full rounded-md px-1.5 py-1 text-left text-[11px] leading-snug text-white/45 transition hover:bg-white/[0.04] hover:text-white/75">
                <ContextLine text={context.text} needle={names} />
              </button>
            ))}
          </div>
        ))}
        {!meta.backlinks.length && <p className="px-3 pb-2 text-[11px] text-white/30">Ninguna nota enlaza aquí todavía.</p>}
      </Section>

      <Section title="Menciones sin enlazar" count={meta.unlinked.length} icon={<Unlink className="h-3 w-3" />} defaultOpen={false}>
        {meta.unlinked.map((group) => (
          <div key={group.path} className="mb-1.5 rounded-lg border border-white/[0.05] bg-white/[0.015] p-1">
            <button type="button" onClick={() => openNote(group.path)} className="flex w-full items-center rounded-md px-1.5 py-1 text-left text-[12px] text-white/75 transition hover:bg-white/[0.05]">
              <span className="truncate">{group.title}</span>
            </button>
            {group.contexts.map((context) => (
              <div key={context.line} className="group flex items-start gap-1 rounded-md px-1.5 py-1 hover:bg-white/[0.03]">
                <button type="button" onClick={() => openNote(group.path, { line: context.line })} className="min-w-0 flex-1 text-left text-[11px] leading-snug text-white/45 hover:text-white/75">
                  <ContextLine text={context.text} needle={names} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const ok = await linkMention(group.path, context.line, names, meta.title);
                      toast(ok ? "Mención enlazada" : "No encontré la mención exacta");
                      refreshVault();
                      void mutate();
                    } catch (error) {
                      toast(error instanceof Error ? error.message : "No se pudo enlazar");
                    }
                  }}
                  className="shrink-0 rounded-md border border-white/[0.08] px-1.5 py-0.5 text-[9.5px] text-white/50 opacity-0 transition group-hover:opacity-100 hover:bg-white/[0.06] hover:text-white active:scale-95"
                >
                  Enlazar
                </button>
              </div>
            ))}
          </div>
        ))}
        {!meta.unlinked.length && <p className="px-3 pb-2 text-[11px] text-white/30">Sin menciones sueltas.</p>}
      </Section>

      <Section title="Enlaces salientes" count={meta.outgoing.length} icon={<ArrowUpRight className="h-3 w-3" />}>
        {meta.outgoing.map((link) => (
          <button
            key={`${link.path ?? "?"}${link.target}`}
            type="button"
            onClick={(event) => link.path ? openNote(link.path, { newTab: event.metaKey || event.ctrlKey }) : void followLink(link.target, path, resolve, snapshot)}
            className={`flex h-[26px] w-full items-center gap-2 rounded-md px-2.5 text-left text-[12px] transition hover:bg-white/[0.045] ${link.path ? "text-white/65 hover:text-white" : "text-white/30 hover:text-white/60"}`}
            title={link.path ? link.path : "No existe todavía: clic para crearla"}
          >
            <span className="truncate">{link.target}</span>
            {!link.path && <span className="shrink-0 rounded border border-dashed border-white/15 px-1 text-[8.5px] uppercase tracking-wider text-white/30">nueva</span>}
            {link.count > 1 && <span className="ml-auto font-mono text-[9px] text-white/25">×{link.count}</span>}
          </button>
        ))}
        {!meta.outgoing.length && <p className="px-3 pb-2 text-[11px] text-white/30">Esta nota no enlaza a nada.</p>}
      </Section>
    </div>
  );
}

function OutlinePanel({ path }: { path: string }) {
  const openNote = useVaultStore((state) => state.openNote);
  const { data: meta } = useSWR(`vault:meta:${path}`, () => getVaultNoteMeta(path), { keepPreviousData: true });
  if (!meta) return null;
  const minLevel = Math.min(...meta.headings.map((heading) => heading.level), 6);
  return (
    <div className="px-1.5 pb-8 pt-1">
      {meta.headings.map((heading) => (
        <button
          key={`${heading.line}-${heading.text}`}
          type="button"
          onClick={() => openNote(path, { line: heading.line })}
          style={{ paddingLeft: 10 + (heading.level - minLevel) * 14 }}
          className={`block w-full truncate rounded-md py-1 pr-2 text-left transition hover:bg-white/[0.045] hover:text-white ${heading.level === minLevel ? "text-[12px] font-medium text-white/75" : "text-[11.5px] text-white/50"}`}
        >
          {heading.text}
        </button>
      ))}
      {!meta.headings.length && <p className="px-3 py-6 text-center text-[11px] text-white/30">Sin encabezados.</p>}
      <div className="mx-2 mt-4 grid grid-cols-3 gap-1.5 border-t border-white/[0.05] pt-3 font-mono text-[9.5px] text-white/35">
        <div><div className="text-[13px] text-white/75">{meta.words.toLocaleString("es-MX")}</div>palabras</div>
        <div><div className="text-[13px] text-white/75">{meta.backlinks.length}</div>backlinks</div>
        <div><div className="text-[13px] text-white/75">{meta.tasks.total ? `${meta.tasks.done}/${meta.tasks.total}` : "—"}</div>tareas</div>
      </div>
    </div>
  );
}

function PropertiesPanel({ path, resolve }: { path: string; resolve: LinkResolver }) {
  const openNote = useVaultStore((state) => state.openNote);
  const search = useVaultStore((state) => state.search);
  const { data: meta } = useSWR(`vault:meta:${path}`, () => getVaultNoteMeta(path), { keepPreviousData: true });
  if (!meta) return null;
  return (
    <div className="px-2 pb-8 pt-1">
      {Object.keys(meta.frontmatter).length ? (
        <PropertiesView frontmatter={meta.frontmatter} path={path} resolve={resolve} onOpen={(target, options) => openNote(target, options)} onSearchTag={(tag) => search(`tag:#${tag}`)} />
      ) : (
        <p className="px-2 py-6 text-center text-[11px] text-white/30">Esta nota no tiene propiedades.</p>
      )}
      <div className="mt-4 space-y-1 border-t border-white/[0.05] px-2 pt-3 font-mono text-[9.5px] text-white/30">
        <div className="flex justify-between"><span>creada</span><span className="text-white/50">{meta.ctime ? new Date(meta.ctime).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—"}</span></div>
        <div className="flex justify-between"><span>modificada</span><span className="text-white/50">{meta.mtime ? new Date(meta.mtime).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—"}</span></div>
        <div className="flex justify-between"><span>ruta</span><span className="ml-3 truncate text-white/50">{path}</span></div>
      </div>
    </div>
  );
}

export default function RightSidebar({ snapshot, resolve }: { snapshot: VaultSnapshot; resolve: LinkResolver }) {
  const panel = useVaultStore((state) => state.rightPanel);
  const path = useVaultStore(activeNotePath);
  const openNote = useVaultStore((state) => state.openNote);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-0.5 border-b border-white/[0.05] px-2">
        {PANELS.map(({ id, label, icon: Icon }) => (
          <IconButton key={id} label={label} active={panel === id} onClick={() => useVaultStore.setState({ rightPanel: id, rightOpen: true })}>
            <Icon className="h-3.5 w-3.5" />
          </IconButton>
        ))}
        <span className="ml-auto pr-1 text-[10px] text-white/30">{PANELS.find((item) => item.id === panel)?.label}</span>
      </div>
      {panel === "shadow" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <ShadowNotePanel notePath={path} onOpenNote={(target) => openNote(target)} />
        </div>
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        {!path ? (
          <p className="px-4 py-10 text-center text-[11px] text-white/30">Abre una nota para ver sus {panel === "links" ? "enlaces" : panel === "outline" ? "encabezados" : panel === "graph" ? "conexiones" : "propiedades"}.</p>
        ) : panel === "links" ? (
          <LinksPanel path={path} snapshot={snapshot} resolve={resolve} />
        ) : panel === "outline" ? (
          <OutlinePanel path={path} />
        ) : panel === "properties" ? (
          <PropertiesPanel path={path} resolve={resolve} />
        ) : (
          <div className="h-[calc(100%-8px)] min-h-[320px] p-2">
            <GraphView mode="local" activePath={path} onOpen={(target, options) => openNote(target, options)} className="h-full rounded-xl border border-white/[0.05]" />
          </div>
        )}
      </div>
      )}
    </div>
  );
}
