"use client";

import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowUpRight, BookOpen, ChevronDown, Mail } from "lucide-react";
import type { UniComponent, UniSubject } from "@/features/uni/types";
import { compactDays, grade, noteHref, shortDate, STANDING_LABEL } from "./format";
import { AbsenceMeter, cx, EASE, Kbd, Label, Panel, PanelHeader, PulseDot, Segmented, Tip, TipRow } from "./primitives";

export type SubjectSort = "fecha" | "riesgo" | "nota";

const RISK_BAR = { critico: "bg-white", alto: "bg-white/70", medio: "bg-white/30", bajo: "bg-transparent" } as const;

/** Barra de puntos sobre la final (0-10): lo asegurado por componente, lo que aún se puede ganar y la marca del umbral. */
function PointsBar({ subject, threshold }: { subject: UniSubject; threshold: number }) {
  const total = subject.components.reduce((sum, component) => sum + component.weight, 0) || 100;
  const graded = subject.components.filter((component) => component.grade !== null);
  const remaining = (1 - subject.gradedWeight) * 10;
  const segments = graded.map((component) => ({ component, points: ((component.weight / total) * (component.grade ?? 0)) }));
  return (
    <Tip
      className="w-full"
      content={
        <span className="flex min-w-[190px] flex-col gap-1">
          {subject.components.map((component) => (
            <TipRow key={component.kind + component.label} label={`${component.label} · ${Math.round((component.weight / total) * 100)}%`} value={component.grade === null ? "pendiente" : `${grade(component.grade)} → ${((component.weight / total) * (component.grade ?? 0)).toFixed(2)} pts`} />
          ))}
          <span className="mt-1 border-t border-white/10 pt-1.5"><TipRow label="Asegurado" value={`${subject.securedPoints.toFixed(2)} / 10`} /></span>
          <TipRow label="Máximo posible" value={(subject.securedPoints + remaining).toFixed(2)} />
        </span>
      }
    >
      <span tabIndex={-1} className="relative block h-[7px] w-full outline-none" aria-label={`${subject.securedPoints.toFixed(1)} de 10 puntos asegurados`}>
        <span className="absolute inset-0 flex gap-[2px] overflow-hidden rounded-[3px]">
          {segments.map(({ component, points }, index) => (
            <motion.span
              key={component.kind + component.label}
              className={cx("h-full shrink-0 first:rounded-l-[3px]", index % 2 === 0 ? "bg-white/85" : "bg-white/65")}
              initial={{ width: 0 }}
              animate={{ width: `calc(${points * 10}% - 2px)` }}
              transition={{ duration: 0.7, delay: 0.1 + index * 0.08, ease: EASE }}
            />
          ))}
          <motion.span className="h-full shrink-0 rounded-r-[3px] bg-white/[0.12]" initial={{ width: 0 }} animate={{ width: `${remaining * 10}%` }} transition={{ duration: 0.7, delay: 0.25, ease: EASE }} />
          <span className="h-full flex-1 bg-white/[0.035]" />
        </span>
        <span className="absolute -top-[3px] h-[13px] w-px bg-white" style={{ left: `${threshold * 10}%` }} aria-hidden />
      </span>
    </Tip>
  );
}

function ComponentRow({ component, total }: { component: UniComponent; total: number }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_44px_40px_64px] items-baseline gap-2 py-1.5 font-mono text-[10.5px]">
      <span className={cx("truncate font-sans text-[11.5px]", component.grade === null ? "text-white/45" : "text-white/80")}>
        {component.label}
        {component.assumed && <span className="ml-1.5 font-mono text-[9px] text-white/25">supuesto</span>}
      </span>
      <span className="text-right text-white/35">{Math.round((component.weight / total) * 100)}%</span>
      <span className={cx("text-right", component.grade === null ? "text-white/25" : "text-white")}>{grade(component.grade)}</span>
      <span className="text-right text-white/30">{component.date ? shortDate(component.date).split(" ").slice(1).join(" ") : "—"}</span>
    </li>
  );
}

function SubjectDetails({ subject, threshold }: { subject: UniSubject; threshold: number }) {
  const total = subject.components.reduce((sum, component) => sum + component.weight, 0) || 100;
  const topics = [...subject.topics].sort((a, b) => Number(b.focus) - Number(a.focus));
  return (
    <div className="grid gap-5 border-t border-white/[0.05] px-4 pb-5 pt-4 sm:px-5 md:grid-cols-3 md:gap-6">
      <div className="flex flex-col gap-2">
        <Label>Evaluación</Label>
        <ul className="divide-y divide-white/[0.04]">
          {subject.components.map((component) => <ComponentRow key={component.kind + component.label} component={component} total={total} />)}
        </ul>
        <dl className="mt-1 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] p-2.5">
          {[
            { label: "Asegurado", value: `${subject.securedPoints.toFixed(2)}` },
            { label: `Para ${threshold.toFixed(1)}`, value: subject.neededForThreshold === null ? "—" : subject.neededForThreshold > 10 ? ">10" : Math.max(0, subject.neededForThreshold).toFixed(1) },
            { label: "Para 6.0", value: subject.neededToPass === null ? "—" : Math.max(0, subject.neededToPass).toFixed(1) },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <dt className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-white/30">{item.label}</dt>
              <dd className="font-mono text-[15px] leading-none text-white/85">{item.value}</dd>
            </div>
          ))}
        </dl>
        {subject.risk.reasons.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1">
            {subject.risk.reasons.map((reason) => <li key={reason} className="text-[11px] leading-snug text-white/50">— {reason}</li>)}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{subject.nextExam ? `Temas · ${subject.nextExam.kind}` : "Temas"}</Label>
        {topics.length ? (
          <ul className="flex flex-col gap-1">
            {topics.map((topic) => (
              <li key={topic.text} className={cx("flex items-start gap-2 text-[11.5px] leading-snug", topic.focus ? "text-white" : "text-white/55")}>
                <span className={cx("mt-[6px] h-1 w-1 shrink-0 rounded-full", topic.focus ? "bg-white" : "bg-white/20")} />
                <span>{topic.text}{topic.note && <span className="ml-1.5 font-mono text-[9.5px] text-white/35">← {topic.note}</span>}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-white/30">La bóveda no lista temas para esta materia.</p>
        )}
        {subject.laterTopics.length > 0 && <p className="text-[10.5px] leading-relaxed text-white/30">Después: {subject.laterTopics.join(" · ")}</p>}
        {subject.tips.map((tip) => <p key={tip} className="mt-1 border-l border-white/15 pl-3 text-[11.5px] leading-relaxed text-white/55">{tip}</p>)}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Bóveda</Label>
        {subject.mentions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {subject.mentions.map((mention) => (
              <li key={mention.date + mention.text}>
                <Link href={noteHref(mention.path)} className="group block rounded-lg px-2 py-1.5 -mx-2 transition hover:bg-white/[0.03]">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/30 group-hover:text-white/50">{shortDate(mention.date)}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-white/55 group-hover:text-white/75">{mention.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-white/30">Sin menciones recientes en el diario.</p>
        )}
        <dl className="mt-1 flex flex-col gap-1.5">
          {subject.professor && (
            <div className="flex items-baseline justify-between gap-3 text-[11px]">
              <dt className="text-white/30">Profesor</dt>
              <dd className="flex min-w-0 items-center gap-1.5 truncate text-right text-white/65">
                {subject.professor}
                {subject.email && <a href={`mailto:${subject.email}`} aria-label={`Escribir a ${subject.professor}`} className="text-white/35 transition hover:text-white"><Mail className="h-3 w-3" /></a>}
              </dd>
            </div>
          )}
          {subject.details.filter((detail) => detail.label !== "Nota" && detail.value.length < 160).slice(0, 5).map((detail) => (
            <div key={detail.label + detail.value} className="flex items-baseline justify-between gap-3 text-[11px]">
              <dt className="shrink-0 text-white/30">{detail.label}</dt>
              <dd className="min-w-0 text-right text-white/55">{detail.value}</dd>
            </div>
          ))}
        </dl>
        {subject.notePath && (
          <Link href={noteHref(subject.notePath)} className="mt-1 inline-flex h-8 w-fit items-center gap-1.5 rounded-[10px] border border-white/[0.08] px-3 text-[11px] text-white/60 transition hover:border-white/20 hover:text-white active:scale-[0.98]">
            <BookOpen className="h-3.5 w-3.5" />
            Abrir nota
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function SubjectRow({ subject, threshold, expanded, focused, onToggle, onFocus, registerRef }: {
  subject: UniSubject;
  threshold: number;
  expanded: boolean;
  focused: boolean;
  onToggle: (id: string) => void;
  onFocus: (id: string) => void;
  registerRef: (id: string, element: HTMLButtonElement | null) => void;
}) {
  const next = subject.nextExam;
  const hotAbsences = subject.absences.level === "alto" || subject.absences.level === "critico";
  return (
    <motion.li layout="position" transition={{ layout: { duration: 0.3, ease: EASE } }} id={`materia-${subject.id}`} className={cx("relative scroll-mt-28 border-b border-white/[0.05] last:border-b-0", expanded && "bg-white/[0.015]")}>
      <span className={cx("absolute left-0 top-3 bottom-3 w-[2px] rounded-full", RISK_BAR[subject.risk.level])} aria-hidden />
      <button
        ref={(element) => registerRef(subject.id, element)}
        type="button"
        aria-expanded={expanded}
        aria-controls={`detalle-${subject.id}`}
        onClick={() => onToggle(subject.id)}
        onFocus={() => onFocus(subject.id)}
        className={cx(
          "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-4 py-3 text-left outline-none transition-colors hover:bg-white/[0.025] active:scale-[0.995] sm:px-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_52px_96px_minmax(0,0.85fr)_14px]",
          focused && "bg-white/[0.03] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
        )}
      >
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium tracking-[-0.01em] text-white/90">{subject.name}</span>
          <span className="mt-1 flex min-w-0 items-center gap-2">
            <span className={cx(
              "shrink-0 rounded-full border px-1.5 py-px font-mono text-[8.5px] uppercase tracking-[0.12em]",
              subject.standing === "asegurada" ? "border-white/25 text-white/80" : subject.standing === "fuera-de-alcance" || subject.standing === "exigente" ? "border-white/15 text-white/60" : "border-white/[0.08] text-white/35",
            )}>
              {STANDING_LABEL[subject.standing]}
            </span>
            <span className="truncate font-mono text-[9.5px] text-white/30">{subject.professor ?? subject.fullName ?? subject.codes.join(" · ")}</span>
          </span>
        </span>

        <span className="text-right md:hidden">
          <span className="font-mono text-[17px] leading-none tracking-[-0.04em] text-white/85">{grade(subject.current)}</span>
        </span>

        <span className="col-span-2 flex min-w-0 flex-col gap-1.5 md:col-span-1">
          <PointsBar subject={subject} threshold={threshold} />
          <span className="flex justify-between font-mono text-[9px] text-white/30">
            <span>{subject.securedPoints.toFixed(1)} pts</span>
            <span>{subject.neededForThreshold === null ? "" : subject.neededForThreshold > 10 ? `${threshold.toFixed(1)} fuera de alcance` : `necesitas ${Math.max(0, subject.neededForThreshold).toFixed(1)}`}</span>
          </span>
        </span>

        <span className="hidden text-right md:block">
          <span className="font-mono text-[17px] leading-none tracking-[-0.04em] text-white/85">{grade(subject.current)}</span>
        </span>

        <span className="flex min-w-0 items-center gap-2">
          <AbsenceMeter used={subject.absences.used} limit={subject.absences.limit} emphasis={hotAbsences} className="w-[60px]" />
          <span className={cx("font-mono text-[10px]", hotAbsences ? "text-white" : "text-white/35")}>{subject.absences.remaining?.toFixed(1) ?? "—"}</span>
        </span>

        <span className="flex min-w-0 items-center justify-end gap-1.5 font-mono text-[10px] md:justify-start">
          {next ? (
            <>
              {next.status === "hoy" && <PulseDot strong />}
              <span className={cx(next.status === "hoy" ? "text-white" : next.daysUntil <= 3 ? "text-white/70" : "text-white/40")}>{next.kind}</span>
              <span className="truncate text-white/30">{next.status === "hoy" ? "hoy" : `${shortDate(next.date).split(" ").slice(0, 2).join(" ")} · ${compactDays(next.daysUntil)}`}</span>
            </>
          ) : (
            <span className="text-white/20">—</span>
          )}
        </span>

        <ChevronDown className={cx("hidden h-3.5 w-3.5 text-white/30 transition-transform duration-200 md:block", expanded && "rotate-180 text-white/70")} />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={`detalle-${subject.id}`}
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.28, ease: EASE }, opacity: { duration: 0.18 } }}
            className="overflow-hidden"
          >
            <SubjectDetails subject={subject} threshold={threshold} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export default function SubjectList({ subjects, threshold, sort, onSort, expandedId, focusedId, onToggle, onFocus, registerRef, className }: {
  subjects: UniSubject[];
  threshold: number;
  sort: SubjectSort;
  onSort: (sort: SubjectSort) => void;
  expandedId: string | null;
  focusedId: string | null;
  onToggle: (id: string) => void;
  onFocus: (id: string) => void;
  registerRef: (id: string, element: HTMLButtonElement | null) => void;
  className?: string;
}) {
  return (
    <Panel className={className} id="materias">
      <PanelHeader icon={<BookOpen />} title="Materias" meta={`${subjects.length}`}>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-[9px] text-white/30 lg:flex">
            <Kbd>J</Kbd><Kbd>K</Kbd> navegar <Kbd>↵</Kbd> abrir <Kbd>O</Kbd> nota
          </span>
          <Segmented
            layoutId="uni-subject-sort"
            value={sort}
            onChange={onSort}
            options={[{ value: "fecha", label: "Fecha" }, { value: "riesgo", label: "Riesgo" }, { value: "nota", label: "Nota" }]}
          />
        </div>
      </PanelHeader>
      {subjects.length === 0 ? (
        <div className="px-5 py-12 text-center text-[11px] text-white/30">Sin materias. Revisa la nota del semestre en la bóveda o agrega cursos a la base.</div>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_52px_96px_minmax(0,0.85fr)_14px] gap-x-4 border-b border-white/[0.05] px-5 py-2 md:grid">
            <Label>Materia</Label>
            <Label>Puntos sobre 10 · marca {threshold.toFixed(1)}</Label>
            <Label className="text-right">Actual</Label>
            <Label>Faltas rest.</Label>
            <Label>Siguiente</Label>
            <span />
          </div>
          <LayoutGroup>
            <ul>
              {subjects.map((subject) => (
                <SubjectRow
                  key={subject.id}
                  subject={subject}
                  threshold={threshold}
                  expanded={expandedId === subject.id}
                  focused={focusedId === subject.id}
                  onToggle={onToggle}
                  onFocus={onFocus}
                  registerRef={registerRef}
                />
              ))}
            </ul>
          </LayoutGroup>
        </>
      )}
    </Panel>
  );
}
