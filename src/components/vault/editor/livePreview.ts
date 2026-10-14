import { syntaxTree } from "@codemirror/language";
import { StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { extensionOf, parseFrontmatter, splitLinkInner } from "@/features/vault/parse";
import { refreshDecorations, vaultEditorContext } from "./context";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"]);
const WIKILINK = /(!?)\[\[([^[\]\n]+?)\]\]/g;
const TAG = /(^|[\s(,;])(#[\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu;
const HIGHLIGHT = /==([^=\n]+?)==/g;
const COMMENT = /%%[^\n]*?%%/g;
const MATH = /(^|[^\\$])(\$[^$\n]+?\$)/g;
const CALLOUT = /^(\s*>\s*)(\[!([\w-]+)\]([+-]?))(\s*)(.*)$/;

class CheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean, private readonly pos: number) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.pos === this.pos;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("span");
    box.className = `cm-task-box${this.checked ? " is-checked" : ""}`;
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(this.checked));
    box.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({ changes: { from: this.pos + 1, to: this.pos + 2, insert: this.checked ? " " : "x" } });
    });
    return box;
  }
  ignoreEvent() {
    return true;
  }
}

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const bullet = document.createElement("span");
    bullet.className = "cm-bullet";
    bullet.textContent = "•";
    return bullet;
  }
}

class ImageWidget extends WidgetType {
  constructor(private readonly src: string, private readonly width: string | null, private readonly alt: string) {
    super();
  }
  eq(other: ImageWidget) {
    return other.src === this.src && other.width === this.width;
  }
  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "cm-embed-image";
    const image = document.createElement("img");
    image.src = this.src;
    image.alt = this.alt;
    image.loading = "lazy";
    if (this.width) image.style.width = `${Number.parseInt(this.width, 10)}px`;
    wrap.appendChild(image);
    return wrap;
  }
}

class CalloutLabelWidget extends WidgetType {
  constructor(private readonly type: string) {
    super();
  }
  eq(other: CalloutLabelWidget) {
    return other.type === this.type;
  }
  toDOM() {
    const label = document.createElement("span");
    label.className = "cm-callout-label";
    label.textContent = this.type;
    return label;
  }
}

function propertyText(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(propertyText);
  if (value === null || value === undefined || value === "") return [];
  if (value instanceof Date) return [value.toISOString().slice(0, 10)];
  if (typeof value === "object") return [JSON.stringify(value)];
  return [String(value).replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")];
}

/** Propiedades como en Obsidian: tabla compacta; clic para editar el YAML. */
class PropertiesWidget extends WidgetType {
  constructor(private readonly raw: string, private readonly editAt: number) {
    super();
  }
  eq(other: PropertiesWidget) {
    return other.raw === this.raw;
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement("div");
    wrap.className = "cm-properties";
    wrap.setAttribute("role", "button");
    wrap.setAttribute("aria-label", "Editar propiedades");
    const title = document.createElement("div");
    title.className = "cm-properties-title";
    title.textContent = "Propiedades";
    wrap.appendChild(title);
    const data = parseFrontmatter(this.raw);
    for (const [key, value] of Object.entries(data)) {
      const row = document.createElement("div");
      row.className = "cm-properties-row";
      const name = document.createElement("span");
      name.className = "cm-properties-key";
      name.textContent = key;
      const values = document.createElement("span");
      values.className = "cm-properties-values";
      const items = propertyText(value);
      if (!items.length) {
        const empty = document.createElement("span");
        empty.className = "cm-properties-empty";
        empty.textContent = "vacío";
        values.appendChild(empty);
      }
      for (const item of items) {
        const chip = document.createElement("span");
        chip.className = Array.isArray(value) || key === "tags" ? "cm-properties-chip" : "cm-properties-value";
        chip.textContent = key === "tags" ? `#${item.replace(/^#/, "")}` : item;
        values.appendChild(chip);
      }
      row.append(name, values);
      wrap.appendChild(row);
    }
    if (!Object.keys(data).length) {
      const raw = document.createElement("div");
      raw.className = "cm-properties-empty";
      raw.textContent = "YAML inválido: clic para revisarlo";
      wrap.appendChild(raw);
    }
    wrap.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({ selection: { anchor: this.editAt } });
      view.focus();
    });
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
}

function propertiesDecorations(state: EditorState): DecorationSet {
  const end = frontmatterEnd(state);
  if (end === -1) return Decoration.none;
  if (state.selection.ranges.some((range) => range.from <= end)) return Decoration.none;
  const rawFrom = state.doc.line(1).to + 1;
  const rawTo = state.doc.lineAt(end).from - 1;
  const raw = rawTo > rawFrom ? state.sliceDoc(rawFrom, rawTo) : "";
  return Decoration.set([Decoration.replace({ widget: new PropertiesWidget(raw, state.doc.line(2).from), block: true }).range(0, end)]);
}

const propertiesField = StateField.define<DecorationSet>({
  create: propertiesDecorations,
  update: (value, transaction) => transaction.docChanged || transaction.selection ? propertiesDecorations(transaction.state) : value,
  provide: (field) => EditorView.decorations.from(field),
});

function activeLineNumbers(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let line = first; line <= last; line += 1) lines.add(line);
  }
  return lines;
}

/** Rango del frontmatter YAML (`---` … `---`) al inicio del documento. */
export function frontmatterEnd(state: EditorState): number {
  const doc = state.doc;
  if (doc.lines < 2 || doc.line(1).text.trim() !== "---") return -1;
  for (let line = 2; line <= Math.min(doc.lines, 400); line += 1) {
    const text = doc.line(line).text.trim();
    if (text === "---" || text === "...") return doc.line(line).to;
  }
  return -1;
}

function buildDecorations(view: EditorView, live: boolean): DecorationSet {
  const { state } = view;
  const context = state.facet(vaultEditorContext)?.current;
  const ranges: Range<Decoration>[] = [];
  const active = live && view.hasFocus ? activeLineNumbers(state) : new Set<number>();
  const isActive = (pos: number) => live && active.has(state.doc.lineAt(pos).number);
  const hide = (from: number, to: number) => {
    if (to > from) ranges.push(Decoration.replace({}).range(from, to));
  };
  const fmEnd = frontmatterEnd(state);
  const code: [number, number][] = [];

  for (const { from, to } of view.visibleRanges) {
    // Frontmatter: se ve como bloque de propiedades.
    if (fmEnd !== -1 && from <= fmEnd) {
      for (let pos = Math.max(from, 0); pos <= Math.min(to, fmEnd);) {
        const line = state.doc.lineAt(pos);
        const edge = line.number === 1 || line.to === fmEnd;
        ranges.push(Decoration.line({ class: `cm-frontmatter${edge ? " cm-frontmatter-edge" : ""}` }).range(line.from));
        pos = line.to + 1;
      }
    }

    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (fmEnd !== -1 && node.from <= fmEnd) return node.name === "Document" ? undefined : false;
        const name = node.name;

        const heading = /^ATXHeading(\d)$/.exec(name);
        if (heading) {
          const line = state.doc.lineAt(node.from);
          ranges.push(Decoration.line({ class: `cm-h cm-h${heading[1]}` }).range(line.from));
          if (live && !isActive(node.from)) {
            const mark = node.node.getChild("HeaderMark");
            if (mark) hide(mark.from, Math.min(mark.to + 1, line.to));
          }
          return;
        }

        if (name === "FencedCode" || name === "CodeBlock") {
          code.push([node.from, node.to]);
          const first = state.doc.lineAt(node.from).number;
          const last = state.doc.lineAt(node.to).number;
          for (let number = first; number <= last; number += 1) {
            const line = state.doc.line(number);
            const fence = name === "FencedCode" && (number === first || number === last);
            ranges.push(Decoration.line({ class: `cm-codeblock${fence ? " cm-codeblock-fence" : ""}${number === first ? " cm-codeblock-first" : ""}${number === last ? " cm-codeblock-last" : ""}` }).range(line.from));
          }
          return false;
        }

        if (name === "InlineCode") {
          code.push([node.from, node.to]);
          ranges.push(Decoration.mark({ class: "cm-inline-code" }).range(node.from, node.to));
          if (live && !isActive(node.from)) {
            for (const mark of node.node.getChildren("CodeMark")) hide(mark.from, mark.to);
          }
          return false;
        }

        if (name === "Emphasis" || name === "StrongEmphasis" || name === "Strikethrough") {
          const markName = name === "Strikethrough" ? "StrikethroughMark" : "EmphasisMark";
          if (live && !isActive(node.from)) {
            for (const mark of node.node.getChildren(markName)) hide(mark.from, mark.to);
          }
          return;
        }

        if (name === "Link") {
          const marks = node.node.getChildren("LinkMark");
          const url = node.node.getChild("URL");
          if (marks.length >= 2 && url) {
            const textFrom = marks[0].to;
            const textTo = marks[1].from;
            const href = state.sliceDoc(url.from, url.to);
            if (textTo > textFrom) ranges.push(Decoration.mark({ class: "cm-md-link", attributes: { "data-href": href } }).range(textFrom, textTo));
            if (live && !isActive(node.from)) {
              hide(marks[0].from, marks[0].to);
              hide(marks[1].from, node.to);
            } else {
              ranges.push(Decoration.mark({ class: "cm-md-url" }).range(url.from, url.to));
            }
          }
          return false;
        }

        if (name === "URL" && node.node.parent?.name !== "Link") {
          ranges.push(Decoration.mark({ class: "cm-md-link", attributes: { "data-href": state.sliceDoc(node.from, node.to) } }).range(node.from, node.to));
          return;
        }

        if (name === "Blockquote") {
          const first = state.doc.lineAt(node.from).number;
          const last = state.doc.lineAt(node.to).number;
          const firstText = state.doc.line(first).text;
          const callout = CALLOUT.exec(firstText);
          for (let number = first; number <= last; number += 1) {
            const line = state.doc.line(number);
            const kind = callout ? (number === first ? "cm-callout cm-callout-title" : "cm-callout") : "cm-quote";
            ranges.push(Decoration.line({ class: `${kind}${number === first ? " cm-block-first" : ""}${number === last ? " cm-block-last" : ""}` }).range(line.from));
            if (live && !isActive(line.from)) {
              const quote = /^\s*>\s?/.exec(line.text);
              if (quote) hide(line.from, line.from + quote[0].length);
            }
          }
          if (callout && live && !isActive(state.doc.line(first).from)) {
            const line = state.doc.line(first);
            const start = line.from + callout[1].length;
            const end = start + callout[2].length + callout[5].length;
            ranges.push(Decoration.replace({ widget: new CalloutLabelWidget(callout[3].toLowerCase()) }).range(start, end));
          }
          return;
        }

        if (name === "HorizontalRule") {
          const line = state.doc.lineAt(node.from);
          if (live && !isActive(node.from)) {
            ranges.push(Decoration.line({ class: "cm-hr" }).range(line.from));
            hide(node.from, node.to);
          }
          return;
        }

        if (name === "ListMark") {
          const text = state.sliceDoc(node.from, node.to);
          const task = node.node.nextSibling;
          const isTask = task?.name === "Task";
          if (live && !isActive(node.from) && /^[-*+]$/.test(text)) {
            if (isTask) hide(node.from, Math.min(node.to + 1, state.doc.lineAt(node.from).to));
            else ranges.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to));
          }
          return;
        }

        if (name === "TaskMarker") {
          const checked = /\[[xX]\]/.test(state.sliceDoc(node.from, node.to));
          const line = state.doc.lineAt(node.from);
          if (checked) ranges.push(Decoration.line({ class: "cm-task-done" }).range(line.from));
          if (live && !isActive(node.from)) {
            ranges.push(Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(node.from, node.to));
          }
          return;
        }
        return;
      },
    });

    // Sintaxis propia de Obsidian, línea por línea, fuera de código.
    const inCode = (start: number, end: number) => code.some(([codeFrom, codeTo]) => start < codeTo && end > codeFrom);
    for (let pos = from; pos <= to;) {
      const line = state.doc.lineAt(pos);
      pos = line.to + 1;
      if (fmEnd !== -1 && line.from <= fmEnd) continue;
      const text = line.text;
      const lineActive = isActive(line.from);

      if (text.includes("[[")) {
        for (const match of text.matchAll(WIKILINK)) {
          const start = line.from + (match.index ?? 0);
          const end = start + match[0].length;
          if (inCode(start, end)) continue;
          const embed = match[1] === "!";
          const inner = match[2];
          const parts = splitLinkInner(inner);
          const resolved = context ? context.resolve(parts.target, context.path) : null;
          const ok = Boolean(resolved) || (!parts.target && Boolean(parts.subpath));
          const ext = extensionOf(parts.target);
          if (embed && IMAGE_EXTENSIONS.has(ext) && resolved && !lineActive && live) {
            const width = parts.alias && /^\d+(x\d+)?$/.test(parts.alias) ? parts.alias.split("x")[0] : null;
            ranges.push(Decoration.replace({ widget: new ImageWidget(`/api/vault/file?path=${encodeURIComponent(resolved)}`, width, parts.target) }).range(start, end));
            continue;
          }
          const openFrom = start + (embed ? 3 : 2);
          const closeFrom = end - 2;
          const visibleFrom = parts.alias !== undefined ? start + match[0].lastIndexOf("|") + 1 : openFrom;
          const linkTarget = inner.split("|")[0];
          if (closeFrom > visibleFrom) {
            ranges.push(Decoration.mark({
              class: `cm-wikilink${ok ? "" : " cm-wikilink-unresolved"}${embed ? " cm-wikilink-embed" : ""}`,
              attributes: { "data-target": linkTarget },
            }).range(visibleFrom, closeFrom));
          }
          if (live && !lineActive) {
            hide(start, visibleFrom);
            hide(closeFrom, end);
          } else {
            ranges.push(Decoration.mark({ class: "cm-link-bracket" }).range(start, openFrom));
            ranges.push(Decoration.mark({ class: "cm-link-bracket" }).range(closeFrom, end));
            if (visibleFrom > openFrom) ranges.push(Decoration.mark({ class: "cm-link-bracket" }).range(openFrom, visibleFrom));
          }
        }
      }

      if (text.includes("#")) {
        for (const match of text.matchAll(TAG)) {
          const start = line.from + (match.index ?? 0) + match[1].length;
          const end = start + match[2].length;
          if (inCode(start, end)) continue;
          if (/^#{1,6}$/.test(match[2])) continue;
          ranges.push(Decoration.mark({ class: "cm-tag", attributes: { "data-tag": match[2].slice(1) } }).range(start, end));
        }
      }

      if (text.includes("==")) {
        for (const match of text.matchAll(HIGHLIGHT)) {
          const start = line.from + (match.index ?? 0);
          const end = start + match[0].length;
          if (inCode(start, end)) continue;
          ranges.push(Decoration.mark({ class: "cm-highlight" }).range(start, end));
          if (live && !lineActive) {
            hide(start, start + 2);
            hide(end - 2, end);
          }
        }
      }

      if (text.includes("%%")) {
        for (const match of text.matchAll(COMMENT)) {
          const start = line.from + (match.index ?? 0);
          const end = start + match[0].length;
          if (!inCode(start, end)) ranges.push(Decoration.mark({ class: "cm-obsidian-comment" }).range(start, end));
        }
      }

      if (text.includes("$")) {
        for (const match of text.matchAll(MATH)) {
          const start = line.from + (match.index ?? 0) + match[1].length;
          const end = start + match[2].length;
          if (!inCode(start, end)) ranges.push(Decoration.mark({ class: "cm-math" }).range(start, end));
        }
      }
    }
  }

  return Decoration.set(ranges, true);
}

/** Vista en vivo (estilo Obsidian) o vista de código fuente con estilos. */
export function markdownDecorations(live: boolean): Extension {
  const plugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view, live);
    }
    update(update: ViewUpdate) {
      const refreshed = update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(refreshDecorations)));
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged || refreshed || syntaxTree(update.state) !== syntaxTree(update.startState)) {
        this.decorations = buildDecorations(update.view, live);
      }
    }
  }, {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      mousedown(event, view) {
        const target = event.target as HTMLElement;
        const context = view.state.facet(vaultEditorContext)?.current;
        if (!context) return false;
        const modifier = event.metaKey || event.ctrlKey;
        const pos = view.posAtDOM(target);
        const lineIsActive = live && view.hasFocus && view.state.selection.ranges.some((range) => {
          const line = view.state.doc.lineAt(pos).number;
          return view.state.doc.lineAt(range.from).number <= line && view.state.doc.lineAt(range.to).number >= line;
        });
        const shouldFollow = modifier || (live && !lineIsActive);
        if (!shouldFollow) return false;

        const wikilink = target.closest<HTMLElement>(".cm-wikilink");
        if (wikilink?.dataset.target !== undefined) {
          event.preventDefault();
          context.openLink(wikilink.dataset.target, { newTab: live ? modifier : event.shiftKey });
          return true;
        }
        const tag = target.closest<HTMLElement>(".cm-tag");
        if (tag?.dataset.tag) {
          event.preventDefault();
          context.searchTag(tag.dataset.tag);
          return true;
        }
        const link = target.closest<HTMLElement>(".cm-md-link");
        if (link?.dataset.href) {
          event.preventDefault();
          const href = link.dataset.href;
          if (/^[a-z][a-z0-9+.-]*:/i.test(href)) context.openUrl(href);
          else context.openLink(decodeURIComponent(href).replace(/\.md$/i, ""), { newTab: modifier });
          return true;
        }
        return false;
      },
    },
  });
  return live ? [propertiesField, plugin] : plugin;
}
