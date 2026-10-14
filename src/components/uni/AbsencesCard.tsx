"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarClock, TriangleAlert } from "lucide-react";
import type { UniOverview } from "@/features/uni/types";
import { noteHref } from "./format";
import { AbsenceMeter, cx, EASE, Panel, PanelHeader, Tip, TipRow } from "./primitives";

export default function AbsencesCard({ overview, onOpenSubject, className }: { overview: UniOverview; onOpenSubject: (id: string) => void; className?: string }) {
  const rows = overview.subjects
    .filter((subject) => subject.absences.used !== null)
    .sort((a, b) => (a.absences.remaining ?? 99) - (b.absences.remaining ?? 99) || a.name.localeCompare(b.name, "es"));
  const atLimit = rows.filter((subject) => subject.absences.level === "alto" || subject.absences.level === "critico").length;
  const alert = overview.alerts.find((item) => /falta/i.test(`${item.title} ${item.body}`));

  return (
    <Panel className={cx("flex flex-col", className)}>
      <PanelHeader icon={<CalendarClock />} title="Faltas" meta={rows.length ? `límite ${rows[0].absences.limit}` : undefined}>
        {atLimit > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/85">
            <TriangleAlert className="h-3 w-3" />
            {atLimit} al límite
          </span>
        )}
      </PanelHeader>
      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-10 text-center text-[11px] text-white/30">Sin registro de faltas.</div>
      ) : (
        <ul className="flex flex-1 flex-col px-2 py-2">
          {rows.map((subject, index) => {
            const hot = subject.absences.level === "alto" || subject.absences.level === "critico";
            const warm = subject.absences.level === "medio";
            return (
              <motion.li key={subject.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + index * 0.03, duration: 0.22, ease: EASE }}>
                <Tip
                  className="w-full"
                  content={
                    <span className="flex flex-col gap-1">
                      <span className="text-white/90">{subject.name}</span>
                      <TipRow label="Usadas" value={`${subject.absences.used?.toFixed(1)} / ${subject.absences.limit}`} />
                      <TipRow label="Restantes" value={subject.absences.remaining?.toFixed(1) ?? "—"} />
                      {hot && <span className="text-white/50">Una falta más te deja en zona crítica.</span>}
                    </span>
                  }
                >
                  <button
                    type="button"
                    onClick={() => onOpenSubject(subject.id)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_76px_30px] items-center gap-3 rounded-[10px] px-2.5 py-[7px] text-left transition-colors hover:bg-white/[0.03] active:scale-[0.99]"
                  >
                    <span className={cx("truncate text-[11px]", hot ? "font-medium text-white" : warm ? "text-white/70" : "text-white/45")}>{subject.name}</span>
                    <AbsenceMeter used={subject.absences.used} limit={subject.absences.limit} emphasis={hot} />
                    <span className={cx("text-right font-mono text-[11px]", hot ? "text-white" : "text-white/40")}>{subject.absences.remaining?.toFixed(1) ?? "—"}</span>
                  </button>
                </Tip>
              </motion.li>
            );
          })}
        </ul>
      )}
      {alert && (
        <Link href={noteHref(alert.path)} className="mx-4 mb-4 mt-1 block rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[10.5px] leading-relaxed text-white/45 transition hover:border-white/15 hover:text-white/65 sm:mx-5">
          <span className="mb-1 block font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/30">Bóveda</span>
          <span className="line-clamp-3">{alert.body}</span>
        </Link>
      )}
    </Panel>
  );
}
