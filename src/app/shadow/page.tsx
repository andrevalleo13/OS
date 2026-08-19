"use client";

import { useState, useEffect, useRef } from "react";
import ShadowOrb from "@/components/ShadowOrb";
import { ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { askShadow } from "@/app/actions/shadow";

export default function ShadowPage() {
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [inputValue, setInputValue] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const processCommand = async (command: string) => {
    if (!command.trim() || status === 'thinking') return;
    
    setInputValue('');
    setStatus('thinking');
    setLogs(prev => [...prev, `[USR] ${command}`]);

    try {
      const result = await askShadow(command);
      setStatus('speaking');
      setLogs(prev => [...prev, `[SHDW] ${result.text}`]);
      
      const wordCount = result.text.split(' ').length;
      const speakingDuration = Math.max(2000, wordCount * 250);

      setTimeout(() => {
        setStatus('idle');
      }, speakingDuration);
    } catch (e) {
      setStatus('idle');
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCommand(inputValue);
  };

  return (
    <div className="w-full flex-1 relative bg-[#000] rounded-[32px] border border-white/[0.02] text-[#ededed] overflow-hidden flex flex-col items-center justify-center font-sans selection:bg-white/20 mt-4 shadow-2xl pb-24">
      
      {/* Background Ambient Glow matching state */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[150px] pointer-events-none transition-all duration-[2000ms] ease-in-out
        ${status === 'listening' ? 'bg-[#ff5500]/10 scale-110' : 
          status === 'thinking' ? 'bg-white/[0.03] scale-90' : 
          status === 'speaking' ? 'bg-white/[0.05] scale-100' : 
          'bg-white/[0.01] scale-100'}`} 
      />

      {/* Central Interface */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <motion.div 
          animate={{ scale: status === 'listening' ? 1.05 : 1 }}
          className="relative w-[360px] h-[360px] flex items-center justify-center mb-8"
        >
          <ShadowOrb status={status === 'listening' ? 'idle' : status} hideBackground={true} />
        </motion.div>

        {/* Live Subtitles / Context */}
        <div className="h-20 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p 
              key={status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-2xl font-light tracking-tight text-white/80 max-w-2xl text-center px-8"
            >
              {status === 'idle' && "Hola Andre. ¿En qué te puedo ayudar?"}
              {status === 'listening' && <span className="text-[#ff5500]">Escuchando...</span>}
              {status === 'thinking' && "Procesando solicitud..."}
              {status === 'speaking' && logs.length > 0 ? logs[logs.length - 1].replace('[SHDW] ', '') : "Ejecutando."}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom HUD: Minimalist Command Input */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl z-30 px-8">
        <form onSubmit={handleCommandSubmit} className="relative group w-full flex items-center">
          <div className="absolute inset-0 bg-[#0a0a0a] rounded-[24px] border border-white/[0.06] shadow-2xl transition-all group-focus-within:border-white/[0.15]" />
          <input 
            type="text" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Pregúntale a Shadow..." 
            className="w-full bg-transparent border-none outline-none text-lg text-[#ededed] px-8 py-5 placeholder:text-white/20 z-10"
            disabled={status === 'thinking'}
          />
          <button 
            type="submit"
            disabled={!inputValue.trim() || status === 'thinking'}
            className="absolute right-4 z-10 p-2.5 rounded-full bg-white text-black hover:scale-105 disabled:opacity-30 disabled:hover:scale-100 transition-all flex items-center justify-center"
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </button>
        </form>
      </div>
    </div>
  );
}
