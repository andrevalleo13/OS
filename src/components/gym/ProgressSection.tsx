"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Dumbbell, History, Trophy, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDay, formatLong, formatShort, relativeDay, sentence } from "./lib/dates";
import { muscleName } from "./lib/muscles";
import { LB_PER_KG } from "./lib/session";
import type { CalendarDay, GymView, LiftCard, MuscleVolume, RecentSession } from "./lib/types";
import { compactKg, cx, EASE, Empty, Eyebrow, formatNumber, Kbd, NoteLink, noteHref, NumberTicker, Panel, Portal, Sparkline, spring, TrendChart } from "./ui";

// ---------------------------------------------------------------------------
// Heatmap de consistencia
// ---------------------------------------------------------------------------

const LEVEL_CLASS: Record<CalendarDay["level"], string> = {
  0: "bg-white/[0.045]",
  1: "bg-transparent ring-1 ring-inset ring-white/30",
  2: "bg-white/35",
  3: "bg-white/65",
  4: "bg-white/90",
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function describeDay(day: CalendarDay): string[] {
  const lines: string[] = [];
  for (const session of day.sessions) lines.push(`${session.title} · ${session.duration} min · ${compactKg(session.volume)} kg`);
  if (!day.sessions.length && day.trained) lines.push("Gym (según tu diario)");
  if (day.other) lines.push(day.other);
  if (day.noteFlag === "pendiente" && !day.trained) lines.push("Gym pendiente en el diario");
  if (!lines.length) lines.push("Sin registro");
  return lines;
}

export function ConsistencyHeatmap({ view }: { view: GymView }) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const { days, weeks } = view.calendar;
  const todayIndex = days.findIndex((day) => day.key === view.todayKey);

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);

  const months = useMemo(() => Array.from({ length: weeks }, (_, week) => {
    const monday = days[week * 7]?.key ?? "";
    const previous = week ? days[(week - 1) * 7]?.key ?? "" : "";
    return monday.slice(5, 7) !== previous.slice(5, 7) && Number(monday.slice(8)) <= 7 ? MONTHS[Number(monday.slice(5, 7)) - 1] : "";
  }), [days, weeks]);

  const onKey = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
    if (event.key in moves) {
      event.preventDefault();
      setActive((current) => {
        const next = (current ?? todayIndex) + moves[event.key];
        return Math.min(todayIndex, Math.max(0, next));
      });
    }
    if (event.key === "Enter" && active !== null && days[active]?.notePath) router.push(noteHref(days[active].notePath!));
    if (event.key === "Escape") setActive(null);
  };

  const focus = active !== null ? days[active] : null;
  const column = active !== null ? Math.floor(active / 7) : 0;
  const row = active !== null ? active % 7 : 0;
  const align = column < 4 ? "left" : column > weeks - 5 ? "right" : "center";

  return (
    <Panel className="p-5 sm:p-6 lg:col-span-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>Consistencia · {weeks} semanas</Eyebrow>
          <p className="mt-2 flex items-baseline gap-2 font-mono text-white">
            <NumberTicker value={view.calendar.trained90} className="text-[28px] leading-none tracking-[-0.04em]" />
            <span className="text-[11px] text-white/40">{view.calendar.trained90 === 1 ? "día" : "días"} de gym en 90 días</span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/35">
          <span>Menos</span>
          <span className="flex gap-[3px]">{([0, 2, 3, 4] as const).map((level) => <span key={level} className={cx("h-2.5 w-2.5 rounded-[2px]", LEVEL_CLASS[level])} />)}</span>
          <span>Más</span>
          <span className="ml-1 flex items-center gap-1.5"><span className={cx("h-2.5 w-2.5 rounded-[2px]", LEVEL_CLASS[1])} />Fútbol / otro</span>
        </div>
      </div>

      <div ref={scroller} className="-mx-1 mt-5 overflow-x-auto px-1 pb-1">
        <div className="relative min-w-[560px]">
          <div className="mb-1.5 grid gap-[3px] pl-6" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
            {months.map((month, index) => <span key={index} className="font-mono text-[9px] text-white/30">{month}</span>)}
          </div>
          <div className="flex gap-1.5">
            <div className="grid w-[18px] shrink-0 grid-rows-7 gap-[3px] font-mono text-[9px] text-white/25">
              {["L", "", "Mi", "", "V", "", "D"].map((label, index) => <span key={index} className="flex items-center leading-none">{label}</span>)}
            </div>
            <div
              className="relative grid flex-1 grid-flow-col grid-rows-7 gap-[3px] rounded-md outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
              role="grid"
              aria-label="Calendario de entrenamientos. Usa las flechas para recorrer los días."
              tabIndex={0}
              onKeyDown={onKey}
              onPointerLeave={() => setActive(null)}
              onBlur={() => setActive(null)}
            >
              {days.map((day, index) => (
                <motion.div
                  key={day.key}
                  role="gridcell"
                  aria-label={`${formatLong(day.key)}: ${describeDay(day).join(", ")}`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: day.future ? 0 : 1, scale: 1 }}
                  transition={{ delay: 0.15 + Math.floor(index / 7) * 0.012, duration: 0.25, ease: EASE }}
                  onPointerEnter={() => !day.future && setActive(index)}
                  onClick={() => day.notePath && router.push(noteHref(day.notePath))}
                  className={cx(
                    "aspect-square w-full rounded-[3px] transition-[transform,box-shadow] duration-150",
                    day.future ? "pointer-events-none" : LEVEL_CLASS[day.level],
                    day.notePath && "cursor-pointer",
                    index === todayIndex && active !== index && "shadow-[0_0_0_1px_rgba(255,255,255,0.65)]",
                    active === index && "scale-125 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]",
                  )}
                />
              ))}

              <AnimatePresence>
                {focus && (
                  // El contenedor posiciona; el hijo anima (framer-motion reescribe `transform`).
                  <div
                    key="tip"
                    className="pointer-events-none absolute z-20"
                    style={{
                      left: `${((column + (align === "center" ? 0.5 : align === "right" ? 1 : 0)) / weeks) * 100}%`,
                      top: `${(row / 7) * 100}%`,
                      transform: `translate(${align === "center" ? "-50%" : align === "right" ? "-100%" : "0"}, calc(-100% - 8px))`,
                    }}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="w-max max-w-[240px] rounded-xl border border-white/10 bg-black/90 px-3 py-2 shadow-2xl backdrop-blur-xl"
                    >
                      <p className="text-[11px] text-white">{sentence(formatDay(focus.key))}</p>
                      {describeDay(focus).map((line) => <p key={line} className="mt-0.5 text-[10px] text-white/55">{line}</p>)}
                      {focus.notePath && <p className="mt-1 text-[9px] text-white/30">Clic para abrir el diario</p>}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4 text-[10px] text-white/35">
        <span>
          <span className="font-mono text-white/60">{view.calendar.other90}</span> {view.calendar.other90 === 1 ? "día" : "días"} de fútbol u otra actividad · racha máx. <span className="font-mono text-white/60">{view.streak.best}</span>
        </span>
        <span className="hidden items-center gap-1.5 md:flex"><Kbd>←</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>→</Kbd> recorrer · <Kbd>↵</Kbd> abrir diario</span>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Volumen semanal por músculo
// ---------------------------------------------------------------------------

export function MuscleVolumePanel({ muscles, defaultSets }: { muscles: MuscleVolume[]; defaultSets: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(1, ...muscles.map((muscle) => Math.max(muscle.planned, muscle.done)));
  const done = muscles.reduce((sum, muscle) => sum + muscle.done, 0);
  const planned = muscles.reduce((sum, muscle) => sum + muscle.planned, 0);
  const inspected = muscles.find((muscle) => muscle.id === hovered) ?? null;

  return (
    <Panel className="flex flex-col p-5 sm:p-6 lg:col-span-4">
      <div className="flex items-start justify-between">
        <div>
          <Eyebrow>Volumen semanal</Eyebrow>
          <p className="mt-2 flex items-baseline gap-2 font-mono text-white">
            <NumberTicker value={done} className="text-[28px] leading-none tracking-[-0.04em]" />
            <span className="text-[11px] text-white/40">/ {planned} series</span>
          </p>
        </div>
        <span className="flex items-center gap-2 text-[9px] text-white/30">
          <span className="h-1.5 w-3 rounded-full bg-white" />hecho
          <span className="ml-1 h-2.5 w-px bg-white/50" />plan
        </span>
      </div>

      {!muscles.length ? (
        <Empty icon={<Dumbbell className="h-4 w-4" />} title="Sin plan de músculos" hint="Cuando la rutina tenga ejercicios, aquí verás las series por grupo." className="flex-1" />
      ) : (
        <ul className="mt-5 flex flex-1 flex-col gap-1" onPointerLeave={() => setHovered(null)}>
          {muscles.map((muscle, index) => (
            <li key={muscle.id}>
              <button
                type="button"
                onPointerEnter={() => setHovered(muscle.id)}
                onFocus={() => setHovered(muscle.id)}
                onClick={() => setHovered((current) => (current === muscle.id ? null : muscle.id))}
                className={cx("grid w-full grid-cols-[84px_1fr_40px] items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition-colors", hovered === muscle.id ? "bg-white/[0.04]" : "hover:bg-white/[0.025]")}
              >
                <span className={cx("truncate text-[11px] transition-colors", hovered === muscle.id ? "text-white" : "text-white/55")}>{muscle.name}</span>
                <span className="relative h-1.5 rounded-full bg-white/[0.06]">
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${(muscle.done / max) * 100}%` }}
                    transition={{ delay: 0.2 + index * 0.04, duration: 0.6, ease: EASE }}
                  />
                  {muscle.planned > 0 && <span className="absolute -top-1 h-3.5 w-px bg-white/50" style={{ left: `calc(${(muscle.planned / max) * 100}% - 0.5px)` }} />}
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-white/45">{muscle.done}/{muscle.planned}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 min-h-[34px] border-t border-white/[0.05] pt-3 text-[10px] leading-relaxed text-white/35">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={inspected?.id ?? "idle"} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            {inspected ? (
              <><span className="text-white/70">{inspected.name}</span> · {inspected.exercises.join(", ") || "sin ejercicios"}</>
            ) : (
              `Series de esta semana contra el split (${defaultSets} por ejercicio).`
            )}
          </motion.p>
        </AnimatePresence>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Récords
// ---------------------------------------------------------------------------

function liftId(name: string): string {
  return `lift-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function LiftValue({ lift, large = false }: { lift: LiftCard; large?: boolean }) {
  const size = large ? "text-[44px]" : "text-[26px]";
  if (lift.best) {
    return (
      <p className="flex items-baseline gap-1.5 font-mono leading-none tracking-[-0.045em] text-white">
        <NumberTicker value={lift.best.kg} decimals={lift.best.kg % 1 ? 1 : 0} className={size} />
        <span className="text-[11px] tracking-normal text-white/40">kg</span>
        <span className="ml-1 text-[10px] tracking-normal text-white/25">{formatNumber(lift.best.kg * LB_PER_KG, 0)} lb</span>
      </p>
    );
  }
  if (lift.mention) {
    return (
      <p className="flex items-baseline gap-1.5 font-mono leading-none tracking-[-0.045em] text-white/80">
        <NumberTicker value={lift.mention.value} className={size} />
        <span className="text-[11px] tracking-normal text-white/40">{lift.mention.unit}</span>
        <span className="ml-1 rounded-full border border-white/[0.1] px-1.5 py-0.5 text-[9px] tracking-normal text-white/40">bóveda</span>
      </p>
    );
  }
  return <p className={cx("font-mono leading-none text-white/20", size)}>—</p>;
}

export function LiftsPanel({ lifts, todayKey }: { lifts: LiftCard[]; todayKey: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const selected = lifts.find((lift) => lift.name === open) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Panel className="p-5 sm:p-6 lg:col-span-8">
      <div className="flex items-center justify-between">
        <Eyebrow>Récords por levantamiento</Eyebrow>
        <Trophy className="h-3.5 w-3.5 text-white/25" />
      </div>
      {!lifts.length ? (
        <Empty icon={<Trophy className="h-4 w-4" />} title="Aún no hay levantamientos" hint="Registra series con peso en una sesión y aparecerán tus récords con su tendencia." />
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3">
          {lifts.map((lift) => (
            <motion.button
              key={lift.name}
              type="button"
              layoutId={liftId(lift.name)}
              onClick={() => setOpen(lift.name)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              transition={spring}
              className="group flex min-h-[136px] min-w-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-3.5 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.03] sm:min-h-[148px] sm:p-4"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-white/80 group-hover:text-white" title={lift.name}>{lift.name}</p>
                  <p className="mt-0.5 text-[10px] text-white/30">{muscleName(lift.muscleId)}</p>
                </div>
                {lift.change !== null && lift.change !== 0 && (
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-white/60">{lift.change > 0 ? "+" : "−"}{formatNumber(Math.abs(lift.change), 1)} kg</span>
                )}
              </div>
              <div className="mt-4">
                <LiftValue lift={lift} />
              </div>
              <div className="mt-auto w-full pt-3">
                {lift.series.length >= 2 ? (
                  <Sparkline points={lift.series} height={26} />
                ) : (
                  <p className="text-[10px] text-white/28">
                    {lift.last ? `Última ${formatShort(lift.last.key)}` : lift.mention ? `Citado ${lift.mention.key ? relativeDay(lift.mention.key, todayKey) : "en la bóveda"}` : "Sin registros todavía"}
                  </p>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <Portal key="lift-detail">
          <motion.div
            key="lift-backdrop"
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 backdrop-blur-md sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <motion.div
              layoutId={liftId(selected.name)}
              transition={spring}
              role="dialog"
              aria-modal="true"
              aria-label={selected.name}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-[640px] overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#0b0b0b] p-5 shadow-2xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Eyebrow>{muscleName(selected.muscleId)} · {selected.sessions ? `${selected.sessions} ${selected.sessions === 1 ? "sesión" : "sesiones"}` : "sin sesiones registradas"}</Eyebrow>
                  <p className="mt-1.5 truncate text-[18px] font-medium tracking-[-0.02em] text-white">{selected.name}</p>
                </div>
                <button type="button" autoFocus onClick={() => setOpen(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/[0.07] hover:text-white active:scale-[0.92]" aria-label="Cerrar (Esc)">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Eyebrow className="text-[9px]">Mejor marca</Eyebrow>
                  <div className="mt-2"><LiftValue lift={selected} large /></div>
                </div>
                {selected.last && (
                  <div className="text-right">
                    <Eyebrow className="text-[9px]">Última</Eyebrow>
                    <p className="mt-2 font-mono text-[13px] text-white/75">{formatNumber(selected.last.kg, 1)} kg × {selected.last.reps}</p>
                    <p className="text-[10px] text-white/35">{formatDay(selected.last.key)}</p>
                  </div>
                )}
              </div>
              <div className="mt-5">
                <TrendChart points={selected.series} unit="kg" label={`Progresión de ${selected.name}`} height={190} emptyHint="Registra este ejercicio para ver su progresión" />
              </div>
              {selected.log.length > 0 && (
                <div className="mt-4 max-h-[180px] overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/28">
                        <th className="py-1.5 text-left font-normal">Fecha</th>
                        <th className="py-1.5 text-right font-normal">Peso</th>
                        <th className="py-1.5 text-right font-normal">Reps</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {selected.log.map((entry, index) => (
                        <tr key={`${entry.key}-${index}`}>
                          <td className="py-2 text-white/55">{formatDay(entry.key)}</td>
                          <td className="py-2 text-right font-mono tabular-nums text-white/80">{formatNumber(entry.kg, 1)} kg</td>
                          <td className="py-2 text-right font-mono tabular-nums text-white/50">{entry.reps}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {selected.mention && (
                <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <Eyebrow className="text-[9px]">En tu bóveda{selected.mention.key ? ` · ${formatShort(selected.mention.key)}` : ""}</Eyebrow>
                    <NoteLink note={selected.mention.source} />
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/65">{selected.mention.text}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Sesiones recientes
// ---------------------------------------------------------------------------

export function RecentSessionsPanel({ sessions, totals, todayKey }: { sessions: RecentSession[]; totals: GymView["totals"]; todayKey: string }) {
  return (
    <Panel className="flex flex-col p-5 sm:p-6 lg:col-span-4">
      <div className="flex items-center justify-between">
        <Eyebrow>Sesiones</Eyebrow>
        <History className="h-3.5 w-3.5 text-white/25" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-[28px] leading-none tracking-[-0.04em] text-white"><NumberTicker value={totals.sessions} /></p>
          <p className="mt-1 text-[10px] text-white/35">registradas</p>
        </div>
        <div>
          <p className="font-mono text-[28px] leading-none tracking-[-0.04em] text-white"><NumberTicker value={totals.weekVolume} /></p>
          <p className="mt-1 text-[10px] text-white/35">kg esta semana</p>
        </div>
      </div>
      {!sessions.length ? (
        <Empty
          icon={<CalendarDays className="h-4 w-4" />}
          title="Sin sesiones guardadas"
          hint={<>Presiona <Kbd>N</Kbd> para registrar la primera.</>}
          className="flex-1"
        />
      ) : (
        <ul className="mt-4 flex-1 divide-y divide-white/[0.05]">
          {sessions.slice(0, 6).map((session, index) => (
            <motion.li
              key={session.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.04, duration: 0.2 }}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] text-white/75">{session.title}</p>
                <p className="mt-0.5 text-[10px] text-white/30">{sentence(relativeDay(session.key, todayKey))} · {session.duration} min · {session.sets} series</p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-white/50">{compactKg(session.volume)} kg</span>
            </motion.li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
