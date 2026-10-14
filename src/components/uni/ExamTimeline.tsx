"use client";

import { motion } from "framer-motion";
import { CalendarDays, Check, Clock, MapPin, TriangleAlert } from "lucide-react";
import type { UniExam, UniOverview, UniSubject } from "@/features/uni/types";
import { addDaysKey, dateParts, daysBetween, grade, isWeekend, relativeDays, shortDate, weekdayShort } from "./format";
import { cx, EASE, Label, Panel, PanelHeader, PulseDot, SPRING, Tip, TipRow, useNow } from "./primitives";

export function shortSubject(subject: Pick<UniSubject, "name" | "aliases"> | undefined, fallback: string): string {
  if (!subject) return fallback;
  if (subject.name.length <= 16) return subject.name;
  const alias = [...subject.aliases].filter((item) => item.length >= 3).sort((a, b) => a.length - b.length)[0];
  return alias ?? subject.name;
}

function hourFraction(now: number, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(now));
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    return (hour * 60 + minute) / 1440;
  } catch {
    return 0.5;
  }
}

function ExamTip({ exam, subject }: { exam: UniExam; subject?: UniSubject }) {
  const previous = subject?.components.filter((component) => component.grade !== null && component.kind !== exam.kind) ?? [];
  return (
    <span className="flex min-w-[180px] flex-col gap-1">
      <span className="text-[12px] text-white">{exam.subject}</span>
      <span className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">{exam.label} · {shortDate(exam.date)}</span>
      {exam.grade !== null && <TipRow label="Calificación" value={grade(exam.grade)} />}
      {previous.map((component) => <TipRow key={component.kind} label={component.label} value={grade(component.grade)} />)}
      {exam.weight !== null && <TipRow label="Vale" value={`${Math.round(exam.weight)}%`} />}
      {exam.time && <TipRow label={exam.timeSource === "horario" ? "Hora (clase)" : "Hora"} value={exam.time} />}
      {exam.place && <TipRow label="Lugar" value={exam.place} />}
      {subject && subject.risk.level !== "bajo" && <span className="mt-1 text-white/50">{subject.risk.reasons[0]}</span>}
    </span>
  );
}

function ExamChip({ exam, subject, onOpen, index }: { exam: UniExam; subject?: UniSubject; onOpen: (id: string) => void; index: number }) {
  const risky = exam.status !== "hecho" && (exam.risk === "alto" || exam.risk === "critico");
  const isToday = exam.status === "hoy";
  const done = exam.status === "hecho";
  return (
    <Tip content={<ExamTip exam={exam} subject={subject} />} className="w-full">
      <motion.button
        type="button"
        onClick={() => onOpen(exam.subjectId)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        transition={{ ...SPRING, opacity: { delay: 0.2 + index * 0.04, duration: 0.2 }, y: SPRING }}
        className={cx(
          "group relative flex w-full flex-col gap-1 rounded-[12px] border px-2.5 py-2 text-left transition-colors active:scale-[0.98]",
          isToday && "border-white/40 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_30px_rgba(255,255,255,0.05)]",
          done && "border-white/[0.06] bg-white/[0.015] hover:border-white/15",
          exam.status === "sin-resultado" && "border-dashed border-white/15 hover:border-white/25",
          exam.status === "proximo" && (risky ? "border-white/20 bg-white/[0.03] hover:border-white/35" : "border-white/[0.08] hover:border-white/20"),
        )}
      >
        <span className="flex items-center gap-1.5">
          {isToday && <PulseDot strong />}
          <span className={cx("line-clamp-2 min-w-0 flex-1 break-words text-[11.5px] leading-tight", done ? "text-white/45" : "text-white/90")}>{shortSubject(subject, exam.subject)}</span>
          {risky && <TriangleAlert className="h-3 w-3 shrink-0 text-white/70" aria-label="En riesgo" />}
        </span>
        {done ? (
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono text-[20px] font-light leading-none tracking-[-0.05em] text-white">{grade(exam.grade)}</span>
            <Check className="h-3 w-3 text-white/40" />
          </span>
        ) : (
          <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] text-white/40">
            <span>{exam.kind}</span>
            {exam.time && <><span className="text-white/20">·</span><span>{exam.timeSource === "horario" ? "≈" : ""}{exam.time}</span></>}
          </span>
        )}
        {exam.status === "sin-resultado" && <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-white/30">sin resultado</span>}
      </motion.button>
    </Tip>
  );
}

export default function ExamTimeline({ overview, onOpenSubject, className }: { overview: UniOverview; onOpenSubject: (id: string) => void; className?: string }) {
  const now = useNow(overview.generatedAt, 60_000);
  const examWindow = overview.window;
  const subjects = new Map(overview.subjects.map((subject) => [subject.id, subject]));
  const start = examWindow?.rangeStart ?? overview.today;
  const end = examWindow?.rangeEnd ?? addDaysKey(overview.today, 13);
  const length = Math.max(1, daysBetween(start, end) + 1);
  const days = Array.from({ length }, (_, index) => addDaysKey(start, index));
  const inRange = overview.exams.filter((exam) => exam.date >= start && exam.date <= end && (examWindow ? exam.kind !== "Final" || exam.date >= overview.today : true));
  const byDay = new Map<string, UniExam[]>();
  for (const exam of inRange) byDay.set(exam.date, [...(byDay.get(exam.date) ?? []), exam]);
  const elapsed = Math.min(1, Math.max(0, (daysBetween(start, overview.today) + hourFraction(now, overview.timezone)) / length));
  const template = days.map((day) => (isWeekend(day) && !byDay.has(day) ? "minmax(0,0.38fr)" : "minmax(0,1fr)")).join(" ");
  const pending = inRange.filter((exam) => exam.status === "hoy" || exam.status === "proximo").length;
  const graded = inRange.filter((exam) => exam.status === "hecho").length;
  const range = `${dateParts(start).day}${dateParts(start).month === dateParts(end).month ? "" : ` ${shortDate(start).split(" ")[2]}`} – ${shortDate(end).split(" ").slice(1).join(" ")}`;

  const chipOrder = new Map(inRange.map((exam, index) => [exam.id, index]));
  return (
    <Panel className={className}>
      <PanelHeader icon={<CalendarDays />} title={examWindow?.label ?? "Próximas dos semanas"} meta={range}>
        <span className="font-mono text-[10px] text-white/35">
          <span className="text-white/75">{pending}</span> por presentar · <span className="text-white/75">{graded}</span> {graded === 1 ? "calificado" : "calificados"}
        </span>
      </PanelHeader>

      {inRange.length === 0 ? (
        <div className="px-5 py-10 text-center text-[11px] text-white/30">
          {overview.exams.length ? "No hay exámenes en estas fechas." : "Sin fechas de examen. Agrégalas en la nota del semestre o como entregas."}
        </div>
      ) : (
        <>
          {/* Escritorio: rejilla de días */}
          <div className="hidden px-3 pb-3 pt-2 md:block">
            <div className="relative mx-1 mb-2 h-px bg-white/[0.06]">
              <motion.div className="absolute inset-y-0 left-0 bg-white/50" initial={{ width: 0 }} animate={{ width: `${elapsed * 100}%` }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }} />
              <motion.span className="absolute top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" initial={{ left: 0, opacity: 0 }} animate={{ left: `${elapsed * 100}%`, opacity: 1 }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }} />
            </div>
            <div className="grid" style={{ gridTemplateColumns: template }}>
              {days.map((day) => {
                const exams = byDay.get(day) ?? [];
                const isToday = day === overview.today;
                const past = day < overview.today;
                const weekend = isWeekend(day) && !exams.length;
                return (
                  <div key={day} className={cx("relative flex min-h-[136px] min-w-0 flex-col gap-2 border-l border-white/[0.05] px-1.5 pb-1 pt-2 first:border-l-0", isToday && "rounded-[14px] bg-white/[0.035]")}>
                    <div className={cx("flex items-baseline gap-1.5 px-1", weekend && "justify-center")}>
                      <span className={cx("font-mono text-[8.5px] uppercase tracking-[0.14em]", isToday ? "text-white" : past ? "text-white/20" : "text-white/35")}>{weekend ? weekdayShort(day).slice(0, 1) : weekdayShort(day)}</span>
                      {!weekend && <span className={cx("font-mono text-[15px] leading-none tracking-[-0.04em]", isToday ? "text-white" : past ? "text-white/25" : "text-white/60")}>{dateParts(day).day}</span>}
                      {isToday && <span className="ml-auto flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.18em] text-white/70"><PulseDot />hoy</span>}
                    </div>
                    <div className={cx("flex flex-col gap-1.5", past && "opacity-75")}>
                      {exams.map((exam) => <ExamChip key={exam.id} exam={exam} subject={subjects.get(exam.subjectId)} onOpen={onOpenSubject} index={chipOrder.get(exam.id) ?? 0} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Móvil: agenda vertical */}
          <ol className="flex flex-col px-2 py-2 md:hidden">
            {[...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, exams]) => {
              const isToday = day === overview.today;
              return (
                <li key={day} className={cx("grid grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-[14px] px-2 py-2.5", isToday && "bg-white/[0.04]")}>
                  <div className="flex flex-col items-start pt-0.5">
                    <Label className={cx(isToday && "text-white")}>{weekdayShort(day)}</Label>
                    <span className={cx("font-mono text-[22px] leading-none tracking-[-0.05em]", isToday ? "text-white" : day < overview.today ? "text-white/30" : "text-white/70")}>{dateParts(day).day}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {exams.map((exam) => {
                      const subject = subjects.get(exam.subjectId);
                      return (
                        <button key={exam.id} type="button" onClick={() => onOpenSubject(exam.subjectId)} className="flex items-center justify-between gap-3 rounded-[12px] border border-white/[0.07] px-3 py-2 text-left active:scale-[0.98]">
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              {exam.status === "hoy" && <PulseDot strong />}
                              <span className={cx("block truncate text-[12px]", exam.status === "hecho" ? "text-white/45" : "text-white/90")}>{exam.subject}</span>
                            </span>
                            <span className="mt-0.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-white/35">
                              {exam.kind}
                              {exam.time && <span className="inline-flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{exam.time}</span>}
                              {exam.place && <span className="inline-flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{exam.place}</span>}
                            </span>
                          </span>
                          {exam.status === "hecho" ? (
                            <span className="font-mono text-lg text-white">{grade(exam.grade)}</span>
                          ) : (
                            <span className="shrink-0 font-mono text-[10px] text-white/40">{relativeDays(exam.daysUntil)}</span>
                          )}
                          {subject && exam.status !== "hecho" && (subject.risk.level === "alto" || subject.risk.level === "critico") && <TriangleAlert className="h-3 w-3 shrink-0 text-white/60" />}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Panel>
  );
}
