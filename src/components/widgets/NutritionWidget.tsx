"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Droplets, Flame, Plus, Utensils } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { getDailyMacros, logFood, logWater } from "@/app/actions/nutrition";
import type { DashboardNutrition } from "@/components/dashboard/types";
import { WidgetCard, useWidget } from "@/components/ui/widget";
import { NUTRITION_GOALS as goals } from "@/features/nutrition/nutrition";

export default function NutritionWidget({ initialData }: { initialData: DashboardNutrition }) {
  const [data, setData] = useState(initialData);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const { activeWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "nutrition";
  const calorieProgress = Math.min(1, data.totals.calories / goals.calories);

  useEffect(() => setData(initialData), [initialData]);

  const refresh = async () => {
    const refreshed = await getDailyMacros();
    setData({ totals: refreshed.totals, logs: refreshed.logs.map((log) => ({ ...log, date: log.date.toISOString() })) });
  };

  const submitFood = (event: React.FormEvent) => {
    event.preventDefault();
    const description = input.trim();
    if (!description) return;
    setMessage("");
    startTransition(async () => {
      try {
        await logFood(description);
        await refresh();
        setInput("");
        setMessage("Comida analizada y registrada.");
      } catch (reason) {
        setMessage(reason instanceof Error ? reason.message : "No se pudo registrar la comida.");
      }
    });
  };

  const addWater = () => {
    startTransition(async () => {
      try { await logWater(0.5); await refresh(); setMessage("Agregaste 500 ml de agua."); }
      catch { setMessage("No se pudo registrar el agua."); }
    });
  };

  return (
    <WidgetCard id="nutrition" defaultClassName="min-h-[300px] md:col-span-3 xl:col-span-3" expandedClassName="min-h-[480px] md:col-span-6 xl:col-span-12" shrunkClassName="min-h-[180px] md:col-span-3 xl:col-span-3">
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><Utensils className="h-3.5 w-3.5 text-white/45" /><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Nutrición</p><p className="mt-1 text-[10px] text-white/25">Balance de hoy</p></div></div>
          <Link href="/food" data-no-expand className="flex h-8 items-center gap-1 rounded-xl px-2.5 text-[10px] text-white/30 transition hover:bg-white/[0.045] hover:text-white/70 active:scale-[0.98]">Abrir <ChevronRight className="h-3 w-3" /></Link>
        </div>

        <div className="mt-6">
          <div className="flex items-end justify-between"><div><p className="text-3xl font-medium tracking-[-0.055em] text-white/80">{Math.round(data.totals.calories)}</p><p className="mt-1 font-mono text-[8px] uppercase tracking-[0.15em] text-white/25">de {goals.calories} kcal</p></div><Flame className="h-5 w-5 text-white/20" /></div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.05]"><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: calorieProgress }} style={{ transformOrigin: "left" }} className="h-full w-full rounded-full bg-white/50" /></div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-white/[0.055]"><Macro label="Proteína" value={`${Math.round(data.totals.protein)}g`} goal={`${goals.protein}g`} /><Macro label="Carbos" value={`${Math.round(data.totals.carbs)}g`} goal={`${goals.carbs}g`} /><Macro label="Grasa" value={`${Math.round(data.totals.fat)}g`} goal={`${goals.fat}g`} /></div>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mt-5 border-t border-white/[0.055] pt-4">
              <div className="mb-3 flex items-center justify-between"><p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">Comidas de hoy</p><button data-no-expand type="button" onClick={addWater} disabled={isPending} className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] px-3 text-[9px] text-white/40 transition hover:text-white/70 active:scale-[0.98]"><Droplets className="h-3 w-3" />+500 ml</button></div>
              {data.logs.length === 0 ? <div className="flex min-h-20 items-center justify-center text-xs text-white/25">Todavía no has registrado comida hoy.</div> : <div className="max-h-32 divide-y divide-white/[0.05] overflow-y-auto">{data.logs.slice(0, 5).map((log) => <div key={log.id} className="flex items-center justify-between gap-3 py-2.5"><p className="truncate text-[11px] text-white/55">{log.description}</p><span className="shrink-0 font-mono text-[9px] text-white/30">{Math.round(log.calories)} kcal</span></div>)}</div>}
            </motion.div>
          )}
        </AnimatePresence>

        <form data-no-expand onSubmit={submitFood} className="relative mt-auto pt-5">
          <label className="sr-only" htmlFor="quick-food">Registrar comida</label>
          <input id="quick-food" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Describe lo que comiste…" className="h-10 w-full rounded-xl border border-white/[0.07] bg-white/[0.025] pl-3 pr-10 text-[11px] outline-none placeholder:text-white/20 focus:border-white/[0.16]" />
          <button disabled={isPending || !input.trim()} className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/[0.07] hover:text-white/70 active:scale-95 disabled:opacity-20" aria-label="Registrar comida"><Plus className="h-3.5 w-3.5" /></button>
          <p aria-live="polite" className="mt-2 min-h-4 text-[9px] text-white/30">{isPending ? "Shadow está analizando la comida…" : message}</p>
        </form>
      </div>
    </WidgetCard>
  );
}

function Macro({ label, value, goal }: { label: string; value: string; goal: string }) {
  return <div className="px-2 first:pl-0 last:pr-0"><p className="font-mono text-[7px] uppercase tracking-wider text-white/20">{label}</p><p className="mt-1 text-[12px] text-white/55">{value}<span className="ml-1 text-[8px] text-white/18">/ {goal}</span></p></div>;
}
