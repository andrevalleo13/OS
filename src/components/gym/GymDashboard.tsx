"use client";

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUIStore } from "@/store/useUIStore";
import ActiveSession from "./ActiveSession";
import { BodySlot, WeightPanel } from "./BodySection";
import { WEEK_ORDER, weekdayOf } from "./lib/dates";
import { createDraft, formatClock } from "./lib/session";
import type { GymView } from "./lib/types";
import { ConsistencyHeatmap, LiftsPanel, MuscleVolumePanel, RecentSessionsPanel } from "./ProgressSection";
import { StatTiles, TodayPanel } from "./TodayHero";
import { containerVariants, formatNumber, isTypingTarget, Kbd, Portal, SectionRule, spring, useNow } from "./ui";
import { useSessionDraft } from "./useSessionDraft";
import { LogbookPanel, PartnerPanel, ProtocolPanel, VaultUnavailable } from "./VaultSection";

export default function GymDashboard({ view }: { view: GymView }) {
  const reducedPreference = useUIStore((state) => state.reducedMotion);
  const todayWeekday = weekdayOf(view.todayKey);
  const [selected, setSelected] = useState(todayWeekday);
  const [open, setOpen] = useState(false);
  const { draft, setDraft, loaded } = useSessionDraft();
  const now = useNow(1000, Boolean(draft) && !open);
  const sessionClock = draft ? formatClock(now ? (now - draft.startedAt) / 1000 : 0) : null;

  const suggestions = useMemo(
    () => [...new Set([...view.routine.days.flatMap((day) => day.exercises.map((item) => item.name)), ...view.lifts.map((lift) => lift.name)])].sort((a, b) => a.localeCompare(b, "es")),
    [view.routine.days, view.lifts],
  );
  // "Al fallo" sale del protocolo de la bóveda; si no existe no se sugiere nada.
  const target = useMemo(() => (view.protocol.some((line) => /fallo/i.test(line.text)) ? "al fallo" : null), [view.protocol]);

  const start = useCallback(() => {
    if (draft) {
      setOpen(true);
      return;
    }
    const day = view.routine.days[selected];
    setDraft(createDraft(day.exercises.length ? day : null, view.ghosts, view.routine.defaultSets, Date.now(), day.kind === "fuerza" ? target : null));
    setOpen(true);
  }, [draft, selected, setDraft, target, view.ghosts, view.routine.days, view.routine.defaultSets]);

  // Atajos globales: N inicia/continúa, ← → cambian el día del split.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (open || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        start();
      } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const step = event.key === "ArrowRight" ? 1 : -1;
        setSelected((current) => WEEK_ORDER[(WEEK_ORDER.indexOf(current as (typeof WEEK_ORDER)[number]) + step + 7) % 7]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, start]);

  // `/gym?intent=start` (desde el widget del inicio) abre la sesión de hoy.
  useEffect(() => {
    if (!loaded) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("intent") !== "start") return;
    params.delete("intent");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    start();
  }, [loaded, start]);

  return (
    <MotionConfig reducedMotion={reducedPreference ? "always" : "user"}>
      <motion.main variants={containerVariants} initial="hidden" animate="visible" className="os-page mx-auto w-full max-w-[1400px] pb-12 pt-1 md:pt-3">
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
          <TodayPanel view={view} selected={selected} onSelect={setSelected} onStart={start} sessionClock={sessionClock} />
          <StatTiles view={view} />
        </div>

        <SectionRule
          label="Progreso"
          right={view.totals.volume > 0 ? <span className="font-mono text-[10px] text-white/30">{formatNumber(view.totals.volume)} kg acumulados</span> : undefined}
        />
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
          <ConsistencyHeatmap view={view} />
          <MuscleVolumePanel muscles={view.muscles} defaultSets={view.routine.defaultSets} />
          <LiftsPanel lifts={view.lifts} todayKey={view.todayKey} />
          <RecentSessionsPanel sessions={view.sessions} totals={view.totals} todayKey={view.todayKey} />
        </div>

        <SectionRule label="Cuerpo" />
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
          <BodySlot view={view} />
          <WeightPanel view={view} />
        </div>

        <SectionRule
          label="Desde tu bóveda"
          right={view.vaultAvailable ? (
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/35">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40" /><span className="relative h-1.5 w-1.5 rounded-full bg-white/70" /></span>
              En vivo
            </span>
          ) : undefined}
        />
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
          {view.vaultAvailable ? (
            <>
              <ProtocolPanel view={view} />
              <PartnerPanel view={view} />
              <LogbookPanel view={view} />
            </>
          ) : (
            <VaultUnavailable />
          )}
        </div>
      </motion.main>

      <AnimatePresence>
        {open && draft && (
          <Portal key="session">
            <ActiveSession
              draft={draft}
              setDraft={setDraft}
              ghosts={view.ghosts}
              suggestions={suggestions}
              defaultSets={view.routine.defaultSets}
              onMinimize={() => setOpen(false)}
              onClose={() => {
                setOpen(false);
                setDraft(null);
              }}
            />
          </Portal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!open && draft && (
          <Portal key="pill">
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              initial={{ y: 48, opacity: 0, x: "-50%" }}
              animate={{ y: 0, opacity: 1, x: "-50%" }}
              exit={{ y: 48, opacity: 0, x: "-50%" }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              className="fixed bottom-24 left-1/2 z-[65] flex items-center gap-3 rounded-2xl border border-white/[0.12] bg-black/85 py-2 pl-3.5 pr-2 shadow-2xl backdrop-blur-2xl md:bottom-6"
              aria-label="Continuar sesión en curso"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              <span className="text-left">
                <span className="block text-[9px] uppercase tracking-[0.14em] text-white/40">En curso</span>
                <span className="block max-w-[160px] truncate text-[12px] text-white">{draft.title}</span>
              </span>
              <span className="font-mono text-[13px] tabular-nums text-white">{sessionClock}</span>
              <span className="flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-[11px] font-medium text-black">
                Continuar <Kbd tone="light">N</Kbd>
              </span>
            </motion.button>
          </Portal>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
