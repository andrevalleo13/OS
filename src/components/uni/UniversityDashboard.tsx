"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { RotateCw, Unplug } from "lucide-react";
import type { RiskLevel, UniOverview, UniSubject } from "@/features/uni/types";
import AbsencesCard from "./AbsencesCard";
import AssignmentsPanel from "./AssignmentsPanel";
import BalanceChart from "./BalanceChart";
import ExamTimeline from "./ExamTimeline";
import FinalsCard from "./FinalsCard";
import HeroNextExam from "./HeroNextExam";
import ScholarshipCard from "./ScholarshipCard";
import StudyQueue from "./StudyQueue";
import SubjectList, { type SubjectSort } from "./SubjectList";
import { ago, dayMonth, noteHref, weekdayLong } from "./format";
import { cx, PulseDot, rise, stagger } from "./primitives";

const RISK_ORDER: RiskLevel[] = ["bajo", "medio", "alto", "critico"];

function sortSubjects(subjects: UniSubject[], sort: SubjectSort): UniSubject[] {
  if (sort === "fecha") return subjects;
  const list = [...subjects];
  if (sort === "riesgo") {
    return list.sort((a, b) => RISK_ORDER.indexOf(b.risk.level) - RISK_ORDER.indexOf(a.risk.level) || (b.neededForThreshold ?? 0) - (a.neededForThreshold ?? 0));
  }
  return list.sort((a, b) => (a.current ?? 11) - (b.current ?? 11) || a.name.localeCompare(b.name, "es"));
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reducedMotion === "true");
}

export default function UniversityDashboard({ overview }: { overview: UniOverview }) {
  const router = useRouter();
  const [sort, setSort] = useState<SubjectSort>("fecha");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const subjects = useMemo(() => sortSubjects(overview.subjects, sort), [overview.subjects, sort]);
  const subjectsRef = useRef(subjects);
  const focusedRef = useRef(focusedId);
  const expandedRef = useRef(expandedId);

  useEffect(() => {
    subjectsRef.current = subjects;
    focusedRef.current = focusedId;
    expandedRef.current = expandedId;
  }, [subjects, focusedId, expandedId]);

  const registerRef = useCallback((id: string, element: HTMLButtonElement | null) => {
    if (element) rowRefs.current.set(id, element);
    else rowRefs.current.delete(id);
  }, []);

  const toggle = useCallback((id: string) => {
    const opening = expandedRef.current !== id;
    setExpandedId(opening ? id : null);
    setFocusedId(id);
    // Tras la animación de altura, deja el detalle a la vista sin saltos.
    if (opening) window.setTimeout(() => document.getElementById(`materia-${id}`)?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" }), 320);
  }, []);

  const openSubject = useCallback((id: string) => {
    setExpandedId(id);
    setFocusedId(id);
    window.requestAnimationFrame(() => {
      document.getElementById(`materia-${id}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      rowRefs.current.get(id)?.focus({ preventScroll: true });
    });
  }, []);

  // Navegación de teclado: J/K entre materias, Enter (nativo del botón) abre, O abre la nota, Esc cierra.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [cmdk-root]")) return;
      const key = event.key.toLowerCase();
      const list = subjectsRef.current;
      if (!list.length) return;
      if (key === "escape") {
        if (expandedRef.current) setExpandedId(null);
        return;
      }
      if (key !== "j" && key !== "k" && key !== "o") return;
      const index = list.findIndex((subject) => subject.id === focusedRef.current);
      if (key === "o") {
        const subject = list[index];
        if (subject?.notePath) {
          event.preventDefault();
          router.push(noteHref(subject.notePath));
        }
        return;
      }
      event.preventDefault();
      const nextIndex = key === "j" ? (index === -1 ? 0 : Math.min(list.length - 1, index + 1)) : (index === -1 ? 0 : Math.max(0, index - 1));
      const id = list[nextIndex].id;
      setFocusedId(id);
      const element = rowRefs.current.get(id);
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const nextSubject = overview.nextExam ? overview.subjects.find((subject) => subject.id === overview.nextExam?.subjectId) ?? null : null;
  const refresh = () => startRefresh(() => router.refresh());

  return (
    <MotionConfig reducedMotion="user">
      <motion.main variants={stagger} initial="hidden" animate="visible" className="os-page mx-auto grid w-full max-w-[1400px] grid-cols-12 gap-3 pb-10 md:gap-4">
        <motion.div variants={rise} className="col-span-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-white/35">
            <span className="flex items-center gap-2 text-white/60">
              <PulseDot />
              <span className="capitalize">{weekdayLong(overview.today)}</span> {dayMonth(overview.today)}
            </span>
            <span className="text-white/15">/</span>
            {overview.vault.available && overview.vault.notePath ? (
              <Link href={noteHref(overview.vault.notePath)} className="transition hover:text-white">
                Bóveda en vivo · editada {overview.vault.updatedAt ? ago(overview.vault.updatedAt, overview.generatedAt) : ""}
              </Link>
            ) : (
              <span>Bóveda no disponible</span>
            )}
            <span className="text-white/15">/</span>
            <span>Base {overview.db.available ? "en línea" : "sin conexión"}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex h-7 items-center gap-1.5 rounded-[9px] border border-white/[0.07] px-2.5 font-mono text-[10px] text-white/45 transition hover:border-white/20 hover:text-white active:scale-[0.97] disabled:opacity-60"
          >
            <RotateCw className={cx("h-3 w-3", refreshing && "animate-spin")} />
            {refreshing ? "Leyendo…" : "Releer bóveda"}
          </button>
        </motion.div>

        {!overview.vault.available && (
          <motion.div variants={rise} className="col-span-12 flex items-start gap-3 rounded-[16px] border border-dashed border-white/[0.12] px-4 py-3">
            <Unplug className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
            <p className="text-[11.5px] leading-relaxed text-white/50">
              {overview.vault.reason ?? "La bóveda no está disponible."} Mostrando solo lo que hay en la base de datos{overview.db.available ? "" : " (que tampoco respondió)"}.
            </p>
          </motion.div>
        )}

        <HeroNextExam overview={overview} subject={nextSubject} onOpenSubject={openSubject} className="col-span-12 lg:col-span-6" />
        <ScholarshipCard overview={overview} className="col-span-12 md:col-span-6 lg:col-span-3" />
        <AbsencesCard overview={overview} onOpenSubject={openSubject} className="col-span-12 md:col-span-6 lg:col-span-3" />

        <ExamTimeline overview={overview} onOpenSubject={openSubject} className="col-span-12" />

        <div className="col-span-12 flex min-w-0 flex-col gap-3 md:gap-4 xl:col-span-8">
          <SubjectList
            subjects={subjects}
            threshold={overview.scholarship.threshold}
            sort={sort}
            onSort={setSort}
            expandedId={expandedId}
            focusedId={focusedId}
            onToggle={toggle}
            onFocus={setFocusedId}
            registerRef={registerRef}
          />
          <AssignmentsPanel overview={overview} />
        </div>
        <div className="col-span-12 flex min-w-0 flex-col gap-3 md:gap-4 xl:col-span-4">
          <StudyQueue items={overview.study} onOpenSubject={openSubject} />
          <BalanceChart scholarship={overview.scholarship} subjects={overview.subjects} onOpenSubject={openSubject} />
          <FinalsCard finals={overview.finals} notePath={overview.vault.notePath} onOpenSubject={openSubject} />
        </div>
      </motion.main>
    </MotionConfig>
  );
}
