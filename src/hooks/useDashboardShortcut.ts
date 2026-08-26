"use client";

import { useEffect, useRef } from "react";

type ShortcutHandler = () => void;
const handlers = new Map<string, Set<ShortcutHandler>>();
let isListening = false;

function onKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
  const key = event.key.toLowerCase();
  const callbacks = handlers.get(key);
  if (!callbacks?.size) return;
  event.preventDefault();
  callbacks.forEach((callback) => callback());
}

function syncListener() {
  if (handlers.size > 0 && !isListening) {
    document.addEventListener("keydown", onKeyDown);
    isListening = true;
  } else if (handlers.size === 0 && isListening) {
    document.removeEventListener("keydown", onKeyDown);
    isListening = false;
  }
}

export function useDashboardShortcut(key: string, callback: ShortcutHandler) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const normalizedKey = key.toLowerCase();
    const handler = () => callbackRef.current();
    const callbacks = handlers.get(normalizedKey) ?? new Set<ShortcutHandler>();
    callbacks.add(handler);
    handlers.set(normalizedKey, callbacks);
    syncListener();

    return () => {
      callbacks.delete(handler);
      if (callbacks.size === 0) handlers.delete(normalizedKey);
      syncListener();
    };
  }, [key]);
}
