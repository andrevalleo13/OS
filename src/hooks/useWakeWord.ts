"use client";

import { useEffect, useState, useRef } from "react";
import { useWidget } from "@/components/ui/widget";

export function useWakeWord() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const { setActiveWidgetId } = useWidget();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "es-MX"; // Spanish to catch normal speech, but looking for "shadow"

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      const currentTranscript = finalTranscript || interimTranscript;
      const lowerTranscript = currentTranscript.toLowerCase();
      
      setTranscript(lowerTranscript);

      // Wake word detection (allowing some phonetic errors in Spanish)
      if (
        lowerTranscript.includes("shadow") || 
        lowerTranscript.includes("chado") || 
        lowerTranscript.includes("chato") ||
        lowerTranscript.includes("yado")
      ) {
        setActiveWidgetId("shadow"); // Expands ShadowWidget!
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if we want to keep listening
      if (isListening) {
        try {
          recognition.start();
        } catch(e) {}
      }
    };

    recognitionRef.current = recognition;

    if (isListening) {
      try {
        recognition.start();
      } catch(e) {}
    }

    return () => {
      recognition.stop();
    };
  }, [isListening, setActiveWidgetId]);

  return { isListening, setIsListening, transcript };
}
