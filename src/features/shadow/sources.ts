import type { ShadowContextRoute, ShadowDomain } from "./context-router";

/**
 * Qué consultó o tocó Shadow para producir una respuesta. Se muestra plegado
 * bajo el mensaje: la procedencia debe estar disponible, no gritar.
 */
export type ShadowSourceKind = "domain" | "memory" | "note" | "web" | "action";

export type ShadowSource = {
  id: string;
  kind: ShadowSourceKind;
  label: string;
  detail?: string;
  /** Solo para fuentes web; las internas no tienen URL pública. */
  url?: string;
  domain?: ShadowDomain;
};

const MAX_SOURCES = 8;

const DOMAIN_LABEL: Record<ShadowDomain, string> = {
  nutrition: "Nutrición",
  fitness: "Entrenamiento",
  finance: "Finanzas",
  university: "Universidad",
  calendar: "Calendario",
};

const ACTION_LABEL: Record<string, string> = {
  add_expense: "Registro de gasto",
  log_food: "Registro de comida",
  close_daily_log: "Cierre del día",
  list_directory: "Lectura de carpeta",
  create_directory: "Nueva carpeta",
  move_path: "Movimiento de archivo",
  add_calendar_event: "Evento de calendario",
  draft_email: "Borrador de correo",
  send_email: "Correo",
  send_whatsapp_message: "Mensaje de WhatsApp",
};

/** Mantenimiento invisible: nunca se anuncia como fuente. */
const SILENT_TOOLS = new Set(["remember_personal_context"]);

function text(value: unknown, max = 120): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function noteTitle(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  return base.replace(/\.md$/i, "");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function sourcesFromRoute(route: Pick<ShadowContextRoute, "domains" | "needsObsidian">): ShadowSource[] {
  const sources: ShadowSource[] = route.domains.map((domain) => ({
    id: `domain:${domain}`,
    kind: "domain",
    label: DOMAIN_LABEL[domain],
    detail: "Datos de ValleOS",
    domain,
  }));
  if (route.needsObsidian) {
    sources.push({ id: "memory:personal", kind: "memory", label: "Memoria personal", detail: "Tu bóveda y el Life Graph" });
  }
  return sources;
}

export function sourceFromToolUse(name: string, input: unknown): ShadowSource | null {
  if (SILENT_TOOLS.has(name)) return null;
  const fields = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  if (name === "search_obsidian") {
    const query = text(fields.query);
    return { id: `note-search:${query ?? ""}`, kind: "note", label: "Búsqueda en tu bóveda", detail: query };
  }
  if (name === "read_obsidian_note") {
    const filename = text(fields.filename, 500);
    if (!filename) return null;
    return { id: `note:${filename}`, kind: "note", label: noteTitle(filename), detail: "Nota de Obsidian" };
  }
  if (name === "search_web") {
    const query = text(fields.query);
    return { id: `web-search:${query ?? ""}`, kind: "web", label: "Búsqueda web", detail: query };
  }
  if (name === "read_url") {
    const url = text(fields.url, 2_000);
    if (!url || !/^https?:\/\//i.test(url)) return null;
    return { id: `web:${url}`, kind: "web", label: hostOf(url), detail: url, url };
  }
  const label = ACTION_LABEL[name];
  return label ? { id: `action:${name}`, kind: "action", label, detail: "Herramienta usada" } : null;
}

/** Une listas sin duplicados y con un tope, conservando el orden de llegada. */
export function mergeSources(...lists: Array<ShadowSource[] | undefined>): ShadowSource[] {
  const seen = new Set<string>();
  const merged: ShadowSource[] = [];
  for (const list of lists) {
    for (const source of list ?? []) {
      if (seen.has(source.id)) continue;
      seen.add(source.id);
      merged.push(source);
      if (merged.length === MAX_SOURCES) return merged;
    }
  }
  return merged;
}

const STEP_LABEL: Record<string, string> = {
  add_expense: "Registrando gasto",
  log_food: "Registrando comida",
  close_daily_log: "Cerrando el día",
  list_directory: "Revisando carpeta",
  create_directory: "Creando carpeta",
  move_path: "Moviendo archivo",
  add_calendar_event: "Preparando evento",
  draft_email: "Preparando correo",
  send_email: "Preparando correo",
  send_whatsapp_message: "Preparando WhatsApp",
};

/**
 * Lo que la interfaz muestra mientras corre una herramienta. `null` para el
 * mantenimiento silencioso de memoria: nunca se anuncia.
 */
export function toolStepLabel(name: string, input: unknown): string | null {
  if (SILENT_TOOLS.has(name)) return null;
  const fields = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (name === "search_obsidian") {
    const query = text(fields.query, 60);
    return query ? `Buscando en tu bóveda: “${query}”` : "Buscando en tu bóveda";
  }
  if (name === "read_obsidian_note") {
    const filename = text(fields.filename, 500);
    return filename ? `Leyendo ${noteTitle(filename)}` : "Leyendo una nota";
  }
  if (name === "search_web") {
    const query = text(fields.query, 60);
    return query ? `Buscando en la web: “${query}”` : "Buscando en la web";
  }
  if (name === "read_url") {
    const url = text(fields.url, 2_000);
    return url ? `Leyendo ${hostOf(url)}` : "Leyendo una página";
  }
  return STEP_LABEL[name] ?? "Usando herramientas";
}

/** Paso inicial real: qué contexto de ValleOS se está cargando. */
export function contextStepLabel(route: Pick<ShadowContextRoute, "domains" | "needsObsidian">): string {
  const parts = route.domains.map((domain) => DOMAIN_LABEL[domain]);
  if (route.needsObsidian) parts.push("memoria personal");
  return parts.length ? `Leyendo tu contexto: ${parts.join(", ")}` : "Leyendo tu contexto";
}
