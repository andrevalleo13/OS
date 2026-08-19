"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export async function logFood(description: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY in environment variables.");
  }

  try {
    const prompt = `
You are an expert nutritionist AI. The user will provide a description of a meal or food they ate.
Your job is to estimate the calories and macronutrients (protein, carbs, fat) as accurately as possible. Si el usuario menciona tomar agua, estima la cantidad en litros.
Además, provee un desglose detallado por ingrediente.
Respond ONLY with a valid JSON object matching the following structure exactly, with no additional text or markdown formatting outside the JSON:

{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "water": number,
  "breakdown": [
    {
      "name": "string (nombre en español)",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number
    }
  ]
}

User input: "${description}"
`;

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const block = response.content[0];
    if (block.type !== "text") {
      throw new Error("Unexpected response from Anthropic");
    }

    const text = block.text.trim();
    // Safely extract JSON if the model added backticks
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    const log = await prisma.foodLog.create({
      data: {
        description,
        calories: parsed.calories,
        protein: parsed.protein || 0,
        carbs: parsed.carbs || 0,
        fat: parsed.fat || 0,
        water: parsed.water || 0,
        breakdown: parsed.breakdown || [],
      },
    });

    revalidatePath("/food");
    return log;
  } catch (error) {
    console.error("Failed to log food:", error);
    throw new Error("Failed to process food description");
  }
}

export async function logWater(amountInLiters: number) {
  try {
    const log = await prisma.foodLog.create({
      data: {
        description: `Agua (${amountInLiters}L)`,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        water: amountInLiters,
      },
    });
    revalidatePath("/food");
    return log;
  } catch (error) {
    console.error("Failed to log water:", error);
    throw new Error("Failed to log water");
  }
}

export async function getDailyMacros() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const logs = await prisma.foodLog.findMany({
    where: {
      date: {
        gte: startOfDay,
      },
    },
    orderBy: {
      date: "desc",
    },
  });

  const totals = logs.reduce(
    (acc: { calories: number; protein: number; carbs: number; fat: number; water: number }, log: any) => {
      acc.calories += log.calories;
      acc.protein += log.protein;
      acc.carbs += log.carbs;
      acc.fat += log.fat;
      acc.water += log.water || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 }
  );

  return { totals, logs };
}

export async function getShadowMacroAdvice(current: any, goal: any) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const prompt = `
Eres Shadow, mi asistente IA personal.
Mis macros actuales hoy: Calorías: ${current.calories}/${goal.calories}, Proteína: ${current.protein}/${goal.protein}g, Carbohidratos: ${current.carbs}/${goal.carbs}g, Grasas: ${current.fat}/${goal.fat}g.
Dame UNA sola frase corta (máximo 20 palabras) sugiriendo qué tipo de comida debería consumir para acercarme a mis macros faltantes sin pasarme. Háblame de tú, directo y al punto, estilo terminal hacker. Responde SÓLO con la frase.
    `;

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    return response.content[0].type === 'text' ? response.content[0].text : null;
  } catch (error) {
    console.error("Shadow Advice Error:", error);
    return null;
  }
}

export async function getMonthlyHistory() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const logs = await prisma.foodLog.findMany({
    where: {
      date: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      date: true,
      calories: true,
    },
    orderBy: {
      date: "asc",
    },
  });

  // Group by day (YYYY-MM-DD)
  const dailyTotals: Record<string, number> = {};
  logs.forEach(log => {
    const day = log.date.toISOString().split('T')[0];
    dailyTotals[day] = (dailyTotals[day] || 0) + log.calories;
  });

  return dailyTotals;
}
