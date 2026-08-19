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
      tools: [
        {
          name: "add_expense",
          description: "Registra un nuevo gasto financiero en la base de datos.",
          input_schema: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Monto del gasto (positivo)" },
              description: { type: "string", description: "Descripción corta (ej. 'Oxxo', 'Uber')" }
            },
            required: ["amount", "description"]
          }
        }
      ],
      messages: [
        { role: "user", content: message }
      ],
    });

    let responseText = "";
    
    // Check if Claude wants to use a tool
    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find(c => c.type === "tool_use");
      if (toolUse && toolUse.name === "add_expense") {
        const input = toolUse.input as { amount: number, description: string };
        
        try {
          // Dynamic import to avoid circular dependencies if any
          const { addTransaction } = await import("@/actions/finance");
          await addTransaction({
            amount: -Math.abs(input.amount),
            description: input.description,
            type: 'EXPENSE',
            category: 'OTHER',
            date: new Date()
          });
          responseText = `Gasto de $${input.amount} en ${input.description} registrado exitosamente en la base de datos de Prisma.`;
        } catch (e) {
          responseText = `Intenté registrar el gasto de $${input.amount}, pero la base de datos rechazó la conexión.`;
        }
      } else {
        responseText = "He detectado tu intención, pero el protocolo de escritura aún no está enlazado a la base de datos de producción.";
      }
    } else {
      // Normal conversational response
      const textBlock = response.content.find(c => c.type === "text");
      if (textBlock && textBlock.type === "text") {
        responseText = textBlock.text;
      }
    }

    return { success: true, text: responseText };
  } catch (error: any) {
    console.error("Shadow Error:", error);
    return { success: false, text: "ERR_CONNECTION_FAILED: Imposible contactar con la lógica central." };
  }
}
