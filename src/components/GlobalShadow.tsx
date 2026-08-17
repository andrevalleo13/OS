"use client";

import { usePathname, useRouter } from "next/navigation";
import ShadowOrb from "./ShadowOrb";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { useState, useRef } from "react";

export default function GlobalShadow() {
  const pathname = usePathname();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Don't show the global floating orb if we are already on the dedicated /shadow page
  if (pathname === '/shadow') return null;

  const isExpanded = isHovered || isFocused || inputValue.length > 0;

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
          <div className="bg-[#111]/90 backdrop-blur-xl border border-[#222] border-r-0 rounded-l-full h-full pl-6 pr-8 flex items-center shadow-2xl">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask Shadow..."
              className="bg-transparent border-none outline-none text-sm text-[#ededed] w-full placeholder:text-[#555]"
            />
            <AnimatePresence>
              {inputValue && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="submit"
                  className="w-8 h-8 rounded-full bg-[#333] text-white flex items-center justify-center hover:bg-[#555] transition-colors ml-2 shrink-0"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.form>

        {/* The Mini Orb (Trigger) */}
        <motion.div 
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
            <ShadowOrb status={inputValue ? 'thinking' : 'idle'} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
