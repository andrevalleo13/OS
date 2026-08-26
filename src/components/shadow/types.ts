import type { PendingShadowAction } from "@/features/shadow/file-actions";

export type ShadowStatus = "idle" | "listening" | "thinking" | "speaking";

export type ShadowMessage = {
  id: string;
  sender: "USR" | "SHDW";
  text: string;
  mood?: string;
  widget?: string;
  pendingAction?: PendingShadowAction;
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
