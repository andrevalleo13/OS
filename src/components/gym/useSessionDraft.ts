"use client";

import { useCallback, useEffect, useState } from "react";
import { isDraft, type SessionDraft } from "./lib/session";

const STORAGE_KEY = "valleos.gym.session.v1";
/** Un borrador de más de 14 h es una sesión olvidada, no una en curso. */
const MAX_AGE_MS = 14 * 60 * 60 * 1000;

type Updater = SessionDraft | null | ((current: SessionDraft | null) => SessionDraft | null);

/**
 * Sesión en curso persistida por navegador para que recargar, minimizar o
 * cambiar de página no pierda las series registradas.
 */
export function useSessionDraft() {
  const [draft, setDraftState] = useState<SessionDraft | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (isDraft(parsed) && Date.now() - parsed.startedAt < MAX_AGE_MS) setDraftState(parsed);
      else if (raw) window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Almacenamiento bloqueado (modo privado): la sesión vive sólo en memoria.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      if (draft) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorado a propósito: ver arriba.
    }
  }, [draft, loaded]);

  const setDraft = useCallback((updater: Updater) => {
    setDraftState((current) => (typeof updater === "function" ? updater(current) : updater));
  }, []);

  return { draft, setDraft, loaded };
}
