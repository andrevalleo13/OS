"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Flag } from "lucide-react";
import type { UniExam } from "@/features/uni/types";
import { compactDays, noteHref, shortDate } from "./format";
import { cx, EASE, Panel, PanelHeader, Tip } from "./primitives";

export default function FinalsCard({ finals, notePath, onOpenSubject, className }: { finals: UniExam[]; notePath: string | null; onOpenSubject: (id: string) => void; className?: string }) {
  const upcoming = finals.filter((exam) => exam.status === "proximo" || exam.status === "hoy");
  const first = upcoming[0];
  return (
    <Panel className={cx("flex flex-col", className)}>
      <PanelHeader icon={<Flag />} title="Finales" meta={first ? `empiezan ${compactDays(first.daysUntil) === "hoy" ? "hoy" : `en ${first.daysUntil} días`}` : undefined} />
      {upcoming.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-10 text-center text-[11px] text-white/30">Sin fechas de finales en la bóveda.</div>
      ) : (
        <ul className="flex flex-1 flex-col px-2 py-2">
          {upcoming.map((exam, index) => {
            const heavy = (exam.weight ?? 0) >= 40;
            return (
              <motion.li key={exam.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.035, duration: 0.22, ease: EASE }}>
                <button type="button" onClick={() => onOpenSubject(exam.subjectId)} className="grid w-full grid-cols-[78px_minmax(0,1fr)_40px_34px] items-center gap-3 rounded-[10px] px-2.5 py-[7px] text-left transition-colors hover:bg-white/[0.03] active:scale-[0.99]">
                  <span className="font-mono text-[10px] text-white/40">{shortDate(exam.date)}</span>
                  <span className={cx("truncate text-[11.5px]", heavy ? "text-white" : "text-white/60")}>{exam.subject}</span>
                  <Tip content={heavy ? "Pesa 40% o más de la materia: aquí se define." : "Peso del final sobre la materia."}>
                    <span className={cx("w-full text-right font-mono text-[10.5px]", heavy ? "text-white" : "text-white/35")}>{exam.weight === null ? "—" : `${Math.round(exam.weight)}%`}</span>
                  </Tip>
                  <span className="text-right font-mono text-[9.5px] text-white/25">{compactDays(exam.daysUntil)}</span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
      {notePath && (
        <Link href={noteHref(notePath)} className="mx-4 mb-4 inline-flex w-fit items-center gap-1 font-mono text-[10px] text-white/35 transition hover:text-white sm:mx-5">
          Calendario en la bóveda <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </Panel>
  );
}
