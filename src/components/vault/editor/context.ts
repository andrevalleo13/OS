import { Facet, StateEffect } from "@codemirror/state";

export type EditorNoteRef = { title: string; path: string; aliases: string[]; folder: string };

/** Todo lo que el editor necesita saber de la bóveda; vive en un ref mutable. */
export type VaultEditorContext = {
  path: string;
  resolve: (target: string, from?: string) => string | null;
  openLink: (target: string, options: { newTab: boolean }) => void;
  openUrl: (url: string) => void;
  searchTag: (tag: string) => void;
  notes: EditorNoteRef[];
  tags: string[];
};

export type VaultEditorContextRef = { current: VaultEditorContext };

export const vaultEditorContext = Facet.define<VaultEditorContextRef, VaultEditorContextRef | null>({
  combine: (values) => values[0] ?? null,
});

/** Fuerza a recalcular decoraciones (p. ej. cuando una nota nueva resuelve un enlace). */
export const refreshDecorations = StateEffect.define<null>();
