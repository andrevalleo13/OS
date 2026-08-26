"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowUpRight, ChevronRight, Dumbbell, Footprints, Play } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { logSteps } from "@/app/actions/gym";
import type { DashboardGym } from "@/components/dashboard/types";
import { WEEKLY_ROUTINES, type DayRoutine } from "@/components/gym/MuscleData";
import { WidgetCard, useWidget } from "@/components/ui/widget";

const number = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });

export default function GymWidget({ initialData }: { initialData: DashboardGym }) {
  const [routine, setRoutine] = useState<DayRoutine | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const { activeWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "gym";

  useEffect(() => setRoutine(WEEKLY_ROUTINES[new Date().getDay()]), []);

  const registerSteps = () => {
    startTransition(async () => {
      const result = await logSteps(10_000);
      setMessage(result.success ? "10,000 pasos registrados." : "No se pudieron registrar los pasos.");
    });
  };

  return (
    <WidgetCard id="gym" defaultClassName="min-h-[300px] md:col-span-6 xl:col-span-6" expandedClassName="min-h-[500px] md:col-span-6 xl:col-span-12" shrunkClassName="min-h-[180px] md:col-span-3 xl:col-span-6">
      <div className="pointer-events-none absolute bottom-[-120px] right-[-80px] h-72 w-72 rounded-full bg-white/[0.018] blur-[90px]" />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><Activity className="h-3.5 w-3.5 text-white/45" /><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Entrenamiento</p><p className="mt-1 text-[10px] text-white/25">{routine?.day || "Cargando rutina"}</p></div></div>
          <Link href="/gym" data-no-expand className="flex h-8 items-center gap-1 rounded-xl px-2.5 text-[10px] text-white/30 transition hover:bg-white/[0.045] hover:text-white/70 active:scale-[0.98]">Abrir <ChevronRight className="h-3 w-3" /></Link>
        </div>

        <div className="mt-7 grid items-end gap-6 sm:grid-cols-[1fr_auto]">
          <div><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.025]"><Dumbbell className="h-4 w-4 text-white/40" /></div><p className="text-2xl font-medium tracking-[-0.045em] text-white/80">{routine?.name || "Preparando sesión"}</p><p className="mt-1 text-[11px] text-white/30">{routine?.isRest ? "Recuperación y actividad ligera" : `${routine?.exercises.length || 0} ejercicios programados`}</p></div>
          {routine?.isRest ? (
            <button data-no-expand type="button" onClick={registerSteps} disabled={isPending} className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[10px] font-medium text-[#111] transition active:scale-[0.98] disabled:opacity-40"><Footprints className="h-3.5 w-3.5" />{isPending ? "Registrando…" : "Registrar 10k pasos"}</button>
          ) : (
            <Link href="/gym?intent=start" data-no-expand className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[10px] font-medium text-[#111] transition hover:bg-white/90 active:scale-[0.98]"><Play className="h-3.5 w-3.5 fill-current" />Iniciar sesión</Link>
          )}
        </div>

        <div className="mt-6 grid grid-cols-3 divide-x divide-white/[0.055] border-y border-white/[0.055] py-4">
          <Stat label="Sesiones" value={number.format(initialData.totalWorkouts)} />
          <Stat label="Volumen total" value={`${number.format(initialData.lifetimeVolume)} kg`} />
          <Stat label="Peso actual" value={`${initialData.currentWeight.toFixed(1)} kg`} />
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div><p className="mb-2 font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">Rutina de hoy</p><div className="divide-y divide-white/[0.05]">{routine?.exercises.length ? routine.exercises.map((exercise, index) => <div key={exercise.id} className="grid grid-cols-[24px_1fr_auto] items-center gap-2 py-2.5"><span className="font-mono text-[9px] text-white/18">{String(index + 1).padStart(2, "0")}</span><p className="truncate text-[11px] text-white/55">{exercise.name}</p><span className="font-mono text-[9px] text-white/25">{exercise.sets} × {exercise.reps}</span></div>) : <div className="flex min-h-24 items-center justify-center text-xs text-white/25">Hoy toca recuperación.</div>}</div></div>
              <div><p className="mb-2 font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">Últimas sesiones</p>{initialData.sessionHistory.length ? <div className="divide-y divide-white/[0.05]">{initialData.sessionHistory.slice(0, 4).map((session) => <div key={session.id} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><p className="truncate text-[11px] text-white/55">{session.routineName}</p><p className="mt-0.5 text-[9px] text-white/20">{session.date} · {session.duration}</p></div><span className="font-mono text-[9px] text-white/25">{number.format(session.totalVolume)} kg</span></div>)}</div> : <div className="flex min-h-24 items-center justify-center text-xs text-white/25">Completa tu primera sesión.</div>}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-auto flex items-center justify-between pt-3"><p aria-live="polite" className="text-[9px] text-white/25">{message}</p>{initialData.sessionHistory[0] && <p className="flex items-center gap-1 text-[9px] text-white/20">Última: {initialData.sessionHistory[0].date}<ArrowUpRight className="h-3 w-3" /></p>}</div>
      </div>
    </WidgetCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="px-4 first:pl-0 last:pr-0"><p className="font-mono text-[7px] uppercase tracking-[0.15em] text-white/20">{label}</p><p className="mt-1 text-[12px] text-white/55">{value}</p></div>;
}
