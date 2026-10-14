"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, Dumbbell, Flag, Flame, MapPin, Moon, Play, Scale, Users, Zap, type LucideIcon } from "lucide-react";
import { formatDay, formatShort, WEEKDAY_NAMES, WEEKDAY_SHORT, weekdayOf } from "./lib/dates";
import { muscleName } from "./lib/muscles";
import { fold } from "./lib/text";
import type { DayStatus, GymView, RoutineKind } from "./lib/types";
import { cx, EASE, Eyebrow, formatNumber, Kbd, NoteLink, NumberTicker, Panel, Sparkline, spring } from "./ui";

export const KIND_ICON: Record<RoutineKind, LucideIcon> = { fuerza: Dumbbell, rendimiento: Zap, descanso: Moon, partido: Flag };
export const KIND_LABEL: Record<RoutineKind, string> = { fuerza: "Fuerza", rendimiento: "Rendimiento", descanso: "Descanso", partido: "Partido" };

const STATUS_LABEL: Record<DayStatus, string> = {
  hecho: "Completado",
  otro: "Otra actividad",
  pendiente: "Pendiente",
  "sin-registro": "Sin registro",
  proximo: "Próximo",
  descanso: "Descanso",
};

export function TodayPanel({
  view,
  selected,
  onSelect,
  onStart,
  sessionClock,
}: {
  view: GymView;
  selected: number;
  onSelect: (weekday: number) => void;
  onStart: () => void;
  sessionClock: string | null;
}) {
  const todayWeekday = weekdayOf(view.todayKey);
  const isToday = selected === todayWeekday;
  const day = view.routine.days[selected];
  const Icon = KIND_ICON[day.kind];
  const nextDay = view.next ? view.routine.days[view.next.weekday] : null;
  const partner = view.partners[0];
  const todayOther = view.calendar.days.find((item) => item.key === view.todayKey)?.other ?? null;
  const todayLabel = view.today.status === "otro" ? todayOther ?? STATUS_LABEL.otro : STATUS_LABEL[view.today.status];

  return (
    <Panel className="flex flex-col p-5 sm:p-6 lg:col-span-7">
      <div className="flex items-start justify-between gap-4">
        <Eyebrow>{isToday ? `Hoy · ${formatDay(view.todayKey)}` : `Vista previa · ${WEEKDAY_NAMES[selected]}`}</Eyebrow>
        {view.routine.source ? (
          <NoteLink note={view.routine.source} className="shrink-0">{view.routine.source.title}</NoteLink>
        ) : (
          <span className="shrink-0 font-mono text-[10px] text-white/30">Plantilla local</span>
        )}
      </div>

      <div className="mt-4 min-h-[76px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={selected} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: EASE }}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-[30px] font-medium leading-none tracking-[-0.045em] text-white sm:text-[36px]">{day.kind === "descanso" && isToday ? "Descanso" : day.name}</p>
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-white/[0.09] px-2.5 text-[10px] text-white/55">
                <Icon className="h-3 w-3" />
                {KIND_LABEL[day.kind]}
              </span>
              {isToday && (
                <span className={cx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px]", view.today.status === "hecho" ? "bg-white text-black" : "bg-white/[0.06] text-white/60")}>
                  {view.today.status === "hecho" && <Check className="h-3 w-3" strokeWidth={2.5} />}
                  {todayLabel}
                </span>
              )}
            </div>
            <p className="mt-2 text-[12px] text-white/45">
              {day.focus ?? (day.kind === "descanso" || day.kind === "partido" ? day.notes[0] ?? "Recuperación" : `${day.exercises.length} ejercicios`)}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Semana */}
      <div className="mt-5 grid grid-cols-7 gap-1" role="tablist" aria-label="Días de la semana">
        {view.week.days.map((item) => {
          const KindIcon = KIND_ICON[item.plan.kind];
          const active = item.weekday === selected;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(item.weekday)}
              title={`${WEEKDAY_NAMES[item.weekday]} · ${item.plan.name} · ${STATUS_LABEL[item.status]}`}
              className="group relative flex flex-col items-center gap-1.5 rounded-xl py-2.5 transition active:scale-[0.96]"
            >
              {active && <motion.span layoutId="gym-day-pill" transition={spring} className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-inset ring-white/[0.08]" />}
              <span className={cx("relative font-mono text-[10px]", active ? "text-white/80" : "text-white/35 group-hover:text-white/60")}>{WEEKDAY_SHORT[item.weekday]}</span>
              <span
                className={cx(
                  "relative flex h-7 w-7 items-center justify-center rounded-full transition",
                  item.status === "hecho" && "bg-white text-black",
                  item.status === "otro" && "text-white/80 ring-1 ring-white/45",
                  item.status === "pendiente" && "text-white ring-1 ring-white/70",
                  item.status === "sin-registro" && "text-white/20 ring-1 ring-white/10",
                  item.status === "proximo" && "text-white/50 ring-1 ring-white/[0.1]",
                  item.status === "descanso" && "text-white/25",
                )}
              >
                {item.status === "hecho" ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : <KindIcon className="h-3.5 w-3.5" />}
              </span>
              <span className="relative font-mono text-[9px] text-white/25">{Number(item.key.slice(8))}</span>
              {item.isToday && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-white" />}
            </button>
          );
        })}
      </div>

      {/* Ejercicios del día seleccionado */}
      <div className="mt-5 min-h-[120px] flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.ol
            key={selected}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.025 } } }}
            className="grid gap-x-6 sm:grid-cols-2"
          >
            {(day.exercises.length ? day.exercises.map((item) => ({ name: item.name, meta: item.muscleId ? muscleName(item.muscleId) : null })) : day.notes.map((note) => ({ name: note, meta: null }))).map((item, index) => {
              const ghost = view.ghosts[fold(item.name)];
              return (
                <motion.li
                  key={`${item.name}-${index}`}
                  variants={{ hidden: { opacity: 0, x: -4 }, visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE } } }}
                  className="group flex min-w-0 items-center gap-3 border-b border-white/[0.045] py-2.5"
                >
                  {day.exercises.length > 0 && <span className="w-5 shrink-0 font-mono text-[10px] text-white/25">{String(index + 1).padStart(2, "0")}</span>}
                  <span className="min-w-0 flex-1 truncate text-[12px] text-white/70 transition-colors group-hover:text-white" title={item.name}>{item.name}</span>
                  {ghost && ghost.value !== null ? (
                    <span className="shrink-0 font-mono text-[10px] text-white/45">{formatNumber(ghost.value, ghost.value % 1 ? 1 : 0)} {ghost.unit}</span>
                  ) : item.meta ? (
                    <span className="shrink-0 text-[10px] text-white/25">{item.meta}</span>
                  ) : null}
                </motion.li>
              );
            })}
          </motion.ol>
        </AnimatePresence>
      </div>

      {/* Acción */}
      <div className="mt-5 flex flex-col gap-4 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <motion.button
          type="button"
          onClick={onStart}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={spring}
          className={cx(
            "group flex h-11 items-center justify-center gap-2.5 rounded-xl px-4 text-[12px] font-medium transition-colors sm:justify-start",
            sessionClock || day.exercises.length ? "bg-white text-black hover:bg-white/90" : "border border-white/[0.1] text-white/80 hover:bg-white/[0.05]",
          )}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {sessionClock ? (
            <>Continuar sesión <span className="font-mono tabular-nums opacity-60">{sessionClock}</span></>
          ) : day.exercises.length ? (
            `Iniciar ${day.name}`
          ) : (
            "Sesión libre"
          )}
          <Kbd tone={sessionClock || day.exercises.length ? "light" : "dark"}>N</Kbd>
        </motion.button>

        <div className="flex flex-col gap-1.5 text-[11px] text-white/40 sm:items-end sm:text-right">
          {nextDay && view.next && (
            <p>
              Siguiente: <span className="text-white/70">{formatDay(view.next.key)}</span> · {nextDay.name}
              {nextDay.focus ? ` — ${nextDay.focus}` : ""}
            </p>
          )}
          {(view.schedule.time || partner) && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/35 sm:justify-end">
              {view.schedule.time && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{view.schedule.time}</span>}
              {view.schedule.place && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{view.schedule.place}</span>}
              {partner && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />con {partner.name}</span>}
            </p>
          )}
          <p className="hidden items-center gap-1.5 text-[10px] text-white/25 md:flex"><Kbd>←</Kbd><Kbd>→</Kbd> cambiar día</p>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

function Tile({ label, icon: Icon, children, caption }: { label: string; icon: LucideIcon; children: React.ReactNode; caption: React.ReactNode }) {
  return (
    <Panel className="group flex min-h-[168px] flex-col p-4 transition-colors hover:border-white/[0.12] sm:p-5">
      <div className="flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        <Icon className="h-3.5 w-3.5 text-white/25 transition-colors group-hover:text-white/50" />
      </div>
      <div className="mt-3 flex-1">{children}</div>
      <div className="mt-3 text-[10px] leading-relaxed text-white/35">{caption}</div>
    </Panel>
  );
}

function BigNumber({ value, decimals = 0, unit, suffix }: { value: number | null; decimals?: number; unit?: string; suffix?: React.ReactNode }) {
  return (
    <p className="flex items-baseline gap-1.5 font-mono leading-none tracking-[-0.05em] text-white">
      {value === null ? <span className="text-[34px] text-white/25">—</span> : <NumberTicker value={value} decimals={decimals} className="text-[34px]" />}
      {suffix}
      {unit && <span className="text-[11px] tracking-normal text-white/40">{unit}</span>}
    </p>
  );
}

export function StatTiles({ view }: { view: GymView }) {
  const { streak, week, weight, recovery } = view;
  const target = week.target ?? 0;
  const remaining = Math.max(0, target - week.done);
  const recent = view.calendar.days.filter((day) => !day.future).slice(-14);
  const goalProgress = weight.current !== null && weight.start !== null && weight.goal !== null && weight.goal !== weight.start
    ? Math.min(1, Math.max(0, (weight.current - weight.start) / (weight.goal - weight.start)))
    : null;
  const delta = weight.current !== null && weight.start !== null ? weight.current - weight.start : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-5">
      <Tile
        label="Racha"
        icon={Flame}
        caption={streak.lastKey ? <>Mejor <span className="font-mono text-white/55">{streak.best}</span> · última {formatShort(streak.lastKey)}</> : "Tu primera sesión la enciende."}
      >
        <BigNumber value={streak.current} unit={streak.current === 1 ? "sesión" : "sesiones"} />
        <div className="mt-4 flex gap-[3px]" aria-hidden>
          {recent.map((day, index) => (
            <motion.span
              key={day.key}
              initial={{ scaleY: 0.2, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: 0.25 + index * 0.02, duration: 0.25, ease: EASE }}
              title={formatDay(day.key)}
              className={cx("h-3 flex-1 origin-bottom rounded-[2px]", day.trained ? "bg-white/85" : day.other ? "bg-white/30" : "bg-white/[0.07]")}
            />
          ))}
        </div>
      </Tile>

      <Tile
        label="Semana"
        icon={Dumbbell}
        caption={target ? (remaining ? `Faltan ${remaining} ${remaining === 1 ? "sesión" : "sesiones"} del split.` : "Meta semanal cumplida.") : "Sin meta semanal en la rutina."}
      >
        <BigNumber value={week.done} suffix={<span className="text-[20px] text-white/30">/{target || "—"}</span>} unit="sesiones" />
        <div className="mt-4 flex gap-1" aria-label={`${week.done} de ${target} sesiones`}>
          {Array.from({ length: Math.max(target, 1) }, (_, index) => (
            <span key={index} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.span
                className="absolute inset-0 origin-left rounded-full bg-white"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: index < week.done ? 1 : 0 }}
                transition={{ delay: 0.3 + index * 0.08, duration: 0.45, ease: EASE }}
              />
            </span>
          ))}
        </div>
      </Tile>

      <Tile
        label="Peso"
        icon={Scale}
        caption={
          weight.goal !== null && weight.current !== null ? (
            <>Meta <span className="font-mono text-white/55">{formatNumber(weight.goal, 0)} kg</span> · {weight.current >= weight.goal ? "alcanzada" : `faltan ${formatNumber(weight.goal - weight.current, 1)}`}{weight.source === "ficha" ? " · ref. ficha" : ""}</>
          ) : weight.current !== null ? "Sin meta definida en la bóveda." : "Registra tu peso en el diario o abajo."
        }
      >
        <BigNumber value={weight.current} decimals={1} unit="kg" />
        {delta !== null && <p className="mt-1.5 font-mono text-[10px] text-white/45">{delta >= 0 ? "+" : "−"}{formatNumber(Math.abs(delta), 1)} desde {formatNumber(weight.start ?? 0, 0)}</p>}
        {weight.series.length >= 2 ? (
          <Sparkline points={weight.series} className="mt-3" height={28} />
        ) : goalProgress !== null ? (
          <div className="relative mt-4 h-1.5 rounded-full bg-white/[0.08]">
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-white" initial={{ width: 0 }} animate={{ width: `${goalProgress * 100}%` }} transition={{ delay: 0.3, duration: 0.8, ease: EASE }} />
          </div>
        ) : null}
      </Tile>

      <Tile
        label="Recuperación"
        icon={Moon}
        caption={
          recovery.sleep.last !== null ? (
            <>Prom. <span className="font-mono text-white/55">{formatNumber(recovery.sleep.avg ?? 0, 1)} h</span>{recovery.energy.last !== null && <> · energía <span className="font-mono text-white/55">{recovery.energy.last}/10</span></>}</>
          ) : "Llena sueno_horas y energia en tu diario."
        }
      >
        <BigNumber value={recovery.sleep.last} decimals={recovery.sleep.last !== null && recovery.sleep.last % 1 ? 1 : 0} unit="h sueño" />
        {recovery.mood.last !== null && <p className="mt-1.5 font-mono text-[10px] text-white/45">Ánimo {recovery.mood.last}/10</p>}
        {recovery.sleep.series.length >= 2 && <Sparkline points={recovery.sleep.series} className="mt-3" height={28} />}
      </Tile>
    </div>
  );
}
