"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Minus, Plus, SkipForward, Trash2, Trophy, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveWorkoutSession } from "@/app/actions/gym";
import { muscleName } from "./lib/muscles";
import {
  formatClock,
  isSetPr,
  LB_PER_KG,
  newExercise,
  round1,
  summarizeDraft,
  uid,
  type DraftExercise,
  type DraftSet,
  type SessionDraft,
  type SessionSummary,
} from "./lib/session";
import { fold } from "./lib/text";
import type { Ghost } from "./lib/types";
import { cx, EASE, Eyebrow, formatNumber, Kbd, NumberTicker, spring, useNow } from "./ui";

type Updater = SessionDraft | null | ((current: SessionDraft | null) => SessionDraft | null);

type Props = {
  draft: SessionDraft;
  setDraft: (updater: Updater) => void;
  ghosts: Record<string, Ghost>;
  suggestions: string[];
  defaultSets: number;
  onMinimize: () => void;
  onClose: () => void;
};

function ghostFor(ghosts: Record<string, Ghost>, name: string): Ghost | undefined {
  return ghosts[fold(name)];
}

/** Valor sugerido del fantasma en la unidad de la serie. */
function ghostWeight(ghost: Ghost | undefined, unit: DraftSet["unit"]): string {
  if (!ghost || ghost.value === null) return "";
  if (ghost.unit === unit) return formatNumber(ghost.value, ghost.value % 1 ? 1 : 0);
  if (ghost.kg === null) return "";
  return formatNumber(round1(unit === "lb" ? ghost.kg * LB_PER_KG : ghost.kg), 1);
}

function ghostReps(ghost: Ghost | undefined, index: number, target: string | null): string {
  const parts = ghost?.reps.split(/[,\s]+/).filter(Boolean) ?? [];
  return parts[index] ?? parts[parts.length - 1] ?? (target && /\d/.test(target) ? target : "");
}

export default function ActiveSession({ draft, setDraft, ghosts, suggestions, defaultSets, onMinimize, onClose }: Props) {
  const router = useRouter();
  const now = useNow(1000);
  const [phase, setPhase] = useState<"logging" | "saving" | "done">("logging");
  const [result, setResult] = useState<(SessionSummary & { duration: number }) | null>(null);
  const [error, setError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [exerciseInput, setExerciseInput] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const finishButton = useRef<HTMLButtonElement>(null);

  const summary = useMemo(() => summarizeDraft(draft, ghosts), [draft, ghosts]);
  const elapsed = now ? (now - draft.startedAt) / 1000 : 0;
  const restLeft = draft.rest && now ? Math.max(0, (draft.rest.until - now) / 1000) : null;
  const restOver = Boolean(draft.rest && now && now >= draft.rest.until);

  // --- Mutaciones -----------------------------------------------------------
  const patchExercise = useCallback((exerciseId: string, patch: (exercise: DraftExercise) => DraftExercise) => {
    setDraft((current) => current && { ...current, exercises: current.exercises.map((exercise) => (exercise.id === exerciseId ? patch(exercise) : exercise)) });
  }, [setDraft]);

  const updateSet = (exerciseId: string, setId: string, patch: Partial<DraftSet>) => {
    patchExercise(exerciseId, (exercise) => ({ ...exercise, sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)) }));
  };

  const toggleDone = useCallback((exerciseId: string, setId: string, force?: boolean) => {
    const at = Date.now();
    setDraft((current) => {
      if (!current) return current;
      const set = current.exercises.find((exercise) => exercise.id === exerciseId)?.sets.find((item) => item.id === setId);
      if (!set) return current;
      const done = force ?? !set.done;
      return {
        ...current,
        rest: done && !set.done ? { until: at + current.restDefault * 1000, total: current.restDefault } : current.rest,
        exercises: current.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : { ...exercise, sets: exercise.sets.map((item) => (item.id === setId ? { ...item, done } : item)) }),
      };
    });
  }, [setDraft]);

  const addSet = (exerciseId: string) => {
    patchExercise(exerciseId, (exercise) => {
      const last = exercise.sets[exercise.sets.length - 1];
      return { ...exercise, sets: [...exercise.sets, { id: uid(), weight: last?.weight ?? "", reps: last?.reps ?? "", unit: last?.unit ?? "kg", done: false }] };
    });
  };

  const removeSet = (exerciseId: string, setId: string) => {
    patchExercise(exerciseId, (exercise) => ({ ...exercise, sets: exercise.sets.length > 1 ? exercise.sets.filter((set) => set.id !== setId) : exercise.sets }));
  };

  const removeExercise = (exerciseId: string) => {
    setDraft((current) => current && { ...current, exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId) });
  };

  const addExercise = (event: React.FormEvent) => {
    event.preventDefault();
    const name = exerciseInput.trim();
    if (!name) return;
    setDraft((current) => current && { ...current, exercises: [...current.exercises, newExercise(name, defaultSets, ghostFor(ghosts, name))] });
    setExerciseInput("");
  };

  const adjustRest = (delta: number) => {
    setDraft((current) => {
      if (!current?.rest) return current;
      const total = Math.max(15, current.rest.total + delta);
      return { ...current, restDefault: total, rest: { until: current.rest.until + delta * 1000, total } };
    });
  };

  // --- Teclado ----------------------------------------------------------------
  const focusField = (setId: string, field: "weight" | "reps") => {
    list.current?.querySelector<HTMLInputElement>(`[data-set="${setId}"][data-field="${field}"]`)?.focus();
  };

  const focusNextOpen = (afterSetId: string) => {
    const inputs = [...(list.current?.querySelectorAll<HTMLInputElement>('[data-field="weight"]') ?? [])];
    const start = inputs.findIndex((input) => input.dataset.set === afterSetId);
    const next = inputs.slice(start + 1).find((input) => input.dataset.done === "false");
    if (next) next.focus();
    else finishButton.current?.focus();
  };

  const finish = useCallback(async () => {
    if (phase !== "logging") return;
    const final = summarizeDraft(draft, ghosts);
    if (!final.payload.length) {
      setError("Registra al menos una serie con repeticiones.");
      return;
    }
    setPhase("saving");
    setError("");
    const duration = Math.max(1, Math.round((Date.now() - draft.startedAt) / 60_000));
    const response = await saveWorkoutSession(draft.title, duration, final.volume, final.payload).catch(() => ({ success: false }));
    if (!response.success) {
      setPhase("logging");
      setError("No se pudo guardar. Tu sesión sigue aquí.");
      return;
    }
    setResult({ ...final, duration });
    setPhase("done");
    router.refresh();
  }, [draft, ghosts, phase, router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (phase === "done" && (event.key === "Enter" || event.key === "Escape")) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onMinimize();
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, onClose, onMinimize, phase]);

  // Enfoca la primera serie abierta (sólo con puntero fino para no abrir el teclado en el teléfono).
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const timer = window.setTimeout(() => list.current?.querySelector<HTMLInputElement>('[data-field="weight"][data-done="false"]')?.focus(), 260);
    return () => window.clearTimeout(timer);
  }, []);

  // Fin del descanso: vibración y cierre suave del contador.
  useEffect(() => {
    if (!restOver) return;
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {
      // Sin soporte de vibración.
    }
    const timer = window.setTimeout(() => setDraft((current) => (current?.rest && Date.now() >= current.rest.until ? { ...current, rest: null } : current)), 1600);
    return () => window.clearTimeout(timer);
  }, [restOver, setDraft]);

  // Bloquea el scroll del fondo mientras la hoja está abierta.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const progress = summary.totalSets ? summary.doneSets / summary.totalSets : 0;

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex justify-center bg-black/70 backdrop-blur-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Sesión: ${draft.title}`}
    >
      <motion.div
        initial={{ y: 28, scale: 0.985, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 28, scale: 0.985, opacity: 0 }}
        transition={spring}
        className="relative flex h-full w-full max-w-[880px] flex-col overflow-hidden bg-[#0a0a0a]/95 md:my-4 md:h-[calc(100%-2rem)] md:rounded-[28px] md:border md:border-white/[0.08]"
      >
        <AnimatePresence mode="wait" initial={false}>
          {phase === "done" && result ? (
            <Victory key="done" title={draft.title} result={result} onClose={onClose} />
          ) : (
            <motion.div key="log" className="flex min-h-0 flex-1 flex-col" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.18 }}>
              {/* Encabezado */}
              <div className="shrink-0 border-b border-white/[0.06] px-4 pb-3 pt-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onMinimize}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/[0.06] hover:text-white active:scale-[0.94]"
                    aria-label="Minimizar sesión (Esc)"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <Eyebrow className="flex items-center gap-2">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      Sesión en curso{draft.subtitle ? ` · ${draft.subtitle}` : ""}
                    </Eyebrow>
                    <p className="mt-1 truncate text-[15px] font-medium tracking-[-0.01em] text-white">{draft.title}</p>
                  </div>
                  <span className="hidden font-mono text-[22px] tabular-nums tracking-[-0.03em] text-white sm:block" aria-label="Tiempo transcurrido">{formatClock(elapsed)}</span>
                  <button
                    ref={finishButton}
                    type="button"
                    onClick={() => void finish()}
                    disabled={phase === "saving"}
                    className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-white px-3.5 text-[12px] font-medium text-black transition hover:bg-white/90 active:scale-[0.97] disabled:opacity-60"
                  >
                    {phase === "saving" ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                    {phase === "saving" ? "Guardando…" : "Finalizar"}
                    <Kbd tone="light" className="hidden md:inline-flex">⌘↵</Kbd>
                  </button>
                </div>

                <div className="mt-4 flex items-end justify-between gap-4">
                  <div className="flex items-end gap-6">
                    <Metric label="Tiempo" className="sm:hidden" value={formatClock(elapsed)} />
                    <Metric label="Series" value={`${summary.doneSets}/${summary.totalSets}`} />
                    <div>
                      <Eyebrow className="text-[9px]">Volumen</Eyebrow>
                      <p className="mt-1 font-mono text-[15px] text-white">
                        <NumberTicker value={summary.volume} /> <span className="text-[10px] text-white/40">kg</span>
                      </p>
                    </div>
                    <Metric label="PRs" value={String(summary.prs.length)} />
                  </div>
                  <div className="hidden items-center gap-3 text-[10px] text-white/30 md:flex">
                    <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> siguiente</span>
                    <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> minimizar</span>
                  </div>
                </div>
              </div>
              <div className="h-px w-full shrink-0 bg-white/[0.04]">
                <motion.div className="h-px bg-white" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.4, ease: EASE }} />
              </div>

              {/* Ejercicios */}
              <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-40 sm:px-6">
                <AnimatePresence initial={false}>
                  {draft.exercises.map((exercise, index) => {
                    const ghost = ghostFor(ghosts, exercise.name);
                    return (
                      <motion.div
                        key={exercise.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        className="group/exercise border-b border-white/[0.05] py-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2.5">
                              <span className="font-mono text-[10px] text-white/28">{String(index + 1).padStart(2, "0")}</span>
                              <p className="truncate text-[14px] font-medium text-white/90">{exercise.name}</p>
                            </div>
                            <p className="mt-1 pl-[26px] text-[10px] text-white/35">
                              {muscleName(exercise.muscleId)}
                              {ghost && ghost.value !== null && <> · <span className="font-mono">Último {formatNumber(ghost.value, ghost.value % 1 ? 1 : 0)} {ghost.unit}{ghost.reps ? ` × ${ghost.reps}` : ""}</span></>}
                              {exercise.target && <> · {exercise.target}</>}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExercise(exercise.id)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/25 transition hover:bg-white/[0.06] hover:text-white/70 active:scale-[0.94] sm:opacity-0 sm:group-hover/exercise:opacity-100 sm:focus-visible:opacity-100"
                            aria-label={`Quitar ${exercise.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-[30px_minmax(0,1fr)_minmax(0,1fr)_36px_24px] items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/22">
                          <span className="text-center">#</span>
                          <span className="pl-1">Peso</span>
                          <span className="pl-1">Reps</span>
                          <span />
                          <span />
                        </div>

                        <div className="mt-1.5 flex flex-col gap-1.5">
                          <AnimatePresence initial={false}>
                            {exercise.sets.map((set, setIndex) => (
                              <SetRow
                                key={set.id}
                                set={set}
                                index={setIndex}
                                ghost={ghost}
                                target={exercise.target}
                                canRemove={exercise.sets.length > 1}
                                onChange={(patch) => updateSet(exercise.id, set.id, patch)}
                                onToggle={() => toggleDone(exercise.id, set.id)}
                                onRemove={() => removeSet(exercise.id, set.id)}
                                onWeightEnter={() => focusField(set.id, "reps")}
                                onRepsEnter={() => {
                                  if (!set.reps.trim()) return;
                                  if (!set.done) toggleDone(exercise.id, set.id, true);
                                  window.requestAnimationFrame(() => focusNextOpen(set.id));
                                }}
                              />
                            ))}
                          </AnimatePresence>
                        </div>

                        <button
                          type="button"
                          onClick={() => addSet(exercise.id)}
                          className="ml-[38px] mt-2 flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] text-white/35 transition hover:bg-white/[0.05] hover:text-white active:scale-[0.97]"
                        >
                          <Plus className="h-3 w-3" /> Serie
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {!draft.exercises.length && (
                  <div className="py-14 text-center">
                    <p className="text-[12px] text-white/55">Sesión libre</p>
                    <p className="mt-1 text-[11px] text-white/30">Agrega tu primer ejercicio abajo.</p>
                  </div>
                )}

                <form onSubmit={addExercise} className="mt-5 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Plus className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                    <input
                      value={exerciseInput}
                      onChange={(event) => setExerciseInput(event.target.value)}
                      list="gym-exercise-suggestions"
                      placeholder="Agregar ejercicio…"
                      className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.02] pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.04]"
                    />
                    <datalist id="gym-exercise-suggestions">
                      {suggestions.map((name) => <option key={name} value={name} />)}
                    </datalist>
                  </div>
                  <button type="submit" className="h-11 rounded-xl border border-white/[0.08] px-4 text-[12px] text-white/70 transition hover:bg-white/[0.06] hover:text-white active:scale-[0.97]">Agregar</button>
                </form>

                <div className="mt-8 flex items-center justify-between gap-3">
                  <AnimatePresence mode="wait" initial={false}>
                    {error ? (
                      <motion.p key="error" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="text-[11px] text-white/70">{error}</motion.p>
                    ) : <span key="none" />}
                  </AnimatePresence>
                  <button
                    type="button"
                    onClick={() => (confirmDiscard ? onClose() : setConfirmDiscard(true))}
                    onBlur={() => setConfirmDiscard(false)}
                    className={cx("flex h-9 items-center gap-2 rounded-xl px-3 text-[11px] transition active:scale-[0.97]", confirmDiscard ? "bg-white/[0.1] text-white" : "text-white/35 hover:bg-white/[0.05] hover:text-white/70")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {confirmDiscard ? "¿Descartar sesión? Toca otra vez" : "Descartar"}
                  </button>
                </div>
              </div>

              {/* Descanso */}
              <AnimatePresence>
                {draft.rest && restLeft !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 24, scale: 0.96 }}
                    transition={spring}
                    className="absolute inset-x-0 bottom-5 z-10 mx-auto flex w-max items-center gap-1 rounded-2xl border border-white/[0.1] bg-black/85 p-1.5 pl-3 shadow-2xl backdrop-blur-2xl"
                    role="timer"
                    aria-live="polite"
                  >
                    <RestRing left={restLeft} total={draft.rest.total} />
                    <div className="ml-2 mr-2 min-w-[64px]">
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">{restOver ? "Listo" : "Descanso"}</p>
                      <p className="font-mono text-[17px] tabular-nums leading-tight text-white">{restOver ? "¡Va!" : formatClock(restLeft)}</p>
                    </div>
                    <RestButton label="−15 s" onClick={() => adjustRest(-15)}><Minus className="h-3.5 w-3.5" /></RestButton>
                    <RestButton label="+15 s" onClick={() => adjustRest(15)}><Plus className="h-3.5 w-3.5" /></RestButton>
                    <RestButton label="Saltar descanso" onClick={() => setDraft((current) => current && { ...current, rest: null })}><SkipForward className="h-3.5 w-3.5" /></RestButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <Eyebrow className="text-[9px]">{label}</Eyebrow>
      <p className="mt-1 font-mono text-[15px] tabular-nums text-white">{value}</p>
    </div>
  );
}

function RestButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.92]">
      {children}
    </button>
  );
}

function RestRing({ left, total }: { left: number; total: number }) {
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const ratio = total ? Math.min(1, left / total) : 0;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90" aria-hidden>
      <circle cx="14" cy="14" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      <motion.circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        stroke="rgb(255,255,255)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: circumference * (1 - ratio) }}
        transition={{ duration: 0.9, ease: "linear" }}
      />
    </svg>
  );
}

function SetRow({
  set,
  index,
  ghost,
  target,
  canRemove,
  onChange,
  onToggle,
  onRemove,
  onWeightEnter,
  onRepsEnter,
}: {
  set: DraftSet;
  index: number;
  ghost: Ghost | undefined;
  target: string | null;
  canRemove: boolean;
  onChange: (patch: Partial<DraftSet>) => void;
  onToggle: () => void;
  onRemove: () => void;
  onWeightEnter: () => void;
  onRepsEnter: () => void;
}) {
  const pr = isSetPr(set, ghost);
  const field = "h-11 w-full rounded-xl border bg-white/[0.02] px-3 font-mono text-[15px] text-white outline-none transition placeholder:text-white/20 focus:border-white/25 focus:bg-white/[0.05]";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      className="group/set"
    >
      <div className={cx("grid grid-cols-[30px_minmax(0,1fr)_minmax(0,1fr)_36px_24px] items-center gap-2 rounded-xl transition-opacity", set.done && "opacity-55")}>
        <div className="relative flex h-11 items-center justify-center">
          <span className="font-mono text-[11px] text-white/40">{index + 1}</span>
          <AnimatePresence>
            {pr && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 600, damping: 20 }}
                className="absolute -top-0.5 right-[-2px] flex h-4 items-center gap-0.5 rounded-full bg-white px-1 text-[8px] font-semibold text-black"
                title="Nuevo récord personal"
              >
                <Trophy className="h-2.5 w-2.5" />PR
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="relative">
          <input
            value={set.weight}
            onChange={(event) => onChange({ weight: event.target.value.replace(/[^\d.,]/g, "") })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
                event.preventDefault();
                onWeightEnter();
              }
            }}
            inputMode="decimal"
            placeholder={ghostWeight(ghost, set.unit) || "—"}
            aria-label={`Peso serie ${index + 1}`}
            data-set={set.id}
            data-field="weight"
            data-done={String(set.done)}
            className={cx(field, "pr-12", set.done ? "border-transparent" : "border-white/[0.07]")}
          />
          <button
            type="button"
            onClick={() => onChange({ unit: set.unit === "kg" ? "lb" : "kg" })}
            className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 rounded-lg px-2 font-mono text-[10px] uppercase text-white/45 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.94]"
            aria-label={`Cambiar unidad (ahora ${set.unit})`}
          >
            {set.unit}
          </button>
        </div>
        <input
          value={set.reps}
          onChange={(event) => onChange({ reps: event.target.value.replace(/\D/g, "").slice(0, 3) })}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              onRepsEnter();
            }
          }}
          inputMode="numeric"
          placeholder={ghostReps(ghost, index, target) || "—"}
          aria-label={`Repeticiones serie ${index + 1}`}
          data-set={set.id}
          data-field="reps"
          className={cx(field, set.done ? "border-transparent" : "border-white/[0.07]")}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={set.done}
          aria-label={set.done ? `Desmarcar serie ${index + 1}` : `Completar serie ${index + 1}`}
          className={cx(
            "flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-[0.9]",
            set.done ? "border-white bg-white text-black" : "border-white/[0.14] text-transparent hover:border-white/40 hover:text-white/40",
          )}
        >
          <motion.span key={String(set.done)} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 700, damping: 18 }}>
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </motion.span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="flex h-6 w-6 items-center justify-center rounded-md text-white/25 transition hover:bg-white/[0.06] hover:text-white/70 disabled:pointer-events-none disabled:opacity-0 sm:opacity-0 sm:group-hover/set:opacity-100 sm:focus-visible:opacity-100"
          aria-label={`Quitar serie ${index + 1}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function Victory({ title, result, onClose }: { title: string; result: SessionSummary & { duration: number }; onClose: () => void }) {
  const stats = [
    { label: "Volumen", value: result.volume, unit: "kg" },
    { label: "Duración", value: result.duration, unit: "min" },
    { label: "Series", value: result.loggedSets, unit: "" },
    { label: "PRs", value: result.prs.length, unit: "" },
  ];
  return (
    <motion.div
      key="victory"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="flex flex-1 flex-col items-center justify-center gap-9 overflow-y-auto p-8 text-center"
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 16 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-[0_0_80px_rgba(255,255,255,0.25)]"
      >
        <Check className="h-7 w-7" strokeWidth={2.6} />
      </motion.div>
      <div>
        <Eyebrow>Sesión guardada</Eyebrow>
        <p className="mt-2 text-[22px] font-medium tracking-[-0.03em] text-white">{title}</p>
      </div>
      <motion.div
        className="grid grid-cols-2 gap-x-12 gap-y-7 sm:grid-cols-4"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } } }}
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
            <Eyebrow className="text-[9px]">{stat.label}</Eyebrow>
            <p className="mt-1.5 font-mono text-[28px] leading-none tracking-[-0.04em] text-white">
              <NumberTicker value={stat.value} />
              {stat.unit && <span className="ml-1 text-[11px] text-white/40">{stat.unit}</span>}
            </p>
          </motion.div>
        ))}
      </motion.div>
      {result.prs.length > 0 && (
        <div className="w-full max-w-sm divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] text-left">
          {result.prs.map((pr) => (
            <div key={pr.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2 text-[12px] text-white/80"><Trophy className="h-3.5 w-3.5 shrink-0 text-white/60" /><span className="truncate">{pr.name}</span></span>
              <span className="shrink-0 font-mono text-[11px] text-white/50">{formatNumber(pr.previous, 1)} → <span className="text-white">{formatNumber(pr.kg, 1)} kg</span></span>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={onClose} autoFocus className="flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-[12px] font-medium text-black transition hover:bg-white/90 active:scale-[0.97]">
        Listo <Kbd tone="light">↵</Kbd>
      </button>
    </motion.div>
  );
}
