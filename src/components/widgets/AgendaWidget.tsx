"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CalendarDays, ChevronRight, Clock, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WidgetCard, useWidget } from "@/components/ui/widget";

type CalendarEvent = { id: string; title: string; start: string; end: string; calendar: string };

function datePart(value: string) {
  return value.split(" ")[0];
}

function timePart(value: string) {
  return value.split(" ").slice(1).join(" ").replace(/:00\s/, " ");
}

function dayLabel(value: string) {
  const [year, month, day] = datePart(value).split("-").map(Number);
  if (!year || !month || !day) return datePart(value);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Hoy";
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return "Mañana";
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric" }).format(date);
}

export default function AgendaWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", startTime: "09:00", endTime: "10:00" });
  const { activeWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "agenda";

  const loadEvents = useCallback(async () => {
    try {
      const response = await fetch("/api/calendar", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No se pudo leer Calendar.");
      setEvents(data.events ?? []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Calendar no está disponible.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
    const interval = window.setInterval(loadEvents, 60_000);
    return () => window.clearInterval(interval);
  }, [loadEvents]);

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.start.localeCompare(b.start)), [events]);
  const visibleEvents = sortedEvents.slice(0, isExpanded ? 8 : 4);

  const addEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.date) { setMessage("Agrega título y fecha."); return; }
    setIsSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, calendar: "andrevalleo13@gmail.com" }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "No se pudo agregar el evento.");
      setForm((current) => ({ ...current, title: "" }));
      setMessage("Evento agregado a Calendar.");
      await loadEvents();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo agregar el evento.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <WidgetCard
      id="agenda"
      defaultClassName="min-h-[330px] md:col-span-6 xl:col-span-4"
      expandedClassName="min-h-[520px] md:col-span-6 xl:col-span-12"
      shrunkClassName="min-h-[190px] md:col-span-3 xl:col-span-4"
    >
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-3.5 w-3.5 text-white/45" />
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Agenda</p>
              <p className="mt-1 text-[11px] text-white/55">{sortedEvents.length ? `${sortedEvents.length} próximos` : "Sin compromisos próximos"}</p>
            </div>
          </div>
          <Link href="/calendar" data-no-expand className="flex h-8 items-center gap-1 rounded-xl px-2.5 text-[10px] text-white/30 transition hover:bg-white/[0.045] hover:text-white/70 active:scale-[0.98]">Abrir <ChevronRight className="h-3 w-3" /></Link>
        </div>

        <div className="mt-5 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2" aria-label="Cargando agenda">{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-white/[0.035]" />)}</div>
          ) : error ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center"><p className="max-w-64 text-xs text-white/30">{error}</p><button type="button" onClick={() => void loadEvents()} className="rounded-lg border border-white/[0.08] px-3 py-2 text-[10px] text-white/55 active:scale-[0.98]">Reintentar</button></div>
          ) : visibleEvents.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center text-center"><Clock className="mb-3 h-5 w-5 text-white/15" /><p className="text-xs text-white/35">Tu calendario está libre.</p><p className="mt-1 text-[10px] text-white/20">Expande para crear un evento.</p></div>
          ) : (
            <div className="divide-y divide-white/[0.055] border-y border-white/[0.055]">
              {visibleEvents.map((calendarEvent, index) => (
                <motion.div key={calendarEvent.id} layout initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index, 3) * 0.05 }} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 py-3">
                  <span className="font-mono text-[9px] text-white/30">{dayLabel(calendarEvent.start)}</span>
                  <div className="min-w-0"><p className="truncate text-[12px] text-white/70">{calendarEvent.title}</p><p className="mt-1 truncate text-[9px] text-white/25">{calendarEvent.calendar}</p></div>
                  <span className="font-mono text-[9px] text-white/35">{timePart(calendarEvent.start)}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.form data-no-expand onSubmit={addEvent} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-5 border-t border-white/[0.055] pt-5">
              <div className="mb-3 flex items-center gap-2"><Plus className="h-3.5 w-3.5 text-white/35" /><p className="text-[11px] font-medium text-white/65">Nuevo evento</p></div>
              <div className="grid gap-2 md:grid-cols-[1fr_150px_110px_110px_auto]">
                <label className="sr-only" htmlFor="agenda-title">Título</label>
                <input id="agenda-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Título del evento" className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs outline-none placeholder:text-white/20" />
                <label className="sr-only" htmlFor="agenda-date">Fecha</label>
                <input id="agenda-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="h-10 rounded-xl border border-white/[0.07] bg-[#121212] px-3 text-[10px] text-white/60 outline-none" />
                <label className="sr-only" htmlFor="agenda-start">Inicio</label>
                <input id="agenda-start" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} className="h-10 rounded-xl border border-white/[0.07] bg-[#121212] px-3 text-[10px] text-white/60 outline-none" />
                <label className="sr-only" htmlFor="agenda-end">Fin</label>
                <input id="agenda-end" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} className="h-10 rounded-xl border border-white/[0.07] bg-[#121212] px-3 text-[10px] text-white/60 outline-none" />
                <button disabled={isSaving} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-[10px] font-medium text-[#111] transition active:scale-[0.98] disabled:opacity-40">{isSaving ? "Agregando…" : "Agregar"}<ArrowUpRight className="h-3 w-3" /></button>
              </div>
              <p aria-live="polite" className="mt-2 min-h-4 text-[10px] text-white/35">{message}</p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </WidgetCard>
  );
}
