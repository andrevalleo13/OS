import { z } from "zod";

export const shadowDomainSchema = z.enum([
  "nutrition",
  "fitness",
  "finance",
  "university",
  "calendar",
]);

export type ShadowDomain = z.infer<typeof shadowDomainSchema>;
export type ShadowIntent = "general" | "personal" | "operational" | "planning" | "action";

export type ShadowContextRoute = {
  intent: ShadowIntent;
  domains: ShadowDomain[];
  needsObsidian: boolean;
  needsDirectives: boolean;
  personalQuery?: string;
};

function normalized(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const domainPatterns: Array<[ShadowDomain, RegExp]> = [
  ["nutrition", /\b(comida|comi|comer|desayun|almuerz|cen|caloria|macro|proteina|carbo|grasa|agua|nutricion)\w*/],
  ["fitness", /\b(gym|entren|ejercicio|rutina|peso|musculo|pierna|pecho|espalda|cardio|sue[nñ]o|hrv|pasos)\w*/],
  ["finance", /\b(gasto|gaste|ingreso|dinero|finanza|presupuesto|pago|cobro|factur|mrr|venta|transaccion)\w*/],
  ["university", /\b(universidad|up|clase|materia|curso|tarea|examen|parcial|profesor|calificacion|entrega)\w*/],
  ["calendar", /\b(agenda|calendario|evento|cita|reunion|hoy|ma[nñ]ana|semana|horario|bloque)\w*/],
];

const actionPattern = /\b(agrega|anota|registra|crea|programa|agenda|mueve|manda|envia|escribe|guarda|actualiza|borra|elimina)\w*/;
const planningPattern = /\b(plan|planea|prioridad|prioriza|organiza|objetivo|meta|estrategia|decidir|decision|enfocar|foco)\w*/;
const personalPattern = /\b(mi|mis|mio|mia|recuerd|conoces|sabes de mi|quien es|persona|amigo|amiga|familia|mama|papa|hermano|novia|gusto|prefiero|odio|quiero|suelo|siempre|nunca|obsidian|nota|proyecto)\w*/;
const directivePattern = /\b(corrige|no me digas|habla|tono|prefiero|prioridad|objetivo|meta|foco|como soy|mi forma)\w*/;

export function routeShadowContext(message: string): ShadowContextRoute {
  const text = normalized(message);
  const domains = domainPatterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([domain]) => domain);
  const needsObsidian = personalPattern.test(text);
  const needsDirectives = needsObsidian && (directivePattern.test(text) || planningPattern.test(text));

  let intent: ShadowIntent = "general";
  if (actionPattern.test(text)) intent = "action";
  else if (planningPattern.test(text)) intent = "planning";
  else if (needsObsidian) intent = "personal";
  else if (domains.length > 0) intent = "operational";

  return {
    intent,
    domains,
    needsObsidian,
    needsDirectives,
    personalQuery: needsObsidian ? message.trim().slice(0, 200) : undefined,
  };
}
