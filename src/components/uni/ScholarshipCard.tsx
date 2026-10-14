"use client";

import { motion } from "framer-motion";
import { useId, useState } from "react";
import { Scale } from "lucide-react";
import type { UniOverview } from "@/features/uni/types";
import { signed } from "./format";
import { cx, EASE, Label, Panel, PanelHeader, Ticker, Tip, TipRow } from "./primitives";

const LOW = 6;
const HIGH = 10;
const CX = 110;
const CY = 108;
const R = 90;

function point(value: number, radius: number) {
  const clamped = Math.min(HIGH, Math.max(LOW, value));
  const angle = Math.PI * (1 - (clamped - LOW) / (HIGH - LOW));
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

function arc(from: number, to: number, radius: number) {
  const start = point(from, radius);
  const end = point(to, radius);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function Gauge({ current, threshold, projected }: { current: number | null; threshold: number; projected: number | null }) {
  const tickOuter = point(threshold, R + 7);
  const tickInner = point(threshold, R - 19);
  const label = point(threshold, R + 17);
  return (
    <svg viewBox="0 -14 220 138" className="w-full max-w-[260px]" role="img" aria-label={`Promedio actual ${current?.toFixed(2) ?? "sin datos"} frente a ${threshold.toFixed(1)}`}>
      <path d={arc(LOW, HIGH, R)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10} strokeLinecap="round" />
      <path d={arc(LOW, HIGH, R - 14)} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={2} strokeLinecap="round" />
      {current !== null && (
        <motion.path
          d={arc(LOW, Math.max(LOW + 0.01, current), R)}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={10}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
        />
      )}
      {projected !== null && (
        <motion.path
          d={arc(LOW, Math.max(LOW + 0.01, projected), R - 14)}
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={2}
          strokeDasharray="2 4"
          strokeLinecap="round"
          initial={false}
          animate={{ d: arc(LOW, Math.max(LOW + 0.01, projected), R - 14) }}
          transition={{ duration: 0.35, ease: EASE }}
        />
      )}
      <line x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y} stroke="#ffffff" strokeWidth={1.5} strokeLinecap="round" />
      <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" className="fill-white/70 font-mono" fontSize={8}>
        {threshold.toFixed(1)}
      </text>
      <text x={CX - R} y={CY + 13} textAnchor="middle" className="fill-white/25 font-mono" fontSize={7}>{LOW}</text>
      <text x={CX + R} y={CY + 13} textAnchor="middle" className="fill-white/25 font-mono" fontSize={7}>{HIGH}</text>
    </svg>
  );
}

export default function ScholarshipCard({ overview, className }: { overview: UniOverview; className?: string }) {
  const beca = overview.scholarship;
  const sliderId = useId();
  const n = beca.subjectsCounted;
  const initial = Math.round((beca.current ?? beca.threshold) * 10) / 10;
  const [scenario, setScenario] = useState(initial);
  const projected = n && beca.remainingWeightTotal > 0 ? (beca.securedPointsTotal + beca.remainingWeightTotal * scenario) / n : null;
  const delta = beca.current === null ? null : beca.current - beca.threshold;
  const securedNames = overview.subjects.filter((subject) => beca.secured.includes(subject.id)).map((subject) => subject.name);
  const needed = beca.neededRemaining;
  const tight = needed !== null && beca.current !== null && needed > beca.current;
  const gradedShare = n ? Math.max(0, Math.min(1, 1 - beca.remainingWeightTotal / n)) : 0;

  return (
    <Panel className={cx("flex flex-col", className)}>
      <PanelHeader icon={<Scale />} title={beca.percent ? `Beca ${beca.percent}%` : "Beca"} meta={`≥ ${beca.threshold.toFixed(1)}`} />
      {n === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-10 text-center text-[11px] text-white/30">Sin calificaciones para calcular el promedio.</div>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-4 px-4 pb-4 pt-3 sm:px-5">
          <div className="relative flex justify-center">
            <Gauge current={beca.current} threshold={beca.threshold} projected={projected} />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
              <Ticker value={beca.current} decimals={2} className="font-mono text-[34px] font-light leading-none tracking-[-0.06em] text-white" />
              <span className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                Promedio actual{delta !== null && <span className={cx("ml-1.5", delta < 0 ? "text-white/80" : "text-white/35")}>{signed(delta, 2)}</span>}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06]">
            <Tip
              className="bg-[#0d0d0d]"
              content={
                needed === null ? "No queda peso por calificar." : (
                  <span className="flex flex-col gap-1">
                    <span className="text-white/50">Promedio necesario en todo lo que falta del semestre.</span>
                    <TipRow label="Fórmula" value={`(${beca.threshold.toFixed(1)} × ${n} − ${beca.securedPointsTotal.toFixed(2)}) ÷ ${beca.remainingWeightTotal.toFixed(2)}`} />
                    <TipRow label="Techo con 10 en todo" value={beca.ceiling?.toFixed(2) ?? "—"} />
                  </span>
                )
              }
            >
              <span tabIndex={0} className="flex w-full flex-col gap-1.5 px-3 py-3 outline-none">
                <Label>Necesitas</Label>
                <span className={cx("font-mono text-xl leading-none tracking-[-0.04em]", tight ? "text-white" : "text-white/75")}>
                  {needed === null ? "—" : needed > 10 ? ">10" : Math.max(0, needed).toFixed(2)}
                </span>
                <span className="text-[10px] leading-tight text-white/35">en lo que falta</span>
              </span>
            </Tip>
            <Tip className="bg-[#0d0d0d]" content={securedNames.length ? `Ya cierran en ${beca.threshold.toFixed(1)} aunque saques 6 en lo que falta: ${securedNames.join(", ")}.` : `Ninguna materia tiene el ${beca.threshold.toFixed(1)} garantizado todavía.`}>
              <span tabIndex={0} className="flex w-full flex-col gap-1.5 px-3 py-3 outline-none">
                <Label>Aseguradas</Label>
                <span className="font-mono text-xl leading-none tracking-[-0.04em] text-white/75">
                  {beca.secured.length}<span className="text-white/25">/{n}</span>
                </span>
                <span className="truncate text-[10px] leading-tight text-white/35">{securedNames[0] ?? "ninguna aún"}</span>
              </span>
            </Tip>
          </div>

          <Tip className="w-full" content={`${Math.round(gradedShare * 100)}% del peso del semestre ya tiene calificación; el ${Math.round((1 - gradedShare) * 100)}% restante todavía se puede mover.`}>
            <span tabIndex={0} className="flex w-full flex-col gap-2 outline-none">
              <span className="flex items-baseline justify-between">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/30">Semestre calificado</span>
                <span className="font-mono text-[10px] text-white/55">{Math.round(gradedShare * 100)}%</span>
              </span>
              <span className="block h-[3px] w-full overflow-hidden rounded-full bg-white/[0.07]">
                <motion.span className="block h-full rounded-full bg-white/60" initial={{ width: 0 }} animate={{ width: `${gradedShare * 100}%` }} transition={{ duration: 0.8, delay: 0.3, ease: EASE }} />
              </span>
            </span>
          </Tip>

          {projected !== null && (
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={sliderId} className="text-[11px] text-white/45">
                  Si promedias <span className="font-mono text-white/85">{scenario.toFixed(1)}</span>
                </label>
                <span className="text-[11px] text-white/45">
                  cierras en{" "}
                  <Ticker value={projected} decimals={2} duration={0.35} className={cx("font-mono", projected >= beca.threshold ? "text-white/85" : "text-white")} />
                </span>
              </div>
              <input
                id={sliderId}
                type="range"
                min={5}
                max={10}
                step={0.1}
                value={scenario}
                onChange={(event) => setScenario(Number(event.target.value))}
                className="mt-2.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-white"
                aria-valuetext={`Promedio ${scenario.toFixed(1)} en lo que falta; cierre ${projected.toFixed(2)}`}
              />
              <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] text-white/25">
                <span className="flex items-center gap-1.5"><span className="h-px w-3 bg-white/80" />actual</span>
                <span className={cx(projected >= beca.threshold ? "text-white/40" : "text-white/70")}>{projected >= beca.threshold ? "beca a salvo" : `${(beca.threshold - projected).toFixed(2)} abajo`}</span>
                <span className="flex items-center gap-1.5"><span className="h-px w-3 border-t border-dashed border-white/50" />proyección</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
