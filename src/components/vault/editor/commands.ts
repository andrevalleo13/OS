import { EditorSelection, type StateCommand } from "@codemirror/state";

/** Envuelve o desenvuelve la selección con un marcador (`**`, `*`, `==`, `~~`, `` ` ``). */
export function toggleWrap(marker: string): StateCommand {
  return ({ state, dispatch }) => {
    const changes = state.changeByRange((range) => {
      const before = state.sliceDoc(range.from - marker.length, range.from);
      const after = state.sliceDoc(range.to, range.to + marker.length);
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: range.from - marker.length, to: range.from, insert: "" },
            { from: range.to, to: range.to + marker.length, insert: "" },
          ],
          range: EditorSelection.range(range.from - marker.length, range.to - marker.length),
        };
      }
      const text = state.sliceDoc(range.from, range.to);
      if (text.startsWith(marker) && text.endsWith(marker) && text.length >= marker.length * 2) {
        return {
          changes: { from: range.from, to: range.to, insert: text.slice(marker.length, -marker.length) },
          range: EditorSelection.range(range.from, range.to - marker.length * 2),
        };
      }
      return {
        changes: [
          { from: range.from, insert: marker },
          { from: range.to, insert: marker },
        ],
        range: EditorSelection.range(range.from + marker.length, range.to + marker.length),
      };
    });
    dispatch(state.update(changes, { scrollIntoView: true, userEvent: "input" }));
    return true;
  };
}

/** Convierte la línea en tarea, o marca/desmarca la tarea (Cmd+Enter en Obsidian). */
export const toggleTask: StateCommand = ({ state, dispatch }) => {
  const seen = new Set<number>();
  const changes = [];
  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.head);
    if (seen.has(line.number)) continue;
    seen.add(line.number);
    const task = /^(\s*[-*+]\s+)\[([ xX])\]/.exec(line.text);
    if (task) {
      const at = line.from + task[1].length + 1;
      changes.push({ from: at, to: at + 1, insert: task[2] === " " ? "x" : " " });
      continue;
    }
    const bullet = /^(\s*)([-*+])\s+/.exec(line.text);
    if (bullet) {
      changes.push({ from: line.from + bullet[0].length, insert: "[ ] " });
      continue;
    }
    const indent = /^\s*/.exec(line.text)?.[0] ?? "";
    changes.push({ from: line.from + indent.length, insert: "- [ ] " });
  }
  if (!changes.length) return false;
  dispatch(state.update({ changes, userEvent: "input" }));
  return true;
};

/** Envuelve la selección como wikilink (`[[…]]`). */
export const wrapWikilink: StateCommand = ({ state, dispatch }) => {
  const changes = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to);
    return {
      changes: { from: range.from, to: range.to, insert: `[[${text}]]` },
      range: text ? EditorSelection.cursor(range.from + text.length + 4) : EditorSelection.cursor(range.from + 2),
    };
  });
  dispatch(state.update(changes, { userEvent: "input" }));
  return true;
};
