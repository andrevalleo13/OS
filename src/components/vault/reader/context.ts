"use client";

import { createContext, useContext, type ComponentType } from "react";
import useSWR from "swr";
import { getVaultNote } from "@/app/actions/vault";

export type OpenOptions = { newTab?: boolean; line?: number };

export type NoteReaderProps = {
  /** Ruta de la nota relativa a la bóveda. */
  path: string;
  /** Markdown crudo completo, con frontmatter. */
  content: string;
  resolve: (target: string, from?: string) => string | null;
  onOpen: (path: string, options?: OpenOptions) => void;
  /** El padre crea la nota. */
  onOpenUnresolved: (target: string) => void;
  onSearchTag: (tag: string) => void;
  /** Contenido completo nuevo tras marcar/desmarcar una tarea. */
  onChange?: (next: string) => void;
  /** Profundidad de embebido (0 = nota principal). Se deja de transcluir en 2. */
  depth?: number;
};

export type ReaderContextValue = {
  path: string;
  content: string;
  depth: number;
  lineOffset: number;
  resolve: NoteReaderProps["resolve"];
  onOpen: NoteReaderProps["onOpen"];
  onOpenUnresolved: NoteReaderProps["onOpenUnresolved"];
  onSearchTag: NoteReaderProps["onSearchTag"];
  /** Null si las casillas son de solo lectura (embeds, vistas previas). */
  toggleTask: ((line: number) => void) | null;
  /** Desplaza a `#Encabezado` o `#^bloque` dentro de esta nota. */
  scrollToSubpath: (subpath: string) => void;
  /** Desplaza a un `id` dentro de esta nota (notas al pie). */
  scrollToId: (id: string) => void;
  /** El propio lector, inyectado para evitar ciclos de importación (embeds, vistas previas). */
  Reader: ComponentType<NoteReaderProps>;
};

export const ReaderContext = createContext<ReaderContextValue | null>(null);

export function useReader(): ReaderContextValue {
  const value = useContext(ReaderContext);
  if (!value) throw new Error("useReader solo funciona dentro de <NoteReader>.");
  return value;
}

/** Tarea del `<li>` actual: línea en el archivo completo y estado (`" "`, `x`, `/`, `-`…). */
export const TaskContext = createContext<{ line: number | null; status: string } | null>(null);

export const MAX_EMBED_DEPTH = 2;

export function noteKey(path: string) {
  return `vault:reader:note:${path}`;
}

/** Contenido de otra nota (embeds, vistas previas). Comparte caché por ruta. */
export function useVaultNote(path: string | null) {
  return useSWR(path ? noteKey(path) : null, () => getVaultNote(path as string), {
    revalidateOnFocus: false,
    dedupingInterval: 4_000,
  });
}

type HastLike = { type: string; value?: string; children?: HastLike[] };

/** Texto plano de un nodo hast. */
export function hastText(node: HastLike | undefined | null): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(hastText).join("");
}

export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function isModifierClick(event: { metaKey: boolean; ctrlKey: boolean }) {
  return event.metaKey || event.ctrlKey;
}
