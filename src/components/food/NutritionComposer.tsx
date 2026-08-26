"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Check,
  CircleHelp,
  Loader2,
  Plus,
  RotateCcw,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { analyzeFood, confirmFoodLog } from "@/app/actions/nutrition";
import ShadowOrb from "@/components/ShadowOrb";
import {
  sumNutritionItems,
  withDraftItems,
  type FoodAnalysisDraft,
  type FoodAnalysisItem,
} from "@/features/nutrition/nutrition";

const EMPTY_ITEM: FoodAnalysisItem = {
  name: "Ingrediente",
  quantity: 1,
  unit: "porción",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

export default function NutritionComposer() {
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<FoodAnalysisDraft | null>(null);
  const [clarification, setClarification] = useState("");
  const [message, setMessage] = useState("Describe una comida y Shadow preparará el desglose antes de guardarlo.");
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, startAnalysis] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const runAnalysis = (description: string) => {
    const normalized = description.trim();
    if (!normalized) return;
    setError(null);
    setMessage("Separando ingredientes, porciones y macros…");
    startAnalysis(async () => {
      try {
        const result = await analyzeFood(normalized);
        setDraft(result);
        setInput(normalized);
        setClarification("");
        setMessage("Análisis listo. Revisa los supuestos antes de registrarlo.");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No pude analizar esa comida.");
        setMessage("El análisis no se guardó. Puedes corregir el texto e intentarlo otra vez.");
      }
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    runAnalysis(input);
  };

  const confirm = () => {
    if (!draft) return;
    setError(null);
    setMessage("Guardando el registro confirmado…");
    startSaving(async () => {
      try {
        await confirmFoodLog(draft);
        setDraft(null);
        setInput("");
        setClarification("");
        setMessage("Comida registrada. Los totales de hoy ya fueron actualizados.");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No pude guardar la comida.");
        setMessage("El borrador sigue intacto para que puedas reintentar.");
      }
    });
  };

  const reanalyzeWithClarification = () => {
    if (!draft || !clarification.trim()) return;
    runAnalysis(`${draft.description}. Aclaración del usuario: ${clarification.trim()}`);
  };

  return (
    <section aria-labelledby="nutrition-composer-label" className="relative">
      <div className="pointer-events-none absolute inset-x-6 top-5 h-24 rounded-[30px] bg-white/[0.025] blur-2xl" />
      <form onSubmit={submit} className="os-surface relative rounded-[28px] p-3 md:p-4">
        <label id="nutrition-composer-label" htmlFor="food-description" className="sr-only">
          Describe lo que comiste
        </label>
        <div className="grid grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-2 md:grid-cols-[54px_minmax(0,1fr)_auto] md:gap-3">
          <div className="h-11 w-11 md:h-13 md:w-13">
            <ShadowOrb status={isAnalyzing ? "thinking" : "idle"} hideBackground />
          </div>
          <div className="min-w-0">
            <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/25">Shadow · Registro inteligente</p>
            <input
              id="food-description"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isAnalyzing || isSaving}
              autoComplete="off"
              placeholder="Comí 3 huevos, tortillas, aguacate y café con leche…"
              className="h-9 w-full border-0 bg-transparent text-sm text-white/80 outline-none placeholder:text-white/18 md:text-[15px]"
            />
          </div>
          <button
            type="submit"
            disabled={isAnalyzing || isSaving || !input.trim()}
            className="flex h-11 items-center gap-2 rounded-2xl bg-[#eeeeee] px-3 text-xs font-medium text-[#111111] transition hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-25 md:px-5"
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            <span className="hidden sm:inline">{draft ? "Reanalizar" : "Analizar"}</span>
          </button>
        </div>
        <div className="mt-3 flex min-h-5 items-center justify-between gap-3 border-t border-white/[0.055] px-1 pt-3">
          <p aria-live="polite" className={`text-[10px] ${error ? "text-white/65" : "text-white/28"}`}>
            {error ?? message}
          </p>
          {draft ? (
            <button
              type="button"
              onClick={() => { setDraft(null); setError(null); setMessage("Borrador descartado. Nada fue guardado."); }}
              className="shrink-0 text-[9px] text-white/25 transition hover:text-white/60 active:scale-[0.98]"
            >
              Descartar
            </button>
          ) : null}
        </div>
      </form>

      <AnimatePresence mode="wait">
        {isAnalyzing ? <AnalysisSkeleton key="analysis-skeleton" /> : null}
        {!isAnalyzing && draft ? (
          <FoodAnalysisDraftPanel
            key="analysis-draft"
            draft={draft}
            clarification={clarification}
            isSaving={isSaving}
            onChange={setDraft}
            onClarificationChange={setClarification}
            onReanalyze={reanalyzeWithClarification}
            onConfirm={confirm}
            onCancel={() => { setDraft(null); setMessage("Borrador descartado. Nada fue guardado."); }}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function AnalysisSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      role="status"
      aria-label="Shadow está analizando la comida"
      className="mx-3 rounded-b-[24px] border border-t-0 border-white/[0.06] bg-[#0c0c0c]/92 p-5 md:mx-6"
    >
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-white/55" />
        <div className="h-2 w-36 animate-pulse rounded-full bg-white/[0.08]" />
      </div>
      <div className="mt-5 grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-white/[0.035]" />)}
      </div>
    </motion.div>
  );
}

function FoodAnalysisDraftPanel({
  draft,
  clarification,
  isSaving,
  onChange,
  onClarificationChange,
  onReanalyze,
  onConfirm,
  onCancel,
}: {
  draft: FoodAnalysisDraft;
  clarification: string;
  isSaving: boolean;
  onChange: (draft: FoodAnalysisDraft) => void;
  onClarificationChange: (value: string) => void;
  onReanalyze: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const updateItem = (index: number, field: keyof FoodAnalysisItem, rawValue: string) => {
    const items = draft.items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (field === "name" || field === "unit") return { ...item, [field]: rawValue };
      const value = Math.max(0, Number(rawValue) || 0);
      if (field === "quantity") {
        const ratio = item.quantity > 0 ? value / item.quantity : 1;
        return {
          ...item,
          quantity: Math.max(0.01, value),
          calories: Math.round(item.calories * ratio),
          protein: Math.round(item.protein * ratio * 10) / 10,
          carbs: Math.round(item.carbs * ratio * 10) / 10,
          fat: Math.round(item.fat * ratio * 10) / 10,
        };
      }
      return { ...item, [field]: value };
    });
    onChange(withDraftItems(draft, items));
  };

  const removeItem = (index: number) => {
    if (draft.items.length <= 1) return;
    onChange(withDraftItems(draft, draft.items.filter((_, itemIndex) => itemIndex !== index)));
  };

  const updateWater = (value: string) => {
    const water = Math.max(0, Number(value) || 0);
    onChange({ ...draft, water, totals: sumNutritionItems(draft.items, water) });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="mx-2 rounded-b-[26px] border border-t-0 border-white/[0.07] bg-[#0c0c0c]/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:mx-6 md:p-6"
    >
      <div className="flex flex-col gap-4 border-b border-white/[0.055] pb-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ScanLine className="h-3.5 w-3.5 text-white/40" />
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/32">Borrador de Shadow</p>
            <span className="rounded-full border border-white/[0.07] px-2 py-0.5 font-mono text-[8px] text-white/30">
              {Math.round(draft.confidence * 100)}% confianza
            </span>
          </div>
          <input
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            aria-label="Descripción de la comida"
            className="mt-3 w-full border-0 bg-transparent text-base font-medium text-white/78 outline-none"
          />
        </div>
        <div className="grid shrink-0 grid-cols-4 divide-x divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-white/[0.018] px-2 py-3">
          <DraftTotal label="Kcal" value={Math.round(draft.totals.calories)} />
          <DraftTotal label="Pro" value={`${draft.totals.protein}g`} />
          <DraftTotal label="Carb" value={`${draft.totals.carbs}g`} />
          <DraftTotal label="Grasa" value={`${draft.totals.fat}g`} />
        </div>
      </div>

      {draft.clarificationQuestion ? (
        <div className="mt-5 rounded-2xl border border-white/[0.075] bg-white/[0.025] p-4">
          <div className="flex items-start gap-3">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/60">{draft.clarificationQuestion}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={clarification}
                  onChange={(event) => onClarificationChange(event.target.value)}
                  placeholder="Escribe la cantidad o preparación…"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.07] bg-[#090909] px-3 text-xs text-white/70 outline-none placeholder:text-white/18"
                />
                <button
                  type="button"
                  onClick={onReanalyze}
                  disabled={!clarification.trim()}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-[10px] text-white/50 transition hover:bg-white/[0.04] hover:text-white/75 active:scale-[0.98] disabled:opacity-25"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Refinar análisis
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto custom-scrollbar">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[minmax(170px,1.4fr)_72px_100px_repeat(4,76px)_34px] gap-2 px-2 pb-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/20">
            <span>Ingrediente</span><span>Cant.</span><span>Unidad</span><span>Kcal</span><span>Pro</span><span>Carb</span><span>Grasa</span><span />
          </div>
          <div className="divide-y divide-white/[0.05] border-y border-white/[0.055]">
            {draft.items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="grid grid-cols-[minmax(170px,1.4fr)_72px_100px_repeat(4,76px)_34px] items-center gap-2 px-2 py-2.5">
                <DraftInput value={item.name} label={`Ingrediente ${index + 1}`} onChange={(value) => updateItem(index, "name", value)} />
                <DraftInput type="number" value={item.quantity} label={`Cantidad de ${item.name}`} onChange={(value) => updateItem(index, "quantity", value)} />
                <DraftInput value={item.unit} label={`Unidad de ${item.name}`} onChange={(value) => updateItem(index, "unit", value)} />
                <DraftInput type="number" value={item.calories} label={`Calorías de ${item.name}`} onChange={(value) => updateItem(index, "calories", value)} />
                <DraftInput type="number" value={item.protein} label={`Proteína de ${item.name}`} onChange={(value) => updateItem(index, "protein", value)} />
                <DraftInput type="number" value={item.carbs} label={`Carbohidratos de ${item.name}`} onChange={(value) => updateItem(index, "carbs", value)} />
                <DraftInput type="number" value={item.fat} label={`Grasa de ${item.name}`} onChange={(value) => updateItem(index, "fat", value)} />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={draft.items.length <= 1}
                  aria-label={`Eliminar ${item.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 transition hover:bg-white/[0.045] hover:text-white/55 active:scale-[0.98] disabled:opacity-10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onChange(withDraftItems(draft, [...draft.items, { ...EMPTY_ITEM }]))}
            className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] px-3 text-[9px] text-white/35 transition hover:bg-white/[0.035] hover:text-white/65 active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar ingrediente
          </button>
          <label className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] px-3 text-[9px] text-white/35">
            Agua
            <input
              type="number"
              min="0"
              step="0.05"
              value={draft.water}
              onChange={(event) => updateWater(event.target.value)}
              aria-label="Agua en litros"
              className="w-12 bg-transparent text-right font-mono text-white/60 outline-none"
            />
            L
          </label>
        </div>
        {draft.assumptions.length > 0 ? (
          <p className="max-w-xl text-[9px] leading-relaxed text-white/25">Supuestos: {draft.assumptions.join(" · ")}</p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-white/[0.055] pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs text-white/35 transition hover:bg-white/[0.035] hover:text-white/65 active:scale-[0.98]"
        >
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSaving || !draft.description.trim()}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#eeeeee] px-5 text-xs font-medium text-[#111111] transition hover:bg-white active:scale-[0.98] disabled:opacity-30"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isSaving ? "Registrando…" : "Confirmar y registrar"}
        </button>
      </div>
    </motion.div>
  );
}

function DraftTotal({ label, value }: { label: string; value: string | number }) {
  return <div className="px-3 text-center"><p className="font-mono text-[7px] uppercase tracking-wider text-white/20">{label}</p><p className="mt-1 text-xs text-white/65">{value}</p></div>;
}

function DraftInput({ value, label, type = "text", onChange }: { value: string | number; label: string; type?: "text" | "number"; onChange: (value: string) => void }) {
  return (
    <input
      type={type}
      min={type === "number" ? 0 : undefined}
      step={type === "number" ? 0.1 : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      className="h-8 min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-[11px] text-white/52 outline-none transition hover:border-white/[0.06] hover:bg-white/[0.02] focus:border-white/[0.12] focus:bg-white/[0.025]"
    />
  );
}
