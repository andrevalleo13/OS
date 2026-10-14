"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertLocalAction } from "@/lib/local-action";
import { vaultNow } from "@/features/vault/ops";
import { appendToDaily } from "@/features/vault/shadow-writes";
import { formatMoment } from "@/features/vault/template";

const CAPTURE_SECTION = "🧠 Descarga mental (raw)";
const captureSchema = z.string().trim().min(1).max(20_000);

/**
 * Captura rápida: la idea entra al diario de hoy, en “Descarga mental”, como
 * `- HH:mm texto` (hora de la bóveda). Es texto de Andre, así que no se valida
 * ni deja revisión de Shadow.
 */
export async function captureToDaily(text: string) {
  await assertLocalAction();
  const clean = captureSchema.parse(text).replace(/\r\n/g, "\n");
  const time = formatMoment(vaultNow(), "HH:mm");
  const [first, ...rest] = clean.split("\n");
  const line = [`- ${time} ${first}`, ...rest.map((item) => (item.trim() ? `  ${item}` : ""))].join("\n");
  const result = await appendToDaily({ section: CAPTURE_SECTION, content: line }, { record: false, validate: false });
  revalidatePath("/");
  return { path: result.path, created: result.created };
}
