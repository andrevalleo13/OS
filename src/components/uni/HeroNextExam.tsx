"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, ChevronDown, Clock, MapPin } from "lucide-react";
import type { UniExam, UniOverview, UniSubject } from "@/features/uni/types";
import { compactDays, grade, noteHref, relativeDays, shortDate } from "./format";
import { cx, EASE, Label, Panel, PulseDot, Tip, TipRow, useNow } from "./primitives";

type Countdown =
  | { mode: "clock"; hours: number; minutes: number; seconds: number }
  | { mode: "days"; days: number; hours: number }
  | { mode: "date"; days: number }
  | { mode: "live" };

function countdown(exam: UniExam, now: number): Countdown {
  if (exam.at) {
    const ms = Date.parse(exam.at) - now;
    if (ms <= 0) return { mode: "live" };
    const total = Math.floor(ms / 1000);
    const hours = Math.floor(total / 3600);
    if (hours < 48) return { mode: "clock", hours, minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
    return { mode: "days", days: Math.floor(hours / 24), hours: hours % 24 };
  }
  return { mode: "date", days: exam.daysUntil };
}

function Unit({ value, label, pad = true }: { value: number; label: string; pad?: boolean }) {
  return (
    <span className="flex flex-col items-start">
      <span className="font-mono text-[52px] font-light leading-none tracking-[-0.06em] text-white tabular-nums sm:text-[64px]">{pad ? String(value).padStart(2, "0") : value}</span>
      <span className="mt-2 font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">{label}</span>
    </span>
  );
}

function Separator() {
  return <span className="font-mono text-[40px] font-light leading-[52px] text-white/15 sm:text-[48px] sm:leading-[64px]">:</span>;
}

function CountdownDisplay({ exam, now }: { exam: UniExam; now: number }) {
  const value = countdown(exam, now);
  if (value.mode === "live") {
    return (
      <div className="flex items-center gap-3">
        <PulseDot strong className="h-2 w-2" />
        <span className="font-mono text-[44px] font-light leading-none tracking-[-0.05em] text-white sm:text-[56px]">En curso</span>
      </div>
    );
  }
  if (value.mode === "clock") {
    return (
      <div className="flex items-start gap-2 sm:gap-3" aria-label={`Faltan ${value.hours} horas y ${value.minutes} minutos`}>
        <Unit value={value.hours} label="horas" />
        <Separator />
        <Unit value={value.minutes} label="min" />
        <Separator />
        <Unit value={value.seconds} label="seg" />
      </div>
    );
  }
  if (value.mode === "days") {
    return (
      <div className="flex items-start gap-4">
        <Unit value={value.days} label="días" pad={false} />
        <Unit value={value.hours} label="horas" />
      </div>
    );
  }
  if (value.days <= 1) {
    return <span className="font-mono text-[52px] font-light uppercase leading-none tracking-[-0.06em] text-white sm:text-[64px]">{relativeDays(value.days)}</span>;
  }
  return <Unit value={value.days} label="días" pad={false} />;
}

function WindowProgress({ examWindow, today }: { examWindow: NonNullable<UniOverview["window"]>; today: string }) {
  const days = Math.max(1, examWindow.days);
  const current = examWindow.day;
  return (
    <div className="flex items-center gap-3">
      <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-white/35 sm:inline">
        {examWindow.active ? `Día ${current}/${days}` : today < examWindow.start ? `Empieza ${relativeDays(current <= 0 ? 1 - current : 0)}` : "Terminó"}
      </span>
      <span className="flex gap-[3px]" aria-hidden>
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const past = examWindow.active ? day < current : today > examWindow.end;
          const isToday = examWindow.active && day === current;
          return (
            <motion.span
              key={day}
              initial={{ scaleY: 0.3, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.03, duration: 0.3, ease: EASE }}
              className={cx("h-3 w-[5px] rounded-full", isToday ? "bg-white motion-safe:animate-pulse" : past ? "bg-white/45" : "bg-white/[0.1]")}
            />
          );
        })}
      </span>
    </div>
  );
}

export default function HeroNextExam({ overview, subject, onOpenSubject, className }: { overview: UniOverview; subject: UniSubject | null; onOpenSubject: (id: string) => void; className?: string }) {
  const exam = overview.nextExam;
  const now = useNow(overview.generatedAt, 1_000);
  const examWindow = overview.window;
  const done = overview.exams.filter((item) => examWindow && item.date >= examWindow.rangeStart && item.date <= examWindow.rangeEnd && item.kind !== "Final");
  const remaining = done.filter((item) => item.status === "hoy" || item.status === "proximo").length;
  const graded = done.filter((item) => item.status === "hecho").length;

  if (!exam) {
    const nextFinal = overview.finals.find((item) => item.status === "proximo" || item.status === "hoy");
    return (
      <Panel className={cx("flex min-h-[320px] flex-col justify-between p-5 sm:p-6", className)}>
        <Label>Próximo examen</Label>
        <div>
          <p className="text-2xl font-medium tracking-[-0.03em] text-white/80">Sin exámenes en el horizonte.</p>
          <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-white/40">
            {nextFinal ? `Siguiente: final de ${nextFinal.subject}, ${shortDate(nextFinal.date)} (${relativeDays(nextFinal.daysUntil)}).` : overview.vault.available ? "La bóveda no tiene fechas de examen pendientes." : "Conecta la bóveda o agrega exámenes en Entregas para ver la cuenta regresiva."}
          </p>
        </div>
        <span />
      </Panel>
    );
  }

  const isToday = exam.status === "hoy";
  const previous = subject?.components.filter((component) => component.grade !== null && component.kind !== exam.kind) ?? [];
  const topics = [...(subject?.topics ?? [])].sort((a, b) => Number(b.focus) - Number(a.focus));
  const tip = subject?.tips.find((text) => !/^asistencia/i.test(text)) ?? null;

  return (
    <Panel className={cx("flex flex-col overflow-hidden", className)}>
      {isToday && <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />}
      <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          {isToday ? (
            <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-2 py-0.5">
              <PulseDot strong />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white">Hoy</span>
            </span>
          ) : (
            <span className="rounded-full border border-white/[0.08] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">{compactDays(exam.daysUntil)}</span>
          )}
          <Label className="truncate">{examWindow?.active ? examWindow.label : "Próximo examen"}</Label>
        </div>
        {examWindow && <WindowProgress examWindow={examWindow} today={overview.today} />}
      </div>

      <div className="px-5 pt-6 sm:px-6">
        <Label>{examWindow?.active ? "Próximo examen" : exam.label}</Label>
        <button type="button" onClick={() => onOpenSubject(exam.subjectId)} className="group mt-2 block text-left active:scale-[0.99]">
          <span className="text-[26px] font-medium leading-[1.1] tracking-[-0.035em] text-white transition-colors group-hover:text-white/80 sm:text-[30px]">{exam.subject}</span>
        </button>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-white/45">
          <span className="text-white/70">{exam.label}</span>
          <span>{shortDate(exam.date)}</span>
          {exam.time && (
            <Tip content={exam.timeSource === "horario" ? "Hora inferida de tu horario de clase en la base." : "Hora anotada en la bóveda."}>
              <span tabIndex={0} className="inline-flex items-center gap-1 outline-none">
                <Clock className="h-3 w-3" />
                {exam.timeSource === "horario" && <span className="text-white/30">≈</span>}
                {exam.time}
              </span>
            </Tip>
          )}
          {exam.place && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {exam.place}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pt-7 sm:px-6">
        <CountdownDisplay exam={exam} now={now} />
      </div>

      <div className="mt-7 grid grid-cols-2 border-y border-white/[0.06] sm:grid-cols-4">
        {[
          {
            label: previous.length ? previous.map((item) => item.kind).join(" · ") : "Antecedente",
            value: previous.length ? previous.map((item) => grade(item.grade)).join(" · ") : "—",
            tip: previous.length ? previous.map((item) => `${item.label}: ${grade(item.grade)} (${item.weight}%)`).join(" · ") : "Sin calificaciones previas en esta materia.",
          },
          {
            label: "Meta",
            value: subject?.neededForThreshold === null || subject?.neededForThreshold === undefined ? "—" : subject.neededForThreshold > 10 ? ">10" : `≥${Math.max(0, subject.neededForThreshold).toFixed(1)}`,
            tip: `Promedio necesario en lo que falta de la materia para cerrarla en ${overview.scholarship.threshold.toFixed(1)}.`,
          },
          { label: "Vale", value: exam.weight === null ? "—" : `${Math.round(exam.weight)}%`, tip: "Peso de este examen sobre la calificación final." },
          {
            label: "Faltas rest.",
            value: subject?.absences.remaining === null || subject?.absences.remaining === undefined ? "—" : subject.absences.remaining.toFixed(1),
            tip: subject?.absences.used !== null && subject?.absences.used !== undefined ? `${subject.absences.used.toFixed(1)} de ${subject.absences.limit} faltas usadas.` : "Sin registro de faltas.",
          },
        ].map((stat, index) => (
          <Tip key={stat.label + index} content={stat.tip} className={cx("min-w-0 border-white/[0.06] px-5 py-3.5 sm:px-6", index % 2 === 1 && "border-l", index >= 2 && "border-t sm:border-t-0", index === 2 && "sm:border-l")}>
            <span tabIndex={0} className="flex w-full flex-col gap-1.5 outline-none">
              <Label className="truncate">{stat.label}</Label>
              <span className="font-mono text-lg leading-none tracking-[-0.03em] text-white/85">{stat.value}</span>
            </span>
          </Tip>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4 sm:px-6">
        {topics.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>Temas que entran</Label>
            <div className="flex flex-wrap gap-1.5">
              {topics.slice(0, 7).map((topic, index) => (
                <motion.span
                  key={topic.text}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + index * 0.035, duration: 0.22, ease: EASE }}
                  className={cx(
                    "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                    topic.focus ? "border-white/25 bg-white/[0.07] text-white" : "border-white/[0.07] text-white/55",
                  )}
                >
                  {topic.focus && <span className="h-1 w-1 shrink-0 rounded-full bg-white" />}
                  <span className="truncate">{topic.text}</span>
                </motion.span>
              ))}
              {topics.length > 7 && <span className="rounded-full px-2 py-1 font-mono text-[10px] text-white/30">+{topics.length - 7}</span>}
            </div>
          </div>
        )}
        {tip && <p className="border-l border-white/15 pl-3 text-[12px] leading-relaxed text-white/55">{tip}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpenSubject(exam.subjectId)}
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#eeeeee] px-3 text-[11px] font-medium text-[#111111] transition hover:bg-white active:scale-[0.98]"
          >
            Ver materia
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {subject?.notePath && (
            <Link href={noteHref(subject.notePath)} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-white/[0.08] px-3 text-[11px] text-white/60 transition hover:border-white/20 hover:text-white active:scale-[0.98]">
              Abrir nota
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
          {examWindow && (
            <Tip content={<span className="flex flex-col gap-1"><TipRow label="Por presentar" value={remaining} /><TipRow label="Calificados" value={graded} /></span>}>
              <span tabIndex={0} className="ml-auto font-mono text-[10px] text-white/30 outline-none">
                {remaining} por presentar · {graded} {graded === 1 ? "hecho" : "hechos"}
              </span>
            </Tip>
          )}
        </div>
      </div>
    </Panel>
  );
}
