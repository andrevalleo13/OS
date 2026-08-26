import "server-only";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { serverConfig } from "@/lib/config";
import { resolveWithinRoot } from "./path-policy";

const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create_directory"), path: z.string().min(1).max(500) }),
  z.object({
    kind: z.literal("move_path"),
    source: z.string().min(1).max(500),
    destination: z.string().min(1).max(500),
  }),
]);

export type FileActionInput = z.infer<typeof actionSchema>;
export type PendingShadowAction = { id: string; label: string; expiresAt: string };

type PendingRecord = { action: FileActionInput; expiresAt: number };
const pendingActions = new Map<string, PendingRecord>();
const ACTION_TTL_MS = 5 * 60 * 1000;

function resolveHomePath(input: string): string {
  return resolveWithinRoot(serverConfig.paths.home, input);
}

function labelFor(action: FileActionInput): string {
  if (action.kind === "create_directory") return `Crear carpeta: ${action.path}`;
  return `Mover ${action.source} → ${action.destination}`;
}

export function queueFileAction(input: unknown): PendingShadowAction {
  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Operación de archivo inválida.");

  if (parsed.data.kind === "create_directory") resolveHomePath(parsed.data.path);
  else {
    resolveHomePath(parsed.data.source);
    resolveHomePath(parsed.data.destination);
  }

  const id = crypto.randomUUID();
  const expiresAt = Date.now() + ACTION_TTL_MS;
  pendingActions.set(id, { action: parsed.data, expiresAt });
  return { id, label: labelFor(parsed.data), expiresAt: new Date(expiresAt).toISOString() };
}

export async function approveFileAction(id: string): Promise<string> {
  const pending = pendingActions.get(id);
  pendingActions.delete(id);
  if (!pending) throw new NotFoundError("La acción ya no existe o ya fue procesada.");
  if (pending.expiresAt < Date.now()) throw new ValidationError("La confirmación expiró.");

  const action = pending.action;
  if (action.kind === "create_directory") {
    const target = resolveHomePath(action.path);
    await fs.mkdir(target, { recursive: true });
    return `Carpeta creada: ${action.path}`;
  }

  const source = resolveHomePath(action.source);
  const destination = resolveHomePath(action.destination);
  await fs.stat(source).catch(() => {
    throw new NotFoundError(`No existe: ${action.source}`);
  });
  await fs.stat(destination).then(
    () => { throw new ValidationError("El destino ya existe; no se sobrescribió nada."); },
    () => undefined,
  );
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(source, destination);
  return `Movido: ${action.source} → ${action.destination}`;
}

export async function listHomeDirectory(input: unknown): Promise<string> {
  const parsed = z.object({ path: z.string().max(500).default(".") }).parse(input);
  const target = resolveHomePath(parsed.path);
  const entries = await fs.readdir(target, { withFileTypes: true });
  return entries.slice(0, 200).map((entry) => `${entry.isDirectory() ? "[dir]" : "[file]"} ${entry.name}`).join("\n");
}
