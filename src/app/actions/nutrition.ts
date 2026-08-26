"use server";

import Anthropic from "@anthropic-ai/sdk";
import { formatInTimeZone } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { WEEKLY_ROUTINES } from "@/components/gym/MuscleData";
import { biometricReadiness } from "@/features/biometrics/biometrics.service";
import {
  NUTRITION_GOALS,
  normalizeStoredBreakdown,
  sumNutritionItems,
  type FoodAnalysisDraft,
  type FoodAnalysisItem,
  type FoodLogView,
  type MacroTotals,
  type ShadowNutritionInsight,
} from "@/features/nutrition/nutrition";
import { serverConfig } from "@/lib/config";
import { dateKey, dayRange } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({ apiKey: serverConfig.anthropic.apiKey });

const descriptionSchema = z.string().trim().min(1).max(2_000);
const nutrientSchema = z.number().finite().min(0).max(20_000);
const itemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().finite().positive().max(10_000),
  unit: z.string().trim().min(1).max(40),
  calories: nutrientSchema,
  protein: nutrientSchema,
  carbs: nutrientSchema,
  fat: nutrientSchema,
});
const analysisResponseSchema = z.object({
  normalizedDescription: z.string().trim().min(1).max(500),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "drink"]),
  confidence: z.number().finite().min(0).max(1),
  assumptions: z.array(z.string().trim().min(1).max(250)).max(8),
  clarificationQuestion: z.string().trim().min(1).max(250).nullable(),
  water: z.number().finite().min(0).max(20),
  breakdown: z.array(itemSchema).min(1).max(50),
});
const draftSchema = z.object({
  description: descriptionSchema,
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "drink"]),
  confidence: z.number().finite().min(0).max(1),
  assumptions: z.array(z.string().trim().min(1).max(250)).max(8),
  clarificationQuestion: z.string().trim().min(1).max(250).nullable(),
  water: z.number().finite().min(0).max(20),
  items: z.array(itemSchema).min(1).max(50),
  totals: z.object({
    calories: nutrientSchema,
    protein: nutrientSchema,
    carbs: nutrientSchema,
    fat: nutrientSchema,
    water: z.number().finite().min(0).max(20),
  }),
});
const idSchema = z.string().uuid();

function extractJsonObject(text: string): unknown {
  const startIndex = text.indexOf("{");
  const endIndex = text.lastIndexOf("}");
  if (startIndex === -1 || endIndex < startIndex) {
    throw new Error("Shadow no devolvió un análisis estructurado.");
  }
  return JSON.parse(text.slice(startIndex, endIndex + 1));
}

function serializeFoodLog(log: {
  id: string;
  date: Date;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
  breakdown: unknown;
}): FoodLogView {
  return {
    id: log.id,
    date: log.date.toISOString(),
    description: log.description,
    calories: log.calories,
    protein: log.protein,
    carbs: log.carbs,
    fat: log.fat,
    water: log.water,
    breakdown: normalizeStoredBreakdown(log.breakdown),
  };
}

function revalidateNutrition() {
  revalidatePath("/food");
  revalidatePath("/");
}

async function createFoodLog(draft: FoodAnalysisDraft): Promise<FoodLogView> {
  const totals = sumNutritionItems(draft.items, draft.water);
  const log = await prisma.foodLog.create({
    data: {
      description: draft.description,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      water: totals.water,
      breakdown: draft.items,
    },
  });
  revalidateNutrition();
  return serializeFoodLog(log);
}

export async function analyzeFood(description: string): Promise<FoodAnalysisDraft> {
  const safeDescription = descriptionSchema.parse(description);
  if (!serverConfig.anthropic.apiKey) {
    throw new Error("ANTHROPIC_API_KEY no está configurada.");
  }

  try {
    const prompt = `
Eres Shadow, un analista nutricional preciso. Analiza únicamente la comida que el usuario afirma haber consumido.
Estima calorías, proteína, carbohidratos y grasa por ingrediente. Si menciona agua, registra litros en water.

Reglas:
- Devuelve macros TOTALES por cada renglón, considerando quantity.
- quantity siempre debe ser numérico y unit una unidad breve en español.
- Expón tus supuestos importantes en assumptions.
- confidence indica qué tan confiable es la estimación entre 0 y 1.
- Si falta una cantidad que cambiaría mucho el cálculo, escribe UNA pregunta concreta en clarificationQuestion; de lo contrario usa null.
- No inventes suplementos ni ingredientes no mencionados, salvo preparaciones inevitables y decláralas como supuesto.
- Responde sólo JSON válido, sin markdown.

Estructura exacta:
{
  "normalizedDescription": "descripción breve en español",
  "mealType": "breakfast | lunch | dinner | snack | drink",
  "confidence": 0.0,
  "assumptions": ["supuesto"],
  "clarificationQuestion": null,
  "water": 0,
  "breakdown": [
    {
      "name": "ingrediente",
      "quantity": 1,
      "unit": "porción",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0
    }
  ]
}

Entrada del usuario: ${JSON.stringify(safeDescription)}
`;

    const response = await anthropic.messages.create({
      model: serverConfig.anthropic.model,
      max_tokens: 1_200,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });
    const block = response.content.find((content) => content.type === "text");
    if (!block || block.type !== "text") throw new Error("Shadow no devolvió texto.");
    const parsed = analysisResponseSchema.parse(extractJsonObject(block.text));
    const items: FoodAnalysisItem[] = parsed.breakdown;

    return {
      description: safeDescription,
      mealType: parsed.mealType,
      confidence: parsed.confidence,
      assumptions: parsed.assumptions,
      clarificationQuestion: parsed.clarificationQuestion,
      water: parsed.water,
      items,
      totals: sumNutritionItems(items, parsed.water),
    };
  } catch (error) {
    console.error("Failed to analyze food:", error);
    throw new Error(`No pude analizar la comida: ${errorMessage(error)}`);
  }
}

export async function confirmFoodLog(input: FoodAnalysisDraft): Promise<FoodLogView> {
  const parsed = draftSchema.parse(input);
  return createFoodLog(parsed);
}

export async function logFood(description: string): Promise<FoodLogView> {
  const draft = await analyzeFood(description);
  return createFoodLog(draft);
}

export async function updateFoodLog(input: {
  id: string;
  description: string;
  items: FoodAnalysisItem[];
  water: number;
}): Promise<FoodLogView> {
  const parsed = z.object({
    id: idSchema,
    description: descriptionSchema,
    items: z.array(itemSchema).min(1).max(50),
    water: z.number().finite().min(0).max(20),
  }).parse(input);
  const totals = sumNutritionItems(parsed.items, parsed.water);
  const log = await prisma.foodLog.update({
    where: { id: parsed.id },
    data: {
      description: parsed.description,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      water: totals.water,
      breakdown: parsed.items,
    },
  });
  revalidateNutrition();
  return serializeFoodLog(log);
}

export async function deleteFoodLog(id: string): Promise<{ id: string }> {
  const safeId = idSchema.parse(id);
  await prisma.foodLog.delete({ where: { id: safeId } });
  revalidateNutrition();
  return { id: safeId };
}

export async function duplicateFoodLog(id: string): Promise<FoodLogView> {
  const safeId = idSchema.parse(id);
  const source = await prisma.foodLog.findUniqueOrThrow({ where: { id: safeId } });
  const log = await prisma.foodLog.create({
    data: {
      description: source.description,
      calories: source.calories,
      protein: source.protein,
      carbs: source.carbs,
      fat: source.fat,
      water: source.water,
      breakdown: source.breakdown ?? undefined,
    },
  });
  revalidateNutrition();
  return serializeFoodLog(log);
}

export async function logWater(amountInLiters: number): Promise<FoodLogView> {
  const safeAmount = z.number().finite().positive().max(20).parse(amountInLiters);
  const log = await prisma.foodLog.create({
    data: {
      description: `Agua (${safeAmount}L)`,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      water: safeAmount,
      breakdown: [{ name: "Agua", quantity: safeAmount, unit: "L", calories: 0, protein: 0, carbs: 0, fat: 0 }],
    },
  });
  revalidateNutrition();
  return serializeFoodLog(log);
}

export async function getDailyMacros(): Promise<{ totals: MacroTotals; logs: Awaited<ReturnType<typeof prisma.foodLog.findMany>> }> {
  const { start, end } = dayRange(new Date(), serverConfig.timezone);
  const logs = await prisma.foodLog.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "desc" },
  });
  const totals = logs.reduce<MacroTotals>((result, log) => ({
    calories: result.calories + log.calories,
    protein: result.protein + log.protein,
    carbs: result.carbs + log.carbs,
    fat: result.fat + log.fat,
    water: result.water + log.water,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 });
  return { totals, logs };
}

function remainingMacros(current: MacroTotals) {
  return {
    remainingCalories: Math.max(0, NUTRITION_GOALS.calories - current.calories),
    remainingProtein: Math.max(0, NUTRITION_GOALS.protein - current.protein),
    remainingCarbs: Math.max(0, NUTRITION_GOALS.carbs - current.carbs),
    remainingFat: Math.max(0, NUTRITION_GOALS.fat - current.fat),
  };
}

function fallbackAdvice(current: MacroTotals, trainingLabel: string, readiness: number): string {
  const remaining = remainingMacros(current);
  if (remaining.remainingProtein <= 10 && remaining.remainingCalories <= 250) {
    return "Objetivo prácticamente cubierto. Cierra ligero, hidrátate y protege el sueño de esta noche.";
  }
  if (readiness < 60) {
    return `Recuperación baja: prioriza ${Math.round(remaining.remainingProtein)} g de proteína pendientes, carbohidratos fáciles y agua antes de añadir más intensidad.`;
  }
  return `${trainingLabel}: te faltan ${Math.round(remaining.remainingProtein)} g de proteína y ${Math.round(remaining.remainingCalories)} kcal. Construye la siguiente comida alrededor de eso.`;
}

export async function getShadowMacroAdvice(): Promise<ShadowNutritionInsight> {
  const now = new Date();
  const today = dayRange(now, serverConfig.timezone);
  const weekday = Number(formatInTimeZone(now, serverConfig.timezone, "i")) % 7;
  const routine = WEEKLY_ROUTINES[weekday];
  const biometricCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1_000);
  const [nutrition, workout, biometric] = await Promise.all([
    getDailyMacros(),
    prisma.workoutSession.findFirst({
      where: { date: { gte: today.start, lte: today.end } },
      orderBy: { date: "desc" },
      include: { exercises: { select: { name: true, muscleId: true, sets: true } } },
    }),
    prisma.biometricLog.findFirst({ where: { date: { gte: biometricCutoff } }, orderBy: { date: "desc" } }),
  ]);
  const remaining = remainingMacros(nutrition.totals);
  const readiness = biometricReadiness({
    sleep: biometric?.sleep ?? null,
    hrv: biometric?.hrv ?? null,
    steps: biometric?.steps ?? null,
  });

  const training = workout
    ? {
        state: "completed" as const,
        label: workout.title,
        detail: `${workout.duration} min · ${Math.round(workout.volume).toLocaleString("es-MX")} kg de volumen`,
      }
    : routine.isRest
      ? { state: "rest" as const, label: "Día de recuperación", detail: "No hay entrenamiento programado hoy" }
      : { state: "planned" as const, label: routine.name, detail: "Rutina programada; todavía no aparece como completada" };

  const recovery = {
    readiness,
    label: readiness >= 75 ? "Recuperación sólida" : readiness >= 60 ? "Recuperación media" : "Recuperación comprometida",
    detail: biometric
      ? `${biometric.sleep ?? "—"} h sueño · HRV ${biometric.hrv ?? "—"} · ${(biometric.steps ?? 0).toLocaleString("es-MX")} pasos`
      : "Sin lectura biométrica reciente",
  };
  let message = fallbackAdvice(nutrition.totals, training.label, readiness);

  if (serverConfig.anthropic.apiKey) {
    try {
      const prompt = `
Eres Shadow, coach nutricional directo. Usa sólo estos datos reales y distingue entrenamiento completado de programado.
Nutrición restante: ${Math.round(remaining.remainingCalories)} kcal; ${Math.round(remaining.remainingProtein)}g proteína; ${Math.round(remaining.remainingCarbs)}g carbohidratos; ${Math.round(remaining.remainingFat)}g grasa.
Entrenamiento: ${training.state}; ${training.label}; ${training.detail}.
Recuperación: ${recovery.label}; readiness ${readiness}/100; ${recovery.detail}.
Da una recomendación accionable de máximo 32 palabras, en español, sin emojis y sin afirmar diagnósticos médicos. Responde sólo la recomendación.
`;
      const response = await anthropic.messages.create({
        model: serverConfig.anthropic.model,
        max_tokens: 120,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.35,
      });
      const block = response.content.find((content) => content.type === "text");
      if (block?.type === "text" && block.text.trim()) message = block.text.trim();
    } catch (error) {
      console.error("Shadow nutrition advice failed:", error);
    }
  }

  return { message, nutrition: remaining, training, recovery };
}

export async function getConsistencyHistory() {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - 365);
  const logs = await prisma.foodLog.findMany({
    where: { date: { gte: daysAgo } },
    select: { date: true, calories: true, protein: true, carbs: true, fat: true },
    orderBy: { date: "asc" },
  });
  const dailyTotals: Record<string, Omit<MacroTotals, "water">> = {};
  for (const log of logs) {
    const day = dateKey(log.date, serverConfig.timezone);
    dailyTotals[day] ??= { calories: 0, protein: 0, carbs: 0, fat: 0 };
    dailyTotals[day].calories += log.calories;
    dailyTotals[day].protein += log.protein;
    dailyTotals[day].carbs += log.carbs;
    dailyTotals[day].fat += log.fat;
  }
  return dailyTotals;
}
