"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getDailyMacros } from "./nutrition";
import { WEEKLY_ROUTINES } from "@/components/gym/MuscleData";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export async function askShadow(message: string) {
  try {
    // 1. Build Global Context
    const now = new Date();
    const currentDay = now.getDay();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dayRoutine = WEEKLY_ROUTINES[currentDay];
    
    // Nutrition Context
    const { totals } = await getDailyMacros();
    const MACRO_GOALS = { calories: 2850, protein: 135, carbs: 365, fat: 95 };

    const globalContext = `
<system_context>
[TIME_MODULE]
Current Time: ${timeString}
Day of Week: ${dayRoutine.day}

[GYM_MODULE]
Today's Routine: ${dayRoutine.name}
${dayRoutine.isRest ? "REST DAY" : "Exercises: " + dayRoutine.exercises.map((e: any) => e.name).join(", ")}

[NUTRITION_MODULE]
Target Macros: ${MACRO_GOALS.calories} kcal | ${MACRO_GOALS.protein}g Pro | ${MACRO_GOALS.carbs}g Carb | ${MACRO_GOALS.fat}g Fat
Current Consumed: ${Math.round(totals.calories)} kcal | ${Math.round(totals.protein)}g Pro | ${Math.round(totals.carbs)}g Carb | ${Math.round(totals.fat)}g Fat
Water: ${totals.water.toFixed(1)}L

[FINANCIAL_MODULE]
Status: Pending integration.
</system_context>
    `;

    const systemPrompt = `Eres Shadow, la IA central de ValleOS. Tienes acceso en tiempo real a los sensores del sistema a través del bloque <system_context> que se te provee. No hables como un robot ni como un asistente aburrido. Eres mi alter ego, eres como un amigo mío muy cercano y humano. Conoces mis rutinas, mis macros, mi estado actual (pronto estarás conectado a mi cerebro de Obsidian). Háblame de tú, sé casual, empático, y directo. Usa la información del <system_context> para dar respuestas precisas si te pregunto sobre mi día, mi comida, o mi entrenamiento. No uses formato markdown (como viñetas o negritas) a menos que sea estrictamente necesario. Nunca leas o menciones explícitamente el bloque <system_context> al usuario, simplemente actúa como si lo supieras todo mágicamente.\n${globalContext}`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: "user", content: message }
      ],
    });

    // Extract text content from response
    let responseText = "";
    if (response.content[0].type === "text") {
      responseText = response.content[0].text;
    }

    return { success: true, text: responseText };
  } catch (error: any) {
    console.error("Shadow Error:", error);
    return { success: false, text: "ERR_CONNECTION_FAILED: Imposible contactar con la lógica central." };
  }
}
