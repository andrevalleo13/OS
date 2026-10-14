import "server-only";

import { watch, type FSWatcher } from "node:fs";
import { vaultRoot } from "./fs";
import { invalidateVaultIndex } from "./index";

type Listener = (paths: string[]) => void;

type WatchState = {
  watcher: FSWatcher | null;
  listeners: Set<Listener>;
  pending: Set<string>;
  timer: ReturnType<typeof setTimeout> | null;
};

const globalState = globalThis as unknown as { __valleosVaultWatch?: WatchState };
const state: WatchState = globalState.__valleosVaultWatch ??= { watcher: null, listeners: new Set(), pending: new Set(), timer: null };

function ignored(file: string): boolean {
  return file.split("/").some((part) => part.startsWith(".")) || file.endsWith(".tmp");
}

function flush() {
  state.timer = null;
  const paths = [...state.pending];
  state.pending.clear();
  if (!paths.length) return;
  invalidateVaultIndex();
  for (const listener of state.listeners) listener(paths);
}

async function ensureWatcher() {
  if (state.watcher) return;
  const root = await vaultRoot();
  state.watcher = watch(root, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const file = filename.toString().normalize("NFC").replace(/\\/g, "/");
    if (ignored(file)) return;
    state.pending.add(file);
    if (!state.timer) state.timer = setTimeout(flush, 150);
  });
  state.watcher.on("error", () => {
    state.watcher?.close();
    state.watcher = null;
  });
}

/** Suscribe a cambios en disco (Obsidian, Sync, Shadow o el editor). */
export async function subscribeVaultChanges(listener: Listener): Promise<() => void> {
  await ensureWatcher();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
    if (state.listeners.size === 0 && state.watcher) {
      state.watcher.close();
      state.watcher = null;
    }
  };
}
