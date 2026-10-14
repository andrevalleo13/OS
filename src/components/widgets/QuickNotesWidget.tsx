"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BrainCircuit, ChevronRight, Plus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { getRecentNotes } from "@/app/actions/obsidian";
import { captureToDaily } from "@/app/actions/vault-capture";
import type { DashboardNote } from "@/components/dashboard/types";
import { WidgetCard, useWidget } from "@/components/ui/widget";
import { useDashboardShortcut } from "@/hooks/useDashboardShortcut";

function noteTitle(name: string) {
  return name.split("/").at(-1)?.replace(/\.md$/i, "") || name;
}

export default function QuickNotesWidget({ initialNotes }: { initialNotes: DashboardNote[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeWidgetId, setActiveWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "notes";

  useEffect(() => setNotes(initialNotes), [initialNotes]);

  useDashboardShortcut("n", () => {
    setActiveWidgetId("notes");
    window.setTimeout(() => inputRef.current?.focus(), 120);
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const content = note.trim();
    if (!content) return;
    setMessage("");
    startTransition(async () => {
      try {
        await captureToDaily(content);
        setNote("");
        setNotes(await getRecentNotes(5));
        setMessage("Guardado en el diario de hoy.");
      } catch {
        setMessage("No se pudo guardar la nota.");
      }
    });
  };

  const visibleNotes = notes.slice(0, isExpanded ? 5 : 2);

  return (
    <WidgetCard id="notes" defaultClassName="min-h-[270px] md:col-span-3 xl:col-span-4" expandedClassName="min-h-[480px] md:col-span-6 xl:col-span-12" shrunkClassName="min-h-[180px] md:col-span-3 xl:col-span-4">
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><BrainCircuit className="h-3.5 w-3.5 text-white/45" /><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Second Brain</p><p className="mt-1 text-[10px] text-white/25">Captura sin perder contexto</p></div></div>
          <Link href="/obsidian" data-no-expand className="flex h-8 items-center gap-1 rounded-xl px-2.5 text-[10px] text-white/30 transition hover:bg-white/[0.045] hover:text-white/70 active:scale-[0.98]">Abrir <ChevronRight className="h-3 w-3" /></Link>
        </div>

        <form data-no-expand onSubmit={submit} className="relative mt-5">
          <label htmlFor="quick-note" className="sr-only">Nota rápida</label>
          <input id="quick-note" ref={inputRef} value={note} onChange={(event) => setNote(event.target.value)} maxLength={20_000} placeholder="Captura una idea en el diario…" className="h-11 w-full rounded-xl border border-white/[0.075] bg-white/[0.025] pl-3 pr-11 text-xs outline-none transition placeholder:text-white/20 focus:border-white/[0.16]" />
          <button disabled={!note.trim() || isPending} className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/[0.07] hover:text-white/70 active:scale-95 disabled:opacity-20" aria-label="Guardar nota"><Plus className="h-3.5 w-3.5" /></button>
        </form>
        <p aria-live="polite" className="mt-2 min-h-4 text-[9px] text-white/30">{isPending ? "Guardando…" : message}</p>

        <div className="mt-2 flex-1 divide-y divide-white/[0.05] overflow-y-auto border-t border-white/[0.05]">
          {visibleNotes.length === 0 ? <div className="flex min-h-28 items-center justify-center text-xs text-white/25">Tu bóveda aún no tiene notas recientes.</div> : visibleNotes.map((item, index) => (
            <motion.div key={item.name} layout initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }} className="py-3">
              <Link href={`/obsidian?note=${encodeURIComponent(item.name)}`} data-no-expand className="group flex items-center justify-between gap-3"><p className="truncate text-[11px] text-white/60 transition group-hover:text-white">{noteTitle(item.name)}</p><span className="shrink-0 font-mono text-[8px] uppercase tracking-wider text-white/18 transition group-hover:text-white/45">Abrir</span></Link>
              <AnimatePresence initial={false}>{isExpanded && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-white/30">{item.content.replace(/^---[\s\S]*?---/, "").trim() || "Nota sin contenido visible."}</motion.p>}</AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}
