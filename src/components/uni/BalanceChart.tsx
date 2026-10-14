"use client";

import { motion } from "framer-motion";
import { Waypoints } from "lucide-react";
import type { UniScholarship, UniSubject } from "@/features/uni/types";
import { shortSubject } from "./ExamTimeline";
import { grade, signed } from "./format";
import { cx, EASE, Panel, PanelHeader, Tip, TipRow } from "./primitives";

/**
 * Barras divergentes alrededor del umbral de la beca: dónde se gana y dónde
 * se pierde promedio. Énfasis en lo que está por debajo (lo que hay que atender).
 */
export default function BalanceChart({ scholarship, subjects, onOpenSubject, className }: { scholarship: UniScholarship; subjects: UniSubject[]; onOpenSubject: (id: string) => void; className?: string }) {
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const rows = scholarship.balance;
  const domain = Math.max(2, Math.ceil(Math.max(0, ...rows.map((row) => Math.abs(row.delta)))));
  const n = scholarship.subjectsCounted || rows.length;
  return (
    <Panel className={className}>
      <PanelHeader icon={<Waypoints />} title={`Contra ${scholarship.threshold.toFixed(1)}`} meta="promedio actual por materia" />
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-[11px] text-white/30">Sin calificaciones todavía.</div>
      ) : (
        <div className="px-4 pb-4 pt-3 sm:px-5">
          <div>
            <ul className="flex flex-col">
              {rows.map((row, index) => {
                const below = row.delta < 0;
                const width = (Math.abs(row.delta) / domain) * 50;
                return (
                  <li key={row.id}>
                    <Tip
                      className="w-full"
                      content={
                        <span className="flex min-w-[170px] flex-col gap-1">
                          <span className="text-white/90">{row.name}</span>
                          <TipRow label="Promedio actual" value={grade(row.current, 2)} />
                          <TipRow label={`Contra ${scholarship.threshold.toFixed(1)}`} value={signed(row.delta, 2)} />
                          <TipRow label="Efecto en la beca" value={signed(row.delta / n, 2)} />
                        </span>
                      }
                    >
                      <button
                        type="button"
                        onClick={() => onOpenSubject(row.id)}
                        className="group grid w-full grid-cols-[96px_minmax(0,1fr)_2.25rem] items-center gap-3 rounded-lg py-[5px] text-left active:scale-[0.99]"
                      >
                        <span className={cx("truncate text-[11px] transition-colors", below ? "text-white/80" : "text-white/40", "group-hover:text-white")}>{shortSubject(byId.get(row.id), row.name)}</span>
                        <span className="relative h-[9px]">
                          <span className="absolute -bottom-[5px] -top-[5px] left-1/2 w-px bg-white/20" aria-hidden />
                          <motion.span
                            className={cx("absolute inset-y-0", below ? "rounded-l-[4px] bg-white/80 group-hover:bg-white" : "rounded-r-[4px] bg-white/25 group-hover:bg-white/40")}
                            style={below ? { right: "50%" } : { left: "50%" }}
                            initial={{ width: 0 }}
                            animate={{ width: `${width}%` }}
                            transition={{ duration: 0.6, delay: 0.15 + index * 0.04, ease: EASE }}
                          />
                        </span>
                        <span className={cx("text-right font-mono text-[10.5px] tabular-nums", below ? "text-white/85" : "text-white/35")}>{signed(row.delta)}</span>
                      </button>
                    </Tip>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mt-2 grid grid-cols-[96px_minmax(0,1fr)_2.25rem] gap-3 font-mono text-[8.5px] text-white/25">
            <span />
            <span className="flex justify-between tabular-nums">
              <span>−{domain}</span>
              <span className="text-white/45">{scholarship.threshold.toFixed(1)}</span>
              <span>+{domain}</span>
            </span>
            <span />
          </div>
        </div>
      )}
    </Panel>
  );
}
