"use client";

import { useEffect, useState, useTransition } from "react";
import { BookOpen, FileText, Inbox, Plus, Search } from "lucide-react";
import { appendObsidianNote, getRecentNotes, readObsidianNote, searchObsidianNotes } from "@/app/actions/obsidian";

type Note = { name: string; content: string };

export default function ObsidianDashboard({ initialNotes }: { initialNotes: Note[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [active, setActive] = useState<Note | null>(initialNotes[0] ?? null);
  const [query, setQuery] = useState("");
  const [capture, setCapture] = useState("");
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("note");
    if (!requested) return;
    startTransition(async () => {
      try { setActive({ name: requested, content: await readObsidianNote(requested) }); } catch { setMessage("No pude abrir esa nota."); }
    });
  }, []);

  const openNote = (note: Note) => startTransition(async () => {
    try { setActive({ name: note.name, content: await readObsidianNote(note.name) }); } catch { setMessage("No pude abrir la nota."); }
  });

  const search = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    startTransition(async () => {
      try { setResult(await searchObsidianNotes(query)); setActive(null); } catch { setMessage("La búsqueda no pudo completarse."); }
    });
  };

  const saveCapture = (event: React.FormEvent) => {
    event.preventDefault();
    if (!capture.trim()) return;
    startTransition(async () => {
      try {
        await appendObsidianNote("000 - Inbox/Inicio.md", capture, "ValleOS");
        const refreshed = await getRecentNotes(12);
        setNotes(refreshed);
        setCapture("");
        setMessage("Captura guardada en Inbox.");
      } catch { setMessage("No pude guardar la captura."); }
    });
  };

  return (
    <main className="os-page mx-auto w-full max-w-[1400px] py-4 md:py-7">
      <section className="grid min-h-[620px] overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#0d0d0d]/85 lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-white/[0.06] lg:border-b-0 lg:border-r">
          <form onSubmit={search} className="border-b border-white/[0.06] p-3"><label className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 focus-within:border-[color:var(--accent)]/35"><Search className="h-3.5 w-3.5 text-white/25" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en tu memoria" className="w-full bg-transparent text-xs outline-none placeholder:text-white/18" /></label></form>
          <div className="max-h-64 overflow-y-auto p-2 lg:max-h-[556px]"><p className="px-3 py-2 font-mono text-[8px] uppercase tracking-[0.18em] text-white/20">Notas recientes</p>{notes.length === 0 ? <p className="px-3 py-8 text-center text-[11px] text-white/25">No hay notas recientes.</p> : notes.map((note) => <button key={note.name} type="button" onClick={() => openNote(note)} className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition active:scale-[0.99] ${active?.name === note.name ? "bg-white/[0.065] text-white" : "text-white/45 hover:bg-white/[0.035] hover:text-white/75"}`}><FileText className={`h-3.5 w-3.5 shrink-0 ${active?.name === note.name ? "text-[color:var(--accent)]" : "text-white/20"}`} /><span className="truncate text-[11px]">{note.name.replace(/\.md$/, "").split("/").at(-1)}</span></button>)}</div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-7">
            {isPending ? <div className="flex flex-1 items-center justify-center" role="status"><div className="h-7 w-7 animate-pulse rounded-full border border-white/10 bg-white/[0.035]" /></div> : active ? <><div className="flex items-center gap-3 border-b border-white/[0.06] pb-5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--accent)]/10 text-[color:var(--accent)]"><BookOpen className="h-4 w-4" /></div><div className="min-w-0"><h2 className="truncate text-base font-medium">{active.name.replace(/\.md$/, "").split("/").at(-1)}</h2><p className="mt-1 truncate font-mono text-[8px] text-white/22">{active.name}</p></div></div><article className="prose prose-invert mt-6 max-w-none whitespace-pre-wrap text-[13px] leading-7 text-white/55 prose-headings:text-white/85 prose-strong:text-white/75">{active.content}</article></> : result ? <><div className="border-b border-white/[0.06] pb-5"><h2 className="text-base font-medium">Resultados para “{query}”</h2><p className="mt-1 text-[10px] text-white/30">Coincidencias encontradas en el vault.</p></div><pre className="mt-6 whitespace-pre-wrap font-sans text-[12px] leading-6 text-white/50">{result}</pre></> : <div className="flex flex-1 flex-col items-center justify-center text-center"><Inbox className="h-8 w-8 text-white/15" /><p className="mt-4 text-sm text-white/50">Selecciona una nota o busca en el vault.</p></div>}
          </div>
          <form onSubmit={saveCapture} className="border-t border-white/[0.06] p-3 sm:p-4"><div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5 pl-3 focus-within:border-[color:var(--accent)]/35"><Plus className="h-3.5 w-3.5 text-white/25" /><input value={capture} onChange={(event) => setCapture(event.target.value)} placeholder="Captura rápida para Inbox…" className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-white/18" /><button disabled={!capture.trim() || isPending} className="h-8 rounded-lg bg-[#eeeeee] px-3 text-[10px] font-medium text-[#111111] transition active:scale-[0.98] disabled:opacity-30">Guardar</button></div><p aria-live="polite" className="mt-1 min-h-3 text-[9px] text-white/30">{message}</p></form>
        </div>
      </section>
    </main>
  );
}
