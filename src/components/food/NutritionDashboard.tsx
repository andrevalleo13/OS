"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Brain,
  ChevronDown,
  Copy,
  Droplets,
  Dumbbell,
  Flame,
  Loader2,
  Pencil,
  Save,
  ScanLine,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  deleteFoodLog,
  duplicateFoodLog,
  getShadowMacroAdvice,
  logWater,
  updateFoodLog,
} from "@/app/actions/nutrition";
import NutritionComposer from "@/components/food/NutritionComposer";
import ShadowOrb from "@/components/ShadowOrb";
import {
  sumNutritionItems,
  type FoodAnalysisItem,
  type FoodLogView,
  type MacroTotals,
  type ShadowNutritionInsight,
} from "@/features/nutrition/nutrition";
import { containerVariants, itemVariants } from "@/lib/animations";

type HistoryDay = Omit<MacroTotals, "water">;
type History = Record<string, HistoryDay>;

export default function NutritionDashboard({
  dailyTotals,
  goals,
  logs,
  monthlyHistory,
  timezone,
}: {
  dailyTotals: MacroTotals;
  goals: Readonly<MacroTotals>;
  logs: FoodLogView[];
  monthlyHistory: History;
  timezone: string;
}) {
  const refreshKey = `${Math.round(dailyTotals.calories)}-${Math.round(dailyTotals.protein)}-${logs.length}`;

  return (
    <motion.main
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 pb-24"
    >
      <motion.div variants={itemVariants}>
        <NutritionComposer />
      </motion.div>

      <motion.section variants={itemVariants} className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <DailyNutritionSummary totals={dailyTotals} goals={goals} />
        <ShadowHealthPanel refreshKey={refreshKey} />
      </motion.section>

      <motion.section variants={itemVariants} className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <MealTimeline logs={logs} timezone={timezone} />
        <DayRhythm logs={logs} goals={goals} totals={dailyTotals} timezone={timezone} />
      </motion.section>

      <motion.div variants={itemVariants}>
        <ConsistencyMatrix history={monthlyHistory} goals={goals} timezone={timezone} />
      </motion.div>
    </motion.main>
  );
}

function DailyNutritionSummary({ totals, goals }: { totals: MacroTotals; goals: Readonly<MacroTotals> }) {
  const remaining = Math.max(0, goals.calories - totals.calories);
  const calorieProgress = Math.min(1, totals.calories / goals.calories);
  const [waterMessage, setWaterMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const addWater = (liters: number) => {
    setWaterMessage("");
    startTransition(async () => {
      try {
        await logWater(liters);
        setWaterMessage(`Agregaste ${Math.round(liters * 1_000)} ml.`);
      } catch {
        setWaterMessage("No pude registrar el agua.");
      }
    });
  };

  return (
    <div className="os-surface rounded-[26px] p-5 md:p-7">
      <div className="grid gap-7 md:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)] md:items-end">
        <div>
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/28">
            <Flame className="h-3.5 w-3.5 text-white/38" /> Balance de hoy
          </div>
          <div className="mt-6 flex items-end gap-3">
            <span className="text-5xl font-medium tracking-[-0.065em] text-white/84 md:text-6xl">{Math.round(totals.calories)}</span>
            <span className="pb-2 font-mono text-[10px] text-white/25">/ {goals.calories} kcal</span>
          </div>
          <p className="mt-3 text-xs text-white/35">
            {totals.calories <= goals.calories ? `${Math.round(remaining)} kcal disponibles` : `${Math.round(totals.calories - goals.calories)} kcal sobre la meta`}
          </p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: calorieProgress }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: "left" }}
              className="h-full w-full rounded-full bg-white/60"
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-white/[0.055] pt-6 md:border-l md:border-t-0 md:pl-7 md:pt-0">
          <MacroProgress label="Proteína" current={totals.protein} goal={goals.protein} />
          <MacroProgress label="Carbohidratos" current={totals.carbs} goal={goals.carbs} />
          <MacroProgress label="Grasa" current={totals.fat} goal={goals.fat} />
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-4 border-t border-white/[0.055] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.035] text-white/38">
            <Droplets className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-white/58">{totals.water.toFixed(2)} L <span className="text-white/20">/ {goals.water} L</span></p>
            <p aria-live="polite" className="mt-1 min-h-3 text-[9px] text-white/25">{isPending ? "Registrando hidratación…" : waterMessage || "Hidratación registrada hoy"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {[0.25, 0.5].map((liters) => (
            <button
              key={liters}
              type="button"
              onClick={() => addWater(liters)}
              disabled={isPending}
              className="h-9 rounded-xl border border-white/[0.07] px-3 font-mono text-[9px] text-white/35 transition hover:bg-white/[0.035] hover:text-white/65 active:scale-[0.98] disabled:opacity-30"
            >
              +{Math.round(liters * 1_000)} ml
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MacroProgress({ label, current, goal }: { label: string; current: number; goal: number }) {
  const progress = Math.min(1, current / goal);
  const remaining = Math.max(0, goal - current);
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[10px] text-white/35">{label}</span>
        <span className="font-mono text-[9px] text-white/28"><strong className="font-normal text-white/62">{Math.round(current)}g</strong> / {goal}g · {Math.round(remaining)}g restantes</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: progress }} style={{ transformOrigin: "left" }} className="h-full w-full rounded-full bg-white/45" />
      </div>
    </div>
  );
}

function ShadowHealthPanel({ refreshKey }: { refreshKey: string }) {
  const [insight, setInsight] = useState<ShadowNutritionInsight | null>(null);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    getShadowMacroAdvice()
      .then((result) => { if (!cancelled) setInsight(result); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [refreshKey, retryCount]);

  return (
    <div className="os-surface relative overflow-hidden rounded-[26px] p-5 md:p-6">
      <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 opacity-35 blur-sm">
        <ShadowOrb status={insight ? "idle" : "thinking"} hideBackground />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/28">
          <ScanLine className="h-3.5 w-3.5 text-white/42" /> Shadow · Contexto cruzado
        </div>
        {error ? (
          <div className="mt-8">
            <p className="text-sm leading-relaxed text-white/45">No pude construir el contexto de salud en este momento.</p>
            <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-4 text-[10px] text-white/35 underline underline-offset-4 transition hover:text-white/65">Reintentar</button>
          </div>
        ) : insight ? (
          <>
            <p className="mt-8 max-w-[34ch] text-[15px] leading-relaxed text-white/72">{insight.message}</p>
            <div className="mt-7 divide-y divide-white/[0.055] border-y border-white/[0.055]">
              <SignalRow icon={<Utensils className="h-3.5 w-3.5" />} label="Nutrición" value={`${Math.round(insight.nutrition.remainingProtein)}g proteína · ${Math.round(insight.nutrition.remainingCalories)} kcal pendientes`} />
              <SignalRow icon={<Dumbbell className="h-3.5 w-3.5" />} label={insight.training.state === "completed" ? "Entrenamiento real" : "Entrenamiento previsto"} value={`${insight.training.label} · ${insight.training.detail}`} />
              <SignalRow icon={<Brain className="h-3.5 w-3.5" />} label="Recuperación" value={`${insight.recovery.readiness}/100 · ${insight.recovery.detail}`} />
            </div>
          </>
        ) : (
          <div role="status" className="mt-8 space-y-4">
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="h-3 w-3/5 animate-pulse rounded-full bg-white/[0.04]" />
            <div className="mt-7 h-24 animate-pulse rounded-2xl bg-white/[0.025]" />
          </div>
        )}
      </div>
    </div>
  );
}

function SignalRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 py-3.5">
      <div className="mt-0.5 text-white/28">{icon}</div>
      <div className="min-w-0">
        <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/20">{label}</p>
        <p className="mt-1 truncate text-[10px] text-white/42" title={value}>{value}</p>
      </div>
    </div>
  );
}

function MealTimeline({ logs, timezone }: { logs: FoodLogView[]; timezone: string }) {
  const groups = useMemo(() => groupLogs(logs, timezone), [logs, timezone]);
  return (
    <div className="os-surface rounded-[26px] p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Utensils className="h-3.5 w-3.5 text-white/35" />
          <div><p className="text-sm font-medium text-white/68">Registro de hoy</p><p className="mt-1 text-[9px] text-white/24">Toca una comida para revisar o corregir el desglose</p></div>
        </div>
        <span className="font-mono text-[9px] text-white/22">{logs.length} registros</span>
      </div>

      {logs.length === 0 ? (
        <div className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.07] text-center">
          <Utensils className="h-5 w-5 text-white/18" />
          <p className="mt-4 text-xs text-white/30">Todavía no hay comida registrada hoy.</p>
          <p className="mt-1 text-[9px] text-white/18">La primera entrada aparecerá aquí después de confirmarla.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 flex items-center gap-3">
                <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/22">{group.label}</span>
                <div className="h-px flex-1 bg-white/[0.045]" />
                <span className="font-mono text-[8px] text-white/18">{Math.round(group.logs.reduce((sum, log) => sum + log.calories, 0))} kcal</span>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {group.logs.map((log) => <FoodLogEntry key={log.id} log={log} timezone={timezone} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FoodLogEntry({ log, timezone }: { log: FoodLogView; timezone: string }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(log.description);
  const [items, setItems] = useState<FoodAnalysisItem[]>(log.breakdown.length > 0 ? log.breakdown : [fallbackItem(log)]);
  const [water, setWater] = useState(log.water);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const editTotals = sumNutritionItems(items, water);

  const startEditing = () => {
    setDescription(log.description);
    setItems(log.breakdown.length > 0 ? log.breakdown : [fallbackItem(log)]);
    setWater(log.water);
    setEditing(true);
    setExpanded(true);
    setMessage("");
  };

  const save = () => {
    startTransition(async () => {
      try {
        await updateFoodLog({ id: log.id, description, items, water });
        setEditing(false);
        setMessage("Cambios guardados.");
      } catch {
        setMessage("No pude guardar los cambios.");
      }
    });
  };

  const duplicate = () => {
    startTransition(async () => {
      try { await duplicateFoodLog(log.id); setMessage("Comida duplicada."); }
      catch { setMessage("No pude duplicarla."); }
    });
  };

  const remove = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    startTransition(async () => {
      try { await deleteFoodLog(log.id); }
      catch { setMessage("No pude eliminar el registro."); setConfirmDelete(false); }
    });
  };

  return (
    <div className="py-1">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
        <span className="w-12 font-mono text-[9px] text-white/22">{formatTime(log.date, timezone)}</span>
        <button type="button" onClick={() => setExpanded((value) => !value)} className="min-w-0 text-left active:scale-[0.99]">
          <span className="block truncate text-[12px] text-white/60">{log.description}</span>
          <span className="mt-1 block font-mono text-[8px] text-white/20">{log.breakdown.length} ingredientes · {log.water > 0 ? `${log.water.toFixed(2)} L agua` : "desglose disponible"}</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 font-mono text-[9px] text-white/28 sm:flex"><span className="text-white/52">{Math.round(log.calories)} kcal</span><span>{Math.round(log.protein)}P</span><span>{Math.round(log.carbs)}C</span><span>{Math.round(log.fat)}G</span></div>
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Cerrar desglose" : "Abrir desglose"} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/24 transition hover:bg-white/[0.035] hover:text-white/55 active:scale-[0.98]"><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mb-3 rounded-2xl border border-white/[0.055] bg-white/[0.015] p-4">
            {editing ? (
              <MealEditor description={description} items={items} water={water} totals={editTotals} onDescriptionChange={setDescription} onItemsChange={setItems} onWaterChange={setWater} />
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <div className="min-w-[520px]">
                  <div className="grid grid-cols-[minmax(170px,1fr)_90px_repeat(4,62px)] gap-2 px-2 pb-2 font-mono text-[7px] uppercase tracking-wider text-white/18"><span>Ingrediente</span><span>Porción</span><span>Kcal</span><span>Pro</span><span>Carb</span><span>Grasa</span></div>
                  {items.map((item, index) => <div key={`${item.name}-${index}`} className="grid grid-cols-[minmax(170px,1fr)_90px_repeat(4,62px)] gap-2 border-t border-white/[0.045] px-2 py-2 text-[9px] text-white/32"><span className="truncate text-white/48">{item.name}</span><span>{item.quantity} {item.unit}</span><span>{Math.round(item.calories)}</span><span>{item.protein}</span><span>{item.carbs}</span><span>{item.fat}</span></div>)}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.05] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p aria-live="polite" className="min-h-4 text-[9px] text-white/28">{isPending ? "Actualizando registro…" : message}</p>
              <div className="flex flex-wrap gap-2">
                {editing ? (
                  <>
                    <ActionButton icon={<X className="h-3.5 w-3.5" />} label="Cancelar" onClick={() => setEditing(false)} />
                    <ActionButton primary icon={isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} label="Guardar" onClick={save} disabled={isPending || !description.trim()} />
                  </>
                ) : (
                  <>
                    <ActionButton icon={<Pencil className="h-3.5 w-3.5" />} label="Editar" onClick={startEditing} />
                    <ActionButton icon={<Copy className="h-3.5 w-3.5" />} label="Duplicar" onClick={duplicate} disabled={isPending} />
                    <ActionButton danger={confirmDelete} icon={<Trash2 className="h-3.5 w-3.5" />} label={confirmDelete ? "Confirmar borrado" : "Eliminar"} onClick={remove} disabled={isPending} />
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MealEditor({ description, items, water, totals, onDescriptionChange, onItemsChange, onWaterChange }: { description: string; items: FoodAnalysisItem[]; water: number; totals: MacroTotals; onDescriptionChange: (value: string) => void; onItemsChange: (items: FoodAnalysisItem[]) => void; onWaterChange: (value: number) => void }) {
  const update = (index: number, field: keyof FoodAnalysisItem, value: string) => {
    onItemsChange(items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (field === "name" || field === "unit") return { ...item, [field]: value };
      const numericValue = Math.max(field === "quantity" ? 0.01 : 0, Number(value) || 0);
      if (field !== "quantity") return { ...item, [field]: numericValue };
      const ratio = item.quantity > 0 ? numericValue / item.quantity : 1;
      return {
        ...item,
        quantity: numericValue,
        calories: Math.round(item.calories * ratio),
        protein: Math.round(item.protein * ratio * 10) / 10,
        carbs: Math.round(item.carbs * ratio * 10) / 10,
        fat: Math.round(item.fat * ratio * 10) / 10,
      };
    }));
  };
  return (
    <div>
      <input value={description} onChange={(event) => onDescriptionChange(event.target.value)} aria-label="Descripción de la comida" className="w-full border-b border-white/[0.06] bg-transparent pb-3 text-sm text-white/62 outline-none" />
      <div className="mt-3 overflow-x-auto custom-scrollbar"><div className="min-w-[650px] space-y-2">{items.map((item, index) => <div key={`${item.name}-${index}`} className="grid grid-cols-[minmax(150px,1fr)_70px_90px_repeat(4,68px)_30px] gap-2"><EditorInput label="Ingrediente" value={item.name} onChange={(value) => update(index, "name", value)} /><EditorInput label="Cantidad" type="number" value={item.quantity} onChange={(value) => update(index, "quantity", value)} /><EditorInput label="Unidad" value={item.unit} onChange={(value) => update(index, "unit", value)} /><EditorInput label="Calorías" type="number" value={item.calories} onChange={(value) => update(index, "calories", value)} /><EditorInput label="Proteína" type="number" value={item.protein} onChange={(value) => update(index, "protein", value)} /><EditorInput label="Carbohidratos" type="number" value={item.carbs} onChange={(value) => update(index, "carbs", value)} /><EditorInput label="Grasa" type="number" value={item.fat} onChange={(value) => update(index, "fat", value)} /><button type="button" onClick={() => items.length > 1 && onItemsChange(items.filter((_, itemIndex) => itemIndex !== index))} disabled={items.length <= 1} aria-label={`Eliminar ${item.name}`} className="text-white/20 transition hover:text-white/55 disabled:opacity-10"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[9px] text-white/28"><button type="button" onClick={() => onItemsChange([...items, { name: "Ingrediente", quantity: 1, unit: "porción", calories: 0, protein: 0, carbs: 0, fat: 0 }])} className="flex items-center gap-2 transition hover:text-white/60"><Utensils className="h-3.5 w-3.5" />Agregar ingrediente</button><div className="flex items-center gap-4"><label>Agua <input type="number" min="0" step="0.05" value={water} onChange={(event) => onWaterChange(Math.max(0, Number(event.target.value) || 0))} className="ml-1 w-12 bg-transparent text-right text-white/55 outline-none" /> L</label><span className="font-mono text-white/48">{totals.calories} kcal · {totals.protein}P · {totals.carbs}C · {totals.fat}G</span></div></div>
    </div>
  );
}

function EditorInput({ label, value, type = "text", onChange }: { label: string; value: string | number; type?: "text" | "number"; onChange: (value: string) => void }) {
  return <input aria-label={label} title={label} type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? 0.1 : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="h-8 min-w-0 rounded-lg border border-white/[0.055] bg-white/[0.018] px-2 text-[9px] text-white/45 outline-none focus:border-white/[0.14]" />;
}

function ActionButton({ icon, label, onClick, disabled = false, primary = false, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; primary?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`flex h-9 items-center gap-2 rounded-xl px-3 text-[9px] transition active:scale-[0.98] disabled:opacity-25 ${primary ? "bg-[#eeeeee] text-[#111111] hover:bg-white" : danger ? "border border-white/20 bg-white/[0.07] text-white/70" : "border border-white/[0.06] text-white/32 hover:bg-white/[0.035] hover:text-white/62"}`}>{icon}{label}</button>;
}

function DayRhythm({ logs, goals, totals, timezone }: { logs: FoodLogView[]; goals: Readonly<MacroTotals>; totals: MacroTotals; timezone: string }) {
  const calorieLogs = logs.filter((log) => log.calories > 0).toReversed();
  const maxCalories = Math.max(1, ...calorieLogs.map((log) => log.calories));
  return (
    <div className="os-surface rounded-[26px] p-5 md:p-6">
      <div className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-white/35" /><div><p className="text-sm font-medium text-white/68">Ritmo del día</p><p className="mt-1 text-[9px] text-white/24">Distribución calórica por registro</p></div></div>
      {calorieLogs.length > 0 ? (
        <div className="mt-8 flex h-40 items-end gap-2 border-b border-white/[0.055] pb-5">
          {calorieLogs.map((log) => {
            const progress = Math.max(0.06, log.calories / maxCalories);
            return <div key={log.id} className="group relative flex h-full min-w-0 flex-1 items-end"><div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/[0.08] bg-[#0a0a0a] px-2 py-1 text-[8px] text-white/45 group-hover:block">{log.description} · {Math.round(log.calories)} kcal</div><motion.div initial={{ scaleY: 0 }} animate={{ scaleY: progress }} style={{ transformOrigin: "bottom" }} className="h-full w-full rounded-t-md bg-white/20 transition-colors group-hover:bg-white/40" /><span className="absolute -bottom-4 left-0 right-0 text-center font-mono text-[7px] text-white/18">{formatTime(log.date, timezone)}</span></div>;
          })}
        </div>
      ) : <div className="mt-8 flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/[0.06] text-[10px] text-white/22">Sin comidas para graficar</div>}
      <div className="mt-7 space-y-3">
        <RemainingLine label="Calorías" value={`${Math.max(0, Math.round(goals.calories - totals.calories))} kcal`} />
        <RemainingLine label="Proteína" value={`${Math.max(0, Math.round(goals.protein - totals.protein))} g`} />
        <RemainingLine label="Carbohidratos" value={`${Math.max(0, Math.round(goals.carbs - totals.carbs))} g`} />
      </div>
    </div>
  );
}

function RemainingLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-t border-white/[0.045] pt-3 text-[10px]"><span className="text-white/25">{label} pendientes</span><span className="font-mono text-white/48">{value}</span></div>; }

function ConsistencyMatrix({ history, goals, timezone }: { history: History; goals: Readonly<MacroTotals>; timezone: string }) {
  const [range, setRange] = useState<30 | 90 | 365>(90);
  const [selected, setSelected] = useState<string | null>(null);
  const [today] = useState(() => Date.now());
  const days = useMemo(() => Array.from({ length: range }, (_, index) => {
    const date = new Date(today - (range - index - 1) * 86_400_000);
    const key = dateKeyInTimezone(date, timezone);
    return { key, data: history[key] };
  }), [history, range, timezone, today]);
  const tracked = days.filter((day) => day.data);
  const targetDays = tracked.filter((day) => day.data.calories >= goals.calories * 0.9 && day.data.calories <= goals.calories * 1.1).length;
  const proteinDays = tracked.filter((day) => day.data.protein >= goals.protein * 0.9).length;
  const selectedDay = selected ? history[selected] : undefined;

  return (
    <div className="os-surface rounded-[26px] p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-medium text-white/68">Consistencia nutricional</p><p className="mt-1 text-[9px] text-white/24">La meta es registrar bien, no fabricar días perfectos</p></div>
        <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.018] p-1">{([30, 90, 365] as const).map((option) => <button key={option} type="button" onClick={() => { setRange(option); setSelected(null); }} className={`h-8 rounded-lg px-3 font-mono text-[8px] transition active:scale-[0.98] ${range === option ? "bg-white/[0.08] text-white/62" : "text-white/22 hover:text-white/50"}`}>{option === 365 ? "1 año" : `${option} días`}</button>)}</div>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-end">
        <div className="overflow-x-auto pb-2 custom-scrollbar"><div className="grid w-max grid-flow-col grid-rows-7 gap-1.5">{days.map(({ key, data }) => <button key={key} type="button" title={data ? `${key}: ${Math.round(data.calories)} kcal` : `${key}: sin registro`} aria-label={data ? `${key}, ${Math.round(data.calories)} calorías` : `${key}, sin registro`} onClick={() => setSelected(key)} className={`h-3.5 w-3.5 rounded-[3px] border transition hover:scale-110 focus-visible:scale-110 ${heatClass(data, goals)}`} />)}</div></div>
        <div className="grid grid-cols-3 divide-x divide-white/[0.055] rounded-2xl border border-white/[0.055] bg-white/[0.015] py-4">
          <MatrixStat label="Registrados" value={`${tracked.length}/${range}`} />
          <MatrixStat label="En calorías" value={`${targetDays}`} />
          <MatrixStat label="Proteína" value={`${proteinDays}`} />
        </div>
      </div>
      <AnimatePresence mode="wait">
        {selected ? <motion.div key={selected} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 flex flex-col gap-2 border-t border-white/[0.05] pt-4 text-[9px] text-white/28 sm:flex-row sm:items-center sm:justify-between"><span>{selected}</span>{selectedDay ? <span className="font-mono text-white/45">{Math.round(selectedDay.calories)} kcal · {Math.round(selectedDay.protein)}P · {Math.round(selectedDay.carbs)}C · {Math.round(selectedDay.fat)}G</span> : <span>Sin registros ese día</span>}</motion.div> : null}
      </AnimatePresence>
    </div>
  );
}

function MatrixStat({ label, value }: { label: string; value: string }) { return <div className="px-3 text-center"><p className="font-mono text-[7px] uppercase tracking-wider text-white/18">{label}</p><p className="mt-2 text-lg text-white/58">{value}</p></div>; }

function heatClass(data: HistoryDay | undefined, goals: Readonly<MacroTotals>): string {
  if (!data) return "border-white/[0.045] bg-white/[0.018]";
  if (data.calories >= goals.calories * 0.9 && data.calories <= goals.calories * 1.1) return "border-white/55 bg-white/65";
  if (data.calories > goals.calories * 1.1) return "border-white/25 bg-white/35";
  return "border-white/15 bg-white/15";
}

function fallbackItem(log: FoodLogView): FoodAnalysisItem { return { name: log.description, quantity: 1, unit: "porción", calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat }; }

function formatTime(date: string, timezone: string): string { return new Intl.DateTimeFormat("es-MX", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(date)); }

function dateKeyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function groupLogs(logs: FoodLogView[], timezone: string) {
  const groups = new Map<string, FoodLogView[]>();
  for (const log of logs) {
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", hour12: false }).format(new Date(log.date)));
    const label = log.calories === 0 && log.water > 0 ? "Hidratación" : hour < 11 ? "Mañana" : hour < 17 ? "Mediodía" : hour < 21 ? "Tarde" : "Noche";
    const group = groups.get(label) ?? [];
    group.push(log);
    groups.set(label, group);
  }
  const order = ["Mañana", "Mediodía", "Tarde", "Noche", "Hidratación"];
  return order.flatMap((label) => groups.has(label) ? [{ label, logs: groups.get(label)! }] : []);
}
