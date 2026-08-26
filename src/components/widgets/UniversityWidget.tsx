"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, ChevronRight, Clock3, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { updateAssignmentStatus } from "@/app/actions/university";
import type { DashboardAssignment } from "@/components/dashboard/types";
import { WidgetCard, useWidget } from "@/components/ui/widget";

function relativeDueDate(value: string) {
  const due = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d vencida`;
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

export default function UniversityWidget({ initialAssignments }: { initialAssignments: DashboardAssignment[] }) {
  const [assignments, setAssignments] = useState(initialAssignments.filter((item) => item.status !== "done"));
  const [lastCompleted, setLastCompleted] = useState<DashboardAssignment | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const { activeWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "university";
  const sorted = useMemo(() => [...assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [assignments]);
  const next = sorted[0];

  useEffect(() => setAssignments(initialAssignments.filter((item) => item.status !== "done")), [initialAssignments]);

  const complete = (assignment: DashboardAssignment) => {
    setAssignments((current) => current.filter((item) => item.id !== assignment.id));
    setLastCompleted(assignment);
    setMessage("Entrega marcada como lista.");
    startTransition(async () => {
      try { await updateAssignmentStatus(assignment.id, "done"); }
      catch { setAssignments((current) => [...current, assignment]); setLastCompleted(null); setMessage("No se pudo actualizar la entrega."); }
    });
  };

  const undo = () => {
    if (!lastCompleted) return;
    const assignment = lastCompleted;
    setAssignments((current) => [...current, assignment]);
    setLastCompleted(null);
    setMessage("Cambio deshecho.");
    startTransition(async () => { await updateAssignmentStatus(assignment.id, "pending"); });
  };

  return (
    <WidgetCard id="university" defaultClassName="min-h-[300px] md:col-span-3 xl:col-span-3" expandedClassName="min-h-[480px] md:col-span-6 xl:col-span-12" shrunkClassName="min-h-[180px] md:col-span-3 xl:col-span-3">
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><BookOpen className="h-3.5 w-3.5 text-white/45" /><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Universidad</p><p className="mt-1 text-[10px] text-white/25">{sorted.length} entregas pendientes</p></div></div>
          <Link href="/uni" data-no-expand className="flex h-8 items-center gap-1 rounded-xl px-2.5 text-[10px] text-white/30 transition hover:bg-white/[0.045] hover:text-white/70 active:scale-[0.98]">Abrir <ChevronRight className="h-3 w-3" /></Link>
        </div>

        {next ? (
          <div className="mt-7">
            <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.15em] text-white/25"><Clock3 className="h-3 w-3" />{relativeDueDate(next.dueDate)}</div>
            <p className="mt-3 text-xl font-medium leading-tight tracking-[-0.035em] text-white/75">{next.title}</p>
            <p className="mt-1 text-[10px] text-white/30">{next.course.name}</p>
            <button data-no-expand type="button" onClick={() => complete(next)} disabled={isPending} className="mt-5 flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[10px] text-white/45 transition hover:bg-white/[0.06] hover:text-white/75 active:scale-[0.98] disabled:opacity-40"><Check className="h-3 w-3" />Marcar como lista</button>
          </div>
        ) : <div className="flex flex-1 flex-col items-center justify-center text-center"><Check className="mb-3 h-5 w-5 text-white/20" /><p className="text-xs text-white/35">No hay entregas pendientes.</p></div>}

        <AnimatePresence initial={false}>
          {isExpanded && sorted.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-6 border-t border-white/[0.055] pt-3">
              <div className="max-h-48 divide-y divide-white/[0.05] overflow-y-auto">{sorted.slice(1, 8).map((assignment) => <div key={assignment.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5"><div className="min-w-0"><p className="truncate text-[11px] text-white/55">{assignment.title}</p><p className="mt-0.5 truncate text-[9px] text-white/20">{assignment.course.name}</p></div><span className="font-mono text-[8px] text-white/25">{relativeDueDate(assignment.dueDate)}</span><button data-no-expand type="button" onClick={() => complete(assignment)} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/25 transition hover:bg-white/[0.06] hover:text-white/65 active:scale-95" aria-label={`Completar ${assignment.title}`}><Check className="h-3 w-3" /></button></div>)}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-auto flex min-h-6 items-center justify-between pt-3"><p aria-live="polite" className="text-[9px] text-white/25">{message}</p>{lastCompleted && <button data-no-expand type="button" onClick={undo} className="flex items-center gap-1 text-[9px] text-white/35 transition hover:text-white/70"><Undo2 className="h-3 w-3" />Deshacer</button>}</div>
      </div>
    </WidgetCard>
  );
}
