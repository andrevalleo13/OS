"use client";

import { useEffect, useRef } from "react";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { bracketMatching, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Annotation, Compartment, EditorSelection, EditorState } from "@codemirror/state";
import { drawSelection, dropCursor, EditorView, keymap, placeholder } from "@codemirror/view";
import { toggleTask, toggleWrap, wrapWikilink } from "./commands";
import { tagCompletion, wikilinkCompletion } from "./completions";
import { refreshDecorations, vaultEditorContext, type VaultEditorContext } from "./context";
import { frontmatterEnd, markdownDecorations } from "./livePreview";
import { vaultEditorTheme, vaultHighlightStyle } from "./theme";

const externalChange = Annotation.define<boolean>();

type NoteEditorProps = {
  /** Contenido inicial. Cambios posteriores solo se aplican si difieren del documento. */
  content: string;
  /** Sube cada vez que el contenido viene de fuera (disco, Shadow, conflicto). */
  externalVersion: number;
  mode: "live" | "source";
  context: VaultEditorContext;
  onChange: (content: string) => void;
  onSave?: () => void;
  reveal?: { line: number; nonce: number } | null;
  autoFocus?: boolean;
  onView?: (view: EditorView | null) => void;
};

export default function NoteEditor({ content, externalVersion, mode, context, onChange, onSave, reveal, autoFocus, onView }: NoteEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const contextRef = useRef<VaultEditorContext>(context);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const modeCompartment = useRef(new Compartment());

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  });

  // Crear el editor una vez por montaje.
  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: content,
      extensions: [
        vaultEditorContext.of(contextRef),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage, addKeymap: true }),
        syntaxHighlighting(vaultHighlightStyle),
        vaultEditorTheme,
        placeholder("Empieza a escribir…  [[ para enlazar, # para etiquetar"),
        autocompletion({ override: [wikilinkCompletion, tagCompletion], icons: false, closeOnBlur: true, activateOnTyping: true }),
        modeCompartment.current.of(markdownDecorations(mode === "live")),
        keymap.of([
          { key: "Mod-s", preventDefault: true, run: () => {
            onSaveRef.current?.();
            return true;
          } },
          { key: "Mod-b", run: toggleWrap("**") },
          { key: "Mod-i", run: toggleWrap("*") },
          { key: "Mod-Shift-h", run: toggleWrap("==") },
          { key: "Mod-Shift-x", run: toggleWrap("~~") },
          { key: "Mod-`", run: toggleWrap("`") },
          { key: "Mod-Enter", run: toggleTask },
          { key: "Mod-Shift-l", run: wrapWikilink },
          ...closeBracketsKeymap,
          ...markdownKeymap,
          ...completionKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...defaultKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && update.transactions.some((transaction) => !transaction.annotation(externalChange))) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "on", autocapitalize: "sentences", lang: "es" }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    onView?.(view);
    if (autoFocus) {
      // Como Obsidian: el cursor empieza en el cuerpo, no dentro de las propiedades.
      const end = frontmatterEnd(view.state);
      if (end !== -1) view.dispatch({ selection: EditorSelection.cursor(Math.min(end + 1, view.state.doc.length)) });
      view.focus();
    }
    return () => {
      onView?.(null);
      view.destroy();
      viewRef.current = null;
    };
    // El editor se recrea solo cuando el padre cambia la `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Contexto (resolvedor, notas, callbacks) siempre al día; redibuja enlaces.
  useEffect(() => {
    contextRef.current = context;
    viewRef.current?.dispatch({ effects: refreshDecorations.of(null) });
  }, [context]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: modeCompartment.current.reconfigure(markdownDecorations(mode === "live")) });
  }, [mode]);

  // Contenido externo: reemplaza el documento conservando el cursor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === content) return;
    const head = Math.min(view.state.selection.main.head, content.length);
    view.dispatch({
      changes: { from: 0, to: current.length, insert: content },
      selection: EditorSelection.cursor(head),
      annotations: externalChange.of(true),
    });
    // Solo cuando el padre marca una versión externa nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalVersion]);

  const revealNonce = reveal?.nonce;
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !reveal) return;
    const lineNumber = Math.min(Math.max(reveal.line + 1, 1), view.state.doc.lines);
    const line = view.state.doc.line(lineNumber);
    view.dispatch({
      selection: EditorSelection.cursor(line.from),
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    view.focus();
    // Una vez por petición (nonce), no cada vez que cambia el documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealNonce]);

  return <div ref={hostRef} data-vault-editor="" />;
}
