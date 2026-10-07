"use client";

import { usePathname, useRouter } from "next/navigation";
import ShadowOrb from "./ShadowOrb";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useState, useRef } from "react";
import { useShadowVoice } from "@/components/shadow/ShadowVoiceProvider";
import type { ShadowStatus } from "@/components/shadow/types";

export default function GlobalShadow() {
  const pathname = usePathname();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const voice = useShadowVoice();

  // Don't show the global floating orb if we are already on the dedicated /shadow page
  if (pathname === '/shadow') return null;

  const isExpanded = isHovered || isFocused || inputValue.length > 0;
  const orbStatus: ShadowStatus = voice.phase === "listening" ? "listening" : voice.phase === "processing" ? "thinking" : voice.phase === "speaking" ? "speaking" : inputValue ? "listening" : "idle";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) {
      router.push('/shadow');
      return;
    }
    // Navigate to shadow page and pass the query
    router.push(`/shadow?q=${encodeURIComponent(inputValue)}`);
    setInputValue("");
    inputRef.current?.blur();
    setIsHovered(false);
  };

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 flex items-center justify-end"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center">
        
        {/* Sliding Input Field */}
        <motion.form 
          initial={false}
          animate={{ 
            width: isExpanded ? 320 : 0, 
            opacity: isExpanded ? 1 : 0,
            x: isExpanded ? 16 : 40
          }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
          onSubmit={handleSubmit}
          className="overflow-hidden relative z-0 h-14"
        >
          <div className="bg-[#0a0a0a]/95 backdrop-blur-3xl border border-white/10 border-r-0 rounded-l-full h-full pl-6 pr-8 flex items-center shadow-2xl">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Pregúntale a Shadow…"
              aria-label="Mensaje para Shadow"
              className="os-message-input w-full border-none bg-transparent text-sm text-[#ededed] outline-none placeholder:text-[#555]"
            />
            <AnimatePresence>
              {inputValue && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="submit"
                  aria-label="Enviar a Shadow"
                  className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#111111] transition-colors hover:bg-white/90"
                >
                  <ArrowUp className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.form>

        {/* The Mini Orb (Trigger) */}
        <motion.div 
          role="button"
          tabIndex={0}
          aria-label="Abrir Shadow"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push("/shadow");
            }
          }}
          className="relative w-16 h-16 flex items-center justify-center cursor-pointer z-10 shrink-0"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
             if (isExpanded && !inputValue) {
                router.push('/shadow');
             } else if (!isExpanded) {
                router.push('/shadow');
             }
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <ShadowOrb status={orbStatus} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
