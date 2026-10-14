"use client";

import { useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import { getVaultSnapshot, type VaultSnapshot } from "@/app/actions/vault";
import { createLinkResolver, nameKey, type LinkResolver } from "@/features/vault/parse";

export const SNAPSHOT_KEY = "vault:snapshot";

type ChangeListener = (paths: string[]) => void;
const listeners = new Set<ChangeListener>();
let source: EventSource | null = null;

function ensureEvents() {
  if (source || typeof window === "undefined") return;
  source = new EventSource("/api/vault/events");
  source.addEventListener("change", (event) => {
    try {
      const { paths } = JSON.parse((event as MessageEvent<string>).data) as { paths: string[] };
      void mutate(SNAPSHOT_KEY);
      void mutate((key) => typeof key === "string" && key.startsWith("vault:meta:"));
      for (const listener of listeners) listener(paths);
    } catch {
      // evento malformado
    }
  });
  source.addEventListener("unavailable", () => {
    source?.close();
    source = null;
  });
}

/** Avisa cuando cambian archivos de la bóveda en disco (Obsidian, Sync o Shadow). */
export function useVaultChanges(listener: ChangeListener) {
  const ref = useRef(listener);
  useEffect(() => {
    ref.current = listener;
  });
  useEffect(() => {
    ensureEvents();
    const wrapped: ChangeListener = (paths) => ref.current(paths);
    listeners.add(wrapped);
    return () => {
      listeners.delete(wrapped);
      if (listeners.size === 0 && source) {
        source.close();
        source = null;
      }
    };
  }, []);
}

const resolveNothing: LinkResolver = () => null;
const resolvers = new WeakMap<VaultSnapshot, LinkResolver>();

/** Un resolvedor por snapshot: misma identidad mientras la bóveda no cambie. */
function resolverFor(snapshot: VaultSnapshot): LinkResolver {
  const cached = resolvers.get(snapshot);
  if (cached) return cached;
  const aliases = new Map<string, string>();
  for (const note of snapshot.notes) for (const alias of note.aliases) aliases.set(nameKey(alias), note.path);
  const resolver = createLinkResolver(snapshot.files.map((file) => file.path), aliases);
  resolvers.set(snapshot, resolver);
  return resolver;
}

/** Lista de archivos, notas, aliases y tags de la bóveda + resolvedor de enlaces. */
export function useVaultSnapshot() {
  const swr = useSWR(SNAPSHOT_KEY, () => getVaultSnapshot(), { revalidateOnFocus: true, keepPreviousData: true });
  const data = swr.data;
  const snapshot = data?.available ? data : null;

  const resolve = snapshot ? resolverFor(snapshot) : resolveNothing;

  return {
    snapshot,
    unavailable: swr.data?.available === false,
    error: swr.error as Error | undefined,
    isLoading: swr.isLoading,
    resolve,
    refresh: () => mutate(SNAPSHOT_KEY),
  };
}

export function refreshVault() {
  void mutate(SNAPSHOT_KEY);
  void mutate((key) => typeof key === "string" && key.startsWith("vault:"));
}
