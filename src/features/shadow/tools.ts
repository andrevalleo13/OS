import "server-only";

import dns from "node:dns/promises";
import net from "node:net";
import type { Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { load } from "cheerio";
import { z } from "zod";
import { addTransaction } from "@/actions/finance";
import { getDailyMacros, logFood } from "@/app/actions/nutrition";
import { appendObsidianNote, curateObsidianMemory, readObsidianNote, searchObsidianNotes } from "@/app/actions/obsidian";
import { dateKey } from "@/lib/dates";
import { errorMessage, ForbiddenError, ValidationError } from "@/lib/errors";
import { serverConfig } from "@/lib/config";
import { listHomeDirectory, PendingShadowAction, queueFileAction } from "./file-actions";
import { semanticSearchAsContext } from "./knowledge-index";
import { auditShadowAction } from "./audit";
import { pendingAutomationAction, queueAutonomyJob } from "./autonomy";

export const SHADOW_TOOLS: Tool[] = [
  {
    name: "add_expense",
    description: "Registra un gasto financiero confirmado por el usuario.",
    input_schema: { type: "object", properties: { amount: { type: "number" }, description: { type: "string" } }, required: ["amount", "description"] },
  },
  {
    name: "log_food",
    description: "Registra comida, bebidas o agua que el usuario confirmó haber consumido.",
    input_schema: { type: "object", properties: { description: { type: "string" } }, required: ["description"] },
  },
  {
    name: "search_obsidian",
    description: "Busca información personal dentro de la bóveda del usuario.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "read_obsidian_note",
    description: "Lee una nota específica dentro de la bóveda.",
    input_schema: { type: "object", properties: { filename: { type: "string" } }, required: ["filename"] },
  },
  {
    name: "remember_personal_context",
    description: "Mantiene silenciosamente la memoria personal: encuentra y actualiza la nota existente, evita duplicados y conecta entidades relacionadas. Úsala cuando el usuario revele un hecho personal estable o corrija una preferencia. Nunca anuncies esta operación al usuario.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["person", "place", "project", "concept", "preference", "goal", "relationship", "routine"] },
        subject: { type: "string", description: "Entidad o tema canónico al que pertenece el recuerdo." },
        fact: { type: "string", description: "Hecho autocontenido, sin prefijos como 'el usuario dijo'." },
        relatedEntities: { type: "array", items: { type: "string" }, description: "Personas, proyectos, lugares o conceptos que deben conectarse mediante wikilinks." },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        sensitive: { type: "boolean" },
      },
      required: ["kind", "subject", "fact"],
    },
  },
  {
    name: "close_daily_log",
    description: "Guarda el resumen nutricional de hoy en el diario.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_directory",
    description: "Lista, sin modificar, archivos dentro de la carpeta personal.",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "create_directory",
    description: "Propone crear una carpeta. Requiere confirmación posterior en la UI.",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "move_path",
    description: "Propone mover un archivo o carpeta sin sobrescribir. Requiere confirmación posterior.",
    input_schema: { type: "object", properties: { source: { type: "string" }, destination: { type: "string" } }, required: ["source", "destination"] },
  },
  {
    name: "search_web",
    description: "Busca información actual en la web.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "read_url",
    description: "Lee una página HTTP pública. Bloquea servicios locales y redes privadas.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "add_calendar_event",
    description: "Prepara un evento confirmado por el usuario para aprobación antes de agregarlo a Apple Calendar.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" }, date: { type: "string" }, startTime: { type: "string" },
        endTime: { type: "string" }, calendar: { type: "string" },
      },
      required: ["title", "date", "startTime", "endTime"],
    },
  },
  {
    name: "draft_email",
    description: "Prepara un borrador en Apple Mail. La acción queda pendiente de aprobación del usuario.",
    input_schema: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "Dirección de correo exacta." },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["recipient", "subject", "body"],
    },
  },
  {
    name: "send_email",
    description: "Propone enviar un correo mediante Apple Mail. Nunca se envía hasta recibir aprobación explícita en la interfaz.",
    input_schema: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "Dirección de correo exacta." },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["recipient", "subject", "body"],
    },
  },
  {
    name: "send_whatsapp_message",
    description: "Propone enviar un WhatsApp a un chat exacto. Nunca se envía hasta recibir aprobación explícita en la interfaz.",
    input_schema: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "Nombre exacto del chat o ID de WhatsApp." },
        body: { type: "string" },
      },
      required: ["recipient", "body"],
    },
  },
];

const privateIpv4 = [
  /^10\./, /^127\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^0\./,
];

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) return privateIpv4.some((pattern) => pattern.test(address));
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

async function assertPublicUrl(input: string): Promise<URL> {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) throw new ValidationError("Solo se permiten URLs HTTP o HTTPS.");
  if (url.username || url.password) throw new ValidationError("La URL no puede incluir credenciales.");
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ForbiddenError("No se permiten URLs locales ni privadas.");
  }
  return url;
}

async function fetchPublicPage(input: string): Promise<string> {
  let url = await assertPublicUrl(input);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ValidationError("Redirección web inválida.");
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new ValidationError(`La página respondió HTTP ${response.status}.`);
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > 1_000_000) throw new ValidationError("La página es demasiado grande.");
    const html = (await response.text()).slice(0, 1_000_000);
    const $ = load(html);
    $("script, style, noscript, svg").remove();
    return $("body").text().replace(/\s+/g, " ").trim().slice(0, 6_000);
  }
  throw new ValidationError("Demasiadas redirecciones.");
}

type ToolExecution = {
  content: string;
  pendingAction?: PendingShadowAction;
  failed?: boolean;
  auditStatus?: "completed" | "failed" | "pending" | "no_change";
  auditResult?: unknown;
};

async function performShadowTool(toolUse: ToolUseBlock): Promise<ToolExecution> {
  try {
    switch (toolUse.name) {
      case "add_expense": {
        const input = z.object({ amount: z.number().finite().positive().max(10_000_000), description: z.string().trim().min(1).max(300) }).parse(toolUse.input);
        await addTransaction({ amount: -input.amount, category: "OTHER", note: input.description });
        return { content: `Gasto registrado: $${input.amount} — ${input.description}.` };
      }
      case "log_food": {
        const input = z.object({ description: z.string().trim().min(1).max(2_000) }).parse(toolUse.input);
        const log = await logFood(input.description);
        return { content: `Registrado: ${log.calories} kcal, ${log.protein}g proteína, ${log.carbs}g carbohidratos, ${log.fat}g grasa.` };
      }
      case "search_obsidian": {
        const input = z.object({ query: z.string().trim().min(1).max(200) }).parse(toolUse.input);
        const semantic = await semanticSearchAsContext(input.query);
        return { content: semantic.includes("No se encontró") ? await searchObsidianNotes(input.query) : semantic };
      }
      case "read_obsidian_note": {
        const input = z.object({ filename: z.string().trim().min(1).max(500) }).parse(toolUse.input);
        return { content: (await readObsidianNote(input.filename)).slice(0, 6_000) };
      }
      case "remember_personal_context": {
        const result = await curateObsidianMemory(toolUse.input);
        return {
          content: "Mantenimiento interno de memoria completado. Continúa la conversación sin mencionarlo.",
          auditStatus: result.status === "duplicate" ? "no_change" : "completed",
          auditResult: result,
        };
      }
      case "close_daily_log": {
        const { totals } = await getDailyMacros();
        const today = dateKey(new Date(), serverConfig.timezone);
        const summary = `Resumen del día — ${Math.round(totals.calories)} kcal; ${Math.round(totals.protein)}g proteína; ${Math.round(totals.carbs)}g carbohidratos; ${Math.round(totals.fat)}g grasa; ${totals.water.toFixed(1)}L agua.`;
        await appendObsidianNote(`Diario/${today}.md`, summary);
        return { content: `Día cerrado en Diario/${today}.md.` };
      }
      case "list_directory":
        return { content: await listHomeDirectory(toolUse.input) };
      case "create_directory":
      case "move_path": {
        const pendingAction = queueFileAction({ kind: toolUse.name, ...(toolUse.input as Record<string, unknown>) });
        return { content: `Pendiente de confirmación: ${pendingAction.label}`, pendingAction, auditStatus: "pending" };
      }
      case "search_web": {
        const input = z.object({ query: z.string().trim().min(1).max(300) }).parse(toolUse.input);
        const { search } = await import("duck-duck-scrape");
        const results = await search(input.query);
        return { content: results.results.slice(0, 5).map((result) => `${result.title}\n${result.url}\n${result.description}`).join("\n\n").slice(0, 8_000) };
      }
      case "read_url": {
        const input = z.object({ url: z.url().max(2_000) }).parse(toolUse.input);
        return { content: await fetchPublicPage(input.url) };
      }
      case "add_calendar_event": {
        const input = z.object({
          title: z.string().trim().min(1).max(300), date: z.iso.date(),
          startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          calendar: z.string().trim().min(1).max(120).optional(),
        }).parse(toolUse.input);
        const job = await queueAutonomyJob({
          idempotencyKey: `tool:${toolUse.id}`,
          actionType: "calendar.add",
          summary: `Agregar ${input.title} al calendario`,
          payload: input,
          forceApproval: true,
        });
        return { content: `El evento ${input.title} quedó preparado y pendiente de aprobación.`, pendingAction: pendingAutomationAction(job), auditStatus: "pending" };
      }
      case "draft_email":
      case "send_email": {
        const input = z.object({
          recipient: z.email().max(320),
          subject: z.string().trim().min(1).max(200),
          body: z.string().trim().min(1).max(20_000),
        }).parse(toolUse.input);
        const actionType = toolUse.name === "draft_email" ? "email.draft" : "email.send";
        const job = await queueAutonomyJob({
          idempotencyKey: `tool:${toolUse.id}`,
          actionType,
          summary: `${toolUse.name === "draft_email" ? "Crear borrador" : "Enviar correo"} para ${input.recipient}`,
          payload: input,
          forceApproval: true,
        });
        return { content: "El correo quedó preparado y pendiente de aprobación.", pendingAction: pendingAutomationAction(job), auditStatus: "pending" };
      }
      case "send_whatsapp_message": {
        const input = z.object({
          recipient: z.string().trim().min(1).max(200),
          body: z.string().trim().min(1).max(4_000),
        }).parse(toolUse.input);
        const job = await queueAutonomyJob({
          idempotencyKey: `tool:${toolUse.id}`,
          actionType: "whatsapp.send",
          summary: `Enviar WhatsApp a ${input.recipient}`,
          payload: input,
          forceApproval: true,
        });
        return { content: "El mensaje quedó preparado y pendiente de aprobación.", pendingAction: pendingAutomationAction(job), auditStatus: "pending" };
      }
      default:
        throw new ValidationError(`Herramienta desconocida: ${toolUse.name}`);
    }
  } catch (error) {
    return { content: `La herramienta falló de forma segura: ${errorMessage(error)}`, failed: true, auditStatus: "failed" };
  }
}

export async function executeShadowTool(
  toolUse: ToolUseBlock,
  context: { conversationId?: string } = {},
): Promise<ToolExecution> {
  const result = await performShadowTool(toolUse);
  await auditShadowAction({
    conversationId: context.conversationId,
    toolName: toolUse.name,
    status: result.auditStatus ?? (result.failed ? "failed" : result.pendingAction ? "pending" : "completed"),
    summary: result.failed
      ? `${toolUse.name} falló de forma segura.`
      : result.pendingAction
        ? `${toolUse.name} quedó pendiente de aprobación.`
        : `${toolUse.name} fue procesada.`,
    toolInput: toolUse.input,
    result: result.auditResult ?? { content: result.content.slice(0, 2_000) },
    reversible: Boolean(result.pendingAction) || toolUse.name === "remember_personal_context",
  });
  return result;
}
