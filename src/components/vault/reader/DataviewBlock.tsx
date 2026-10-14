"use client";

import { Fragment, type ReactNode } from "react";
import useSWR from "swr";
import { Check, Database, Loader2, TriangleAlert } from "lucide-react";
import { runVaultQuery } from "@/app/actions/vault-query";
import type { DataviewCell, DataviewResult } from "@/features/vault/dataview";
import { splitLinkInner } from "@/features/vault/parse";
import { useVaultChanges } from "../useVault";
import { cn, isModifierClick, useReader } from "./context";
import { InternalLink } from "./InternalLink";

/** Texto de una celda: los `[[wikilinks]]` dentro del texto son clicables. */
function InlineText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(/\[\[([^[\]\n]+?)\]\]/g)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const { target, subpath, alias } = splitLinkInner(match[1]);
    parts.push(<InternalLink key={start} target={target} subpath={subpath}>{alias}</InternalLink>);
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Cell({ cell }: { cell: DataviewCell }) {
  switch (cell.kind) {
    case "empty":
      return <span className="text-white/20">—</span>;
    case "text":
      return <InlineText text={cell.text} />;
    case "number":
      return <span className="font-mono tabular-nums text-white/80">{cell.text}</span>;
    case "date":
      return <span className="font-mono text-[0.86em] tabular-nums text-white/60">{cell.text}</span>;
    case "link":
      return <InternalLink target={cell.path} subpath={cell.subpath}>{cell.text}</InternalLink>;
    case "list":
      if (cell.items.length === 1) return <Cell cell={cell.items[0]} />;
      return (
        <ul className="list-disc space-y-0.5 pl-4 marker:text-white/30">
          {cell.items.map((item, index) => <li key={index}><Cell cell={item} /></li>)}
        </ul>
      );
  }
}

function Shell({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="my-4" data-dataview="">
      {count !== undefined && (
        <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] text-white/25">
          <Database className="size-3" />
          {count} {count === 1 ? "resultado" : "resultados"}
        </div>
      )}
      {children}
    </div>
  );
}

function Empty({ type }: { type: DataviewResult["type"] }) {
  const what = type === "table" ? "tabla" : type === "list" ? "lista" : "tareas";
  return (
    <p className="rounded-md border border-white/[0.06] px-3 py-2 text-[12px] text-white/35">
      Dataview: sin resultados para esta consulta de {what}.
    </p>
  );
}

function TableResult({ result }: { result: DataviewResult }) {
  const headers = result.headers ?? [];
  return (
    <div className="overflow-x-auto [scrollbar-width:thin]">
      <table className="w-full border-collapse text-[0.9em]">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index} className="whitespace-nowrap border-b border-white/[0.12] px-3 py-1.5 text-left font-semibold text-white/85 first:pl-1">
                {header}
                {index === 0 && <span className="ml-1.5 font-mono text-[10px] font-normal text-white/30">{result.rows.length}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.02]">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-1.5 align-top text-white/75 first:pl-1">
                  <Cell cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListResult({ result }: { result: DataviewResult }) {
  return (
    <ul className="list-disc space-y-0.5 pl-[1.6em] marker:text-white/35">
      {result.rows.map((row, index) => (
        <li key={index}>
          {row.map((cell, cellIndex) => (
            <Fragment key={cellIndex}>
              {cellIndex > 0 && <span className="text-white/35">: </span>}
              <Cell cell={cell} />
            </Fragment>
          ))}
        </li>
      ))}
    </ul>
  );
}

function TaskResult({ result }: { result: DataviewResult }) {
  const reader = useReader();
  return (
    <div className="space-y-3">
      {(result.groups ?? []).map((group) => (
        <div key={group.path}>
          <div className="mb-1 text-[0.9em] font-semibold">
            <InternalLink target={group.path}>{group.title}</InternalLink>
            <span className="ml-1.5 font-mono text-[10px] font-normal text-white/30">{group.tasks.length}</span>
          </div>
          <ul className="space-y-0.5 pl-1">
            {group.tasks.map((task) => {
              const done = task.status.toLowerCase() === "x" || task.status === "-";
              return (
                <li key={task.line} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-[0.36em] inline-flex size-[14px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px]",
                      task.checked ? "border-[#e8e8e8] bg-[#e8e8e8] text-[#0a0a0a]" : "border-white/30",
                    )}
                  >
                    {task.checked && (task.status.toLowerCase() === "x" ? <Check className="size-[10px]" strokeWidth={3.5} /> : <span className="font-mono text-[8px] font-bold leading-none">{task.status}</span>)}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => reader.onOpen(task.path, { newTab: isModifierClick(event), line: task.line })}
                    className={cn("min-w-0 text-left transition hover:text-white", done ? "text-white/40 line-through decoration-white/25" : "text-white/80")}
                  >
                    <InlineText text={task.text} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Bloque ```dataview```: consulta en el servidor y pinta tabla, lista o tareas. */
export function DataviewBlock({ source }: { source: string }) {
  const reader = useReader();
  const key = `vault:dataview:${reader.path}:${source}`;
  const { data, error, isLoading, mutate } = useSWR(key, () => runVaultQuery(source, reader.path), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
  useVaultChanges(() => {
    void mutate();
  });

  if (!data) {
    if (error) return <QueryError message={error instanceof Error ? error.message : "Error al ejecutar la consulta."} source={source} />;
    return (
      <Shell>
        <div className="flex items-center gap-2 py-2 text-[11px] text-white/30">
          {isLoading && <Loader2 className="size-3.5 animate-spin" />} Ejecutando consulta…
        </div>
      </Shell>
    );
  }
  if (data.error) return <QueryError message={data.error} source={source} />;

  const count = data.type === "task" ? (data.groups ?? []).reduce((total, group) => total + group.tasks.length, 0) : data.rows.length;
  const empty = count === 0;
  return (
    <Shell count={data.type === "table" || empty ? undefined : count}>
      {empty ? <Empty type={data.type} /> : data.type === "table" ? <TableResult result={data} /> : data.type === "list" ? <ListResult result={data} /> : <TaskResult result={data} />}
    </Shell>
  );
}

function QueryError({ message, source }: { message: string; source: string }) {
  return (
    <div className="my-4 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2.5" data-dataview="">
      <div className="flex items-center gap-1.5 text-[11px] text-white/55">
        <TriangleAlert className="size-3.5" /> Error de Dataview
      </div>
      <p className="mt-1 font-mono text-[11px] text-white/45">{message}</p>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap border-t border-white/[0.05] pt-2 font-mono text-[11px] leading-relaxed text-white/30">{source}</pre>
    </div>
  );
}

/** ```dataviewjs```: aviso discreto con el código plegado. */
export function DataviewJsNotice({ source }: { source: string }) {
  return (
    <details className="group/djs my-4 rounded-md border border-dashed border-white/[0.1] px-3 py-2 text-[11px] text-white/40">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 marker:hidden">
        <Database className="size-3.5" />
        DataviewJS no está soportado en la app: ábrelo en Obsidian.
        <span className="ml-auto text-white/25 group-open/djs:hidden">Ver código</span>
      </summary>
      <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-white/35">{source}</pre>
    </details>
  );
}
