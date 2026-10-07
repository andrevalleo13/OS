import type { PendingShadowAction } from "@/features/shadow/file-actions";
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
