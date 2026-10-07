import type { PendingShadowAction } from "@/features/shadow/file-actions";
import type { ShadowStep } from "@/features/shadow/protocol";
import type { ShadowSource } from "@/features/shadow/sources";

/**
 * Lo que Shadow está haciendo. Los tres últimos son estados de cierre: se
 * muestran un momento tras una respuesta y luego vuelven a `idle`.
 */
export type ShadowStatus = "idle" | "listening" | "thinking" | "speaking" | "done" | "warning" | "error";

export type ShadowMessage = {
  id: string;
  sender: "USR" | "SHDW";
  text: string;
  mood?: string;
  widget?: string;
  pendingAction?: PendingShadowAction;
  sources?: ShadowSource[];
  /** La respuesta sigue llegando. */
  streaming?: boolean;
  /** Pasos reales que Shadow está ejecutando para esta respuesta. */
  steps?: LiveShadowStep[];
  createdAt?: string;
  failed?: boolean;
};

export type ShadowConversationMeta = {
  key: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  archived: boolean;
};

export type ComposerMode = "ask" | "plan" | "act";

export type LiveShadowStep = ShadowStep & { status: "running" | "done" | "failed" };
