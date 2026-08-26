"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/useUIStore";

export default function PreferencesSync() {
  const compactMode = useUIStore((state) => state.compactMode);
  const reducedMotion = useUIStore((state) => state.reducedMotion);

  useEffect(() => {
    document.documentElement.dataset.compact = String(compactMode);
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [compactMode, reducedMotion]);

  return null;
}
