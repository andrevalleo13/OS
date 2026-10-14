"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { logWeight } from "@/app/actions/gym";
import { formatDay } from "./lib/dates";
import type { GymView } from "./lib/types";
import { cx, EASE, Eyebrow, formatNumber, isTypingTarget, Kbd, NoteLink, NumberTicker, Panel, Segmented, TrendChart, usePrefersReducedMotion } from "./ui";

/**
 * Espacio reservado para el modelo 3D que se construirá con las fotos de André.
 * Es un visor vacío a propósito: marco, retícula y lecturas reales, sin maniquí.
 */
export function BodySlot({ view }: { view: GymView }) {
  const { weight } = view;
  const reduce = usePrefersReducedMotion();
  const readouts = [
    { label: "Alt", value: weight.height !== null ? `${formatNumber(weight.height, 2)} m` : "—" },
    { label: "Peso", value: weight.current !== null ? `${formatNumber(weight.current, 1)} kg` : "—" },
    { label: "IMC", value: weight.bmi !== null ? formatNumber(weight.bmi, 1) : "—" },
    { label: "Meta", value: weight.goal !== null ? `${formatNumber(weight.goal, 0)} kg` : "—" },
  ];
  return (
    <Panel className="overflow-hidden lg:col-span-5">
      <div
        className="relative flex h-full min-h-[380px] flex-col items-center justify-center overflow-hidden rounded-[20px] p-6"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px), radial-gradient(circle at 50% 45%, rgba(255,255,255,0.05), transparent 60%)",
          backgroundSize: "14px 14px, 100% 100%",
        }}
      >
        {/* Esquinas del visor */}
        {["left-4 top-4 border-l border-t", "right-4 top-4 border-r border-t", "bottom-4 left-4 border-b border-l", "bottom-4 right-4 border-b border-r"].map((position) => (
          <span key={position} className={cx("absolute h-5 w-5 border-white/30", position)} />
        ))}

        {/* Lecturas */}
        <div className="absolute inset-x-7 top-7 flex justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
          <span>{readouts[0].label} <span className="text-white/65">{readouts[0].value}</span></span>
          <span>{readouts[1].label} <span className="text-white/65">{readouts[1].value}</span></span>
        </div>
        <div className="absolute inset-x-7 bottom-7 flex justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
          <span>{readouts[2].label} <span className="text-white/65">{readouts[2].value}</span></span>
          <span>{readouts[3].label} <span className="text-white/65">{readouts[3].value}</span></span>
        </div>

        {/* Línea de escaneo */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-x-10 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]"
          initial={{ top: "18%" }}
          animate={reduce ? { top: "50%" } : { top: ["18%", "82%", "18%"] }}
          transition={reduce ? { duration: 0 } : { duration: 6, ease: "easeInOut", repeat: Infinity }}
        />

        <div className="relative flex items-center justify-center" aria-hidden>
          {[220, 160, 100].map((size, index) => (
            <motion.span
              key={size}
              className="absolute rounded-full border border-white/[0.07]"
              style={{ width: size, height: size }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + index * 0.08, duration: 0.6, ease: EASE }}
            />
          ))}
          <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.12] bg-black/60 text-white/70 backdrop-blur">
            <ScanLine className="h-5 w-5" />
          </span>
        </div>

        <div className="relative mt-24 text-center">
          <Eyebrow>Próximamente</Eyebrow>
          <p className="mt-2 text-[20px] font-medium tracking-[-0.03em] text-white">Tu cuerpo en 3D</p>
          <p className="mx-auto mt-2 max-w-[280px] text-[11px] leading-relaxed text-white/40">
            Se construirá a partir de tus fotos. Este visor ya está reservado y leerá tus medidas reales.
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function WeightPanel({ view }: { view: GymView }) {
  const router = useRouter();
  const { weight } = view;
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [optimistic, setOptimistic] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const current = optimistic ?? weight.current;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "p" || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      setEditing(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number.parseFloat(input.replace(",", "."));
    if (!Number.isFinite(value) || value < 20 || value > 300) {
      setMessage("Escribe un peso válido en kg.");
      return;
    }
    startTransition(async () => {
      const result = await logWeight(Math.round(value * 10) / 10).catch(() => ({ success: false }));
      if (!result.success) {
        setMessage("No se pudo guardar.");
        return;
      }
      setOptimistic(Math.round(value * 10) / 10);
      setEditing(false);
      setInput("");
      setMessage("Peso guardado.");
      router.refresh();
    });
  };

  const references = [
    ...(weight.goal !== null ? [{ value: weight.goal, label: `Meta ${formatNumber(weight.goal, 0)}` }] : []),
    ...(weight.start !== null && weight.start !== weight.goal ? [{ value: weight.start, label: `Inicio ${formatNumber(weight.start, 0)}` }] : []),
  ];
  const progress = current !== null && weight.start !== null && weight.goal !== null && weight.goal !== weight.start
    ? Math.min(1, Math.max(0, (current - weight.start) / (weight.goal - weight.start)))
    : null;

  const facts = [
    { label: "Estatura", value: weight.height !== null ? `${formatNumber(weight.height, 2)} m` : "—" },
    { label: "IMC", value: weight.bmi !== null ? formatNumber(weight.bmi, 1) : "—" },
    { label: "Inicio", value: weight.start !== null ? `${formatNumber(weight.start, 1)} kg` : "—" },
    { label: "Meta", value: weight.goal !== null ? `${formatNumber(weight.goal, 1)} kg` : "—" },
  ];

  return (
    <Panel className="flex flex-col p-5 sm:p-6 lg:col-span-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>Peso corporal</Eyebrow>
          <div className="mt-2 flex items-baseline gap-2 font-mono text-white">
            {current === null ? <span className="text-[40px] leading-none text-white/25">—</span> : <NumberTicker value={current} decimals={1} className="text-[40px] leading-none tracking-[-0.05em]" />}
            <span className="text-[12px] text-white/40">kg</span>
          </div>
          <p className="mt-1.5 text-[10px] text-white/35">
            {weight.currentKey ? `${formatDay(weight.currentKey)} · ${weight.source === "db" ? "registro" : weight.source === "diario" ? "diario" : "ficha rápida"}` : "Sin registros"}
            {weight.change30 !== null && <> · <span className="font-mono text-white/55">{weight.change30 >= 0 ? "+" : "−"}{formatNumber(Math.abs(weight.change30), 1)} kg</span> en 30 días</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented layoutId="weight-mode" value={mode} onChange={setMode} options={[{ value: "chart", label: "Gráfica" }, { value: "table", label: "Tabla" }]} />
          <AnimatePresence mode="wait" initial={false}>
            {editing ? (
              <motion.form key="form" onSubmit={submit} initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2, ease: EASE }} className="flex items-center gap-1 overflow-hidden">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value.replace(/[^\d.,]/g, ""))}
                  onKeyDown={(event) => event.key === "Escape" && setEditing(false)}
                  inputMode="decimal"
                  placeholder={current !== null ? formatNumber(current, 1) : "kg"}
                  aria-label="Peso en kg"
                  className="h-7 w-20 rounded-lg border border-white/[0.12] bg-white/[0.04] px-2 font-mono text-[12px] text-white outline-none focus:border-white/30"
                />
                <button type="submit" disabled={isPending} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-black transition active:scale-[0.94] disabled:opacity-50" aria-label="Guardar peso">
                  {isPending ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/20 border-t-black" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                </button>
              </motion.form>
            ) : (
              <motion.button key="add" type="button" onClick={() => setEditing(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-7 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2 text-[10px] text-white/55 transition hover:bg-white/[0.05] hover:text-white active:scale-[0.96]">
                <Plus className="h-3 w-3" /> Registrar <Kbd className="hidden md:inline-flex">P</Kbd>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {progress !== null && weight.start !== null && weight.goal !== null && (
        <div className="mt-5">
          <div className="relative h-1 rounded-full bg-white/[0.07]">
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-white" initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ delay: 0.2, duration: 0.9, ease: EASE }} />
            <motion.span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-[3px] ring-[#0d0d0d]" initial={{ left: "0%" }} animate={{ left: `${progress * 100}%` }} transition={{ delay: 0.2, duration: 0.9, ease: EASE }} />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9px] text-white/30">
            <span className="whitespace-nowrap">{formatNumber(weight.start, 0)} kg</span>
            <span className="text-white/55">{Math.round(progress * 100)}% hacia la meta{weight.goalNote && <span className="hidden sm:inline"> · {weight.goalNote}</span>}</span>
            <span className="whitespace-nowrap">{formatNumber(weight.goal, 0)} kg</span>
          </div>
        </div>
      )}

      <div className="mt-5 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "chart" ? (
            <motion.div key="chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <TrendChart points={weight.series} references={references} unit="kg" label="Peso corporal" height={190} emptyHint="Anota tu peso en el diario o regístralo aquí para ver la tendencia" />
            </motion.div>
          ) : (
            <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="max-h-[190px] overflow-y-auto">
              {weight.series.length ? (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/28">
                      <th className="py-1.5 text-left font-normal">Fecha</th>
                      <th className="py-1.5 text-right font-normal">Peso</th>
                      <th className="py-1.5 text-right font-normal">Fuente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {[...weight.series].reverse().map((point) => (
                      <tr key={point.key}>
                        <td className="py-2 text-white/55">{formatDay(point.key)}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-white/80">{formatNumber(point.value, 1)} kg</td>
                        <td className="py-2 text-right text-white/35">{point.source === "db" ? "Registro" : "Diario"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="py-10 text-center text-[11px] text-white/30">Sin registros de peso.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="bg-[#0d0d0d] px-3.5 py-3">
            <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">{fact.label}</dt>
            <dd className="mt-1 font-mono text-[13px] text-white/80">{fact.value}</dd>
          </div>
        ))}
      </dl>

      {(view.traits.length > 0 || message) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {view.traits.map((trait) => (
            <span key={trait.label} title={trait.detail ?? undefined} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-white/45">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30">{trait.label}</span>
              <span className="text-white/75">{trait.value}</span>
            </span>
          ))}
          <AnimatePresence>
            {message && (
              <motion.span key={message} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-live="polite" className="ml-auto text-[10px] text-white/45">
                {message}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}

      {view.weight.source && view.sources.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.05] pt-3">
          {view.sources.slice(0, 3).map((source) => <NoteLink key={source.path} note={source} />)}
        </div>
      )}
    </Panel>
  );
}
