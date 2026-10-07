import type { PendingShadowAction } from "./file-actions";
import type { ShadowSource } from "./sources";

/**
 * Contrato entre el orquestador y la interfaz. Sin dependencias de servidor:
 * lo importan tanto la ruta de streaming como los componentes cliente.
 */
export type ShadowMood = "neutral" | "success" | "warning" | "info" | "urgent";
export type ShadowWidgetKind = "agenda" | "stats" | "none";

export type ShadowResult = {
  success: boolean;
  text: string;
  mood: ShadowMood;
  widget: ShadowWidgetKind;
  pendingAction?: PendingShadowAction;
  /** Lo que Shadow consultó o usó para responder. */
  sources?: ShadowSource[];
};

/** Un paso real del trabajo de Shadow: leer contexto, buscar, registrar… */
export type ShadowStep = {
  id: string;
  label: string;
};

export type ShadowStreamEvent =
  | { type: "step"; step: ShadowStep }
  | { type: "step_done"; id: string; ok: boolean }
  /** Fragmento visible de la respuesta (los metadatos ya vienen filtrados). */
  | { type: "text"; delta: string }
  /** El texto previo era un preámbulo antes de usar herramientas: se descarta. */
  | { type: "reset" }
  | { type: "done"; result: ShadowResult };

export const SHADOW_FAILURE: ShadowResult = {
  success: false,
  text: "Shadow no pudo completar la solicitud.",
  mood: "urgent",
  widget: "none",
};
