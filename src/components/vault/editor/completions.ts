import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { vaultEditorContext } from "./context";

/** `[[` → notas y aliases de la bóveda (como el autocompletado de Obsidian). */
export function wikilinkCompletion(context: CompletionContext): CompletionResult | null {
  const match = context.matchBefore(/!?\[\[[^[\]|#\n]*$/);
  if (!match) return null;
  const ref = context.state.facet(vaultEditorContext)?.current;
  if (!ref) return null;
  const from = match.from + match.text.indexOf("[[") + 2;
  const closed = context.state.sliceDoc(context.pos, context.pos + 2) === "]]";
  const close = closed ? "" : "]]";

  const options: Completion[] = [];
  for (const note of ref.notes) {
    options.push({
      label: note.title,
      detail: note.folder || "raíz",
      apply: (view, _completion, applyFrom, applyTo) => {
        const insert = `${note.title}${close}`;
        view.dispatch({
          changes: { from: applyFrom, to: applyTo, insert },
          selection: { anchor: applyFrom + note.title.length + 2 },
        });
      },
      boost: note.folder.startsWith("500") ? 1 : 0,
    });
    for (const alias of note.aliases) {
      options.push({
        label: alias,
        detail: `→ ${note.title}`,
        apply: (view, _completion, applyFrom, applyTo) => {
          const insert = `${note.title}|${alias}${close}`;
          view.dispatch({
            changes: { from: applyFrom, to: applyTo, insert },
            selection: { anchor: applyFrom + insert.length + (closed ? 2 : 0) },
          });
        },
      });
    }
  }
  return { from, options, validFor: /^[^[\]|#\n]*$/ };
}

/** `#` → tags existentes. */
export function tagCompletion(context: CompletionContext): CompletionResult | null {
  const match = context.matchBefore(/(?:^|[\s(])#[\p{L}\p{N}_/-]*$/u);
  if (!match) return null;
  const hash = match.text.lastIndexOf("#");
  if (hash === -1) return null;
  const ref = context.state.facet(vaultEditorContext)?.current;
  if (!ref?.tags.length) return null;
  const line = context.state.doc.lineAt(context.pos);
  if (/^#{1,6}$/.test(line.text.slice(0, context.pos - line.from).trim())) return null;
  return {
    from: match.from + hash + 1,
    options: ref.tags.map((tag) => ({ label: tag, detail: "tag" })),
    validFor: /^[\p{L}\p{N}_/-]*$/u,
  };
}
