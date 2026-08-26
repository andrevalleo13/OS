"use client";

import { useCallback } from "react";
import { useShadowVoice } from "@/components/shadow/ShadowVoiceProvider";

/** @deprecated Consume useShadowVoice directly in new components. */
export function useWakeWord() {
  const voice = useShadowVoice();
  const setIsListening = useCallback((next: boolean) => {
    if (next && !voice.enabled) voice.toggleEnabled();
    if (!next && voice.enabled) voice.toggleEnabled();
  }, [voice]);

  return {
    isListening: voice.enabled,
    setIsListening,
    transcript: voice.transcript,
  };
}
