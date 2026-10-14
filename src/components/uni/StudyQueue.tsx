"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Check, ChevronRight, Target } from "lucide-react";
import type { UniStudyItem } from "@/features/uni/types";
import { compactDays, shortDate } from "./format";
import { cx, EASE, Label, Panel, PanelHeader, PulseDot, Tip, useLocalSet } from "./primitives";

function StudyRow({ item, index, open, onToggle, onOpenSubject }: { item: UniStudyItem; index: number; open: boolean; onToggle: () => void; onOpenSubject: (id: string) => void }) {
  const [studied, toggleStudied] = useLocalSet(`valleos.uni.temas.${item.examId}`);
  const done = item.topics.filter((topic) => studied.has(topic.text)).length;
  const topics = [...item.topics].sort((a, b) => Number(b.focus) - Number(a.focus));
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 + index * 0.05, duration: 0.24, ease: EASE }}
      className="border-b border-white/[0.05] last:border-b-0"
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.025] active:scale-[0.99] sm:px-5">
        <span className={cx("pt-0.5 font-mono text-[10px]", index === 0 ? "text-white" : "text-white/30")}>{String(index + 1).padStart(2, "0")}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            {item.today && <PulseDot strong />}
            <span className={cx("truncate text-[12.5px] font-medium tracking-[-0.01em]", index === 0 ? "text-white" : "text-white/80")}>{item.subject}</span>
          </span>
          <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[9.5px] text-white/35">
            <span className="text-white/55">{item.label}</span>
            {item.target !== null && <span>meta ≥{item.target.toFixed(1)}</span>}
            {item.reasons.map((reason) => <span key={reason}>{reason}</span>)}
          </span>
          <span className="mt-2 block h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.span
              className={cx("block h-full rounded-full", index === 0 ? "bg-white" : "bg-white/40")}
              initial={{ width: 0 }}
              animate={{ width: `${item.priority}%` }}
              transition={{ duration: 0.7, delay: 0.2 + index * 0.05, ease: EASE }}
            />
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className={cx("font-mono text-[10px]", item.today ? "text-white" : item.daysUntil <= 2 ? "text-white/75" : "text-white/40")}>
            {item.today ? (item.time ?? "hoy") : compactDays(item.daysUntil)}
          </span>
          <span className="font-mono text-[9px] text-white/25">{item.today ? "hoy" : shortDate(item.date).split(" ").slice(0, 2).join(" ")}</span>
          <ChevronRight className={cx("mt-0.5 h-3 w-3 text-white/25 transition-transform duration-200", open && "rotate-90 text-white/60")} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.26, ease: EASE }, opacity: { duration: 0.16 } }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 pb-4 pl-[50px] pr-4 sm:pr-5">
              {item.tip && <p className="border-l border-white/15 pl-3 text-[11.5px] leading-relaxed text-white/60">{item.tip}</p>}
              {item.topics.length > 0 ? (
                <>
                  <span className="flex items-center justify-between">
                    <Label>Temas</Label>
                    <span className="font-mono text-[9.5px] text-white/35">{done}/{item.topics.length}</span>
                  </span>
                  <ul className="flex flex-col gap-0.5">
                    {topics.map((topic) => {
                      const checked = studied.has(topic.text);
                      return (
                        <li key={topic.text}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            onClick={() => toggleStudied(topic.text)}
                            className="group flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-white/[0.03] active:scale-[0.99]"
                          >
                            <span className={cx("mt-[2px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors", checked ? "border-white bg-white" : "border-white/20 group-hover:border-white/40")}>
                              <AnimatePresence>
                                {checked && (
                                  <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: "spring", stiffness: 600, damping: 28 }}>
                                    <Check className="h-2.5 w-2.5 text-[#111111]" strokeWidth={3} />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </span>
                            <span className={cx("text-[11.5px] leading-snug transition-colors", checked ? "text-white/30 line-through decoration-white/20" : topic.focus ? "text-white" : "text-white/60")}>
                              {topic.text}
                              {topic.focus && !checked && <span className="ml-1.5 font-mono text-[9px] text-white/40">clave</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-[11px] text-white/30">Sin temario en la bóveda. Abre la materia para ver su evaluación.</p>
              )}
              <button type="button" onClick={() => onOpenSubject(item.subjectId)} className="w-fit font-mono text-[10px] text-white/40 transition hover:text-white active:scale-[0.98]">
                Ver materia →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export default function StudyQueue({ items, onOpenSubject, className }: { items: UniStudyItem[]; onOpenSubject: (id: string) => void; className?: string }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.examId ?? null);
  return (
    <Panel className={className}>
      <PanelHeader icon={<Target />} title="Qué estudiar ahora">
        <Tip content="Orden: lo de hoy primero; después peso del examen × riesgo de la materia × cercanía.">
          <span tabIndex={0} className="font-mono text-[9.5px] text-white/30 outline-none">fecha × riesgo</span>
        </Tip>
      </PanelHeader>
      {items.length === 0 ? (
        <div className="px-5 py-10 text-center text-[11px] text-white/30">Nada pendiente en los próximos 30 días.</div>
      ) : (
        <ol>
          {items.map((item, index) => (
            <StudyRow key={item.examId} item={item} index={index} open={openId === item.examId} onToggle={() => setOpenId((current) => (current === item.examId ? null : item.examId))} onOpenSubject={onOpenSubject} />
          ))}
        </ol>
      )}
    </Panel>
  );
}
