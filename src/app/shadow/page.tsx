"use client";

import { useState } from "react";
import ShadowOrb from "@/components/ShadowOrb";
import { Activity, Wand2, MessageSquare, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { containerVariants, itemVariants } from "@/lib/animations";
import { askShadow } from "@/app/actions/shadow";

export default function ShadowPage() {
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [inputValue, setInputValue] = useState('');
  const [logs, setLogs] = useState<string[]>([
    "[SYS] Quantum Core Initialized.",
    "[SYS] Neural pathways active.",
    "[SYS] Awaiting wake word 'Shadow'..."
  ]);
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
    setLogs(prev => [...prev, `[NLP] Parsing intent matrix...`]);

    try {
      const result = await askShadow(command);
      setStatus('speaking');
      setLogs(prev => [...prev, `[SHDW] ${result.text}`]);
      
      const wordCount = result.text.split(' ').length;
      const speakingDuration = Math.max(2000, wordCount * 250);

      setTimeout(() => {
        setStatus('idle');
        setLogs(prev => [...prev, `[SYS] Awaiting input.`]);
      }, speakingDuration);
    } catch (e) {
      setStatus('idle');
      setLogs(prev => [...prev, `[ERR] Cognitive flux disrupted.`]);
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCommand(inputValue);
  };

  return (
    <div className="w-full h-screen fixed inset-0 bg-[#000] text-[#ededed] overflow-hidden flex flex-col font-sans selection:bg-white/20">
      
      {/* Background Ambient Glow matching state */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[150px] pointer-events-none transition-all duration-[2000ms] ease-in-out
        ${status === 'listening' ? 'bg-[#ff5500]/10 scale-110' : 
          status === 'thinking' ? 'bg-white/[0.03] scale-90' : 
          status === 'speaking' ? 'bg-white/[0.05] scale-100' : 
          'bg-white/[0.01] scale-100'}`} 
      />

      {/* Top Navigation HUD */}
      <div className="absolute top-8 left-8 right-8 flex items-start justify-between z-40 pointer-events-none">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-mono tracking-widest uppercase text-white/50">Core Online</span>
          </div>
          <span className="text-sm font-medium tracking-tight text-white/80">Shadow Protocol v2.4</span>
        </div>
        <div className="flex flex-col items-end gap-1 font-mono text-[10px] text-white/40 tracking-widest uppercase">
          <span>LAT: 19.4326° N</span>
          <span>LNG: 99.1332° W</span>
          <span>NET: SECURE</span>
        </div>
      </div>

      {/* Central Interface */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center mt-12">
        <motion.div 
          animate={{ scale: status === 'listening' ? 1.05 : 1 }}
          className="relative w-[300px] h-[300px] flex items-center justify-center"
        >
          {/* Decorative HUD Rings */}
          <div className="absolute inset-0 rounded-full border border-white/[0.02] m-4" />
          <div className="absolute inset-0 rounded-full border border-white/[0.05] border-t-white/[0.2] m-8 animate-[spin_10s_linear_infinite]" />
          
          <ShadowOrb status={status === 'listening' ? 'idle' : status} />
        </motion.div>

        {/* Live Subtitles / Context */}
        <div className="h-24 mt-12 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p 
              key={status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-2xl font-light tracking-tight text-white/70 max-w-2xl text-center px-8"
            >
              {status === 'idle' && "Awaiting instructions."}
              {status === 'listening' && <span className="text-[#ff5500]">Listening...</span>}
              {status === 'thinking' && "Parsing cognitive stream..."}
              {status === 'speaking' && "Executing."}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom HUD: Terminal & Input */}
      <div className="absolute bottom-8 left-8 right-8 z-30 flex items-end justify-between gap-8 pointer-events-none">
        
        {/* Left: Cognitive Flux Logs */}
        <div className="w-[300px] h-[150px] flex flex-col justify-end relative">
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-[#000]/50 to-[#000] z-10" />
          <div className="flex flex-col gap-1.5 font-mono text-[10px] text-white/40 overflow-hidden relative z-0 pr-4 pb-2">
            {logs.slice(-6).map((log, i) => (
              <div key={i} className={`truncate ${log.startsWith('[SHDW]') ? 'text-white/80' : log.startsWith('[ERR]') ? 'text-red-500' : ''}`}>
                {log}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Center: Command Input */}
        <div className="flex-1 max-w-xl pb-2 pointer-events-auto">
          <form onSubmit={handleCommandSubmit} className="relative group">
            <div className="absolute inset-0 bg-white/[0.02] rounded-2xl transition-colors group-hover:bg-white/[0.04]" />
            <div className="absolute inset-0 rounded-2xl border border-white/[0.05] group-focus-within:border-white/[0.15] transition-colors" />
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Initialize command sequence..." 
              className="w-full bg-transparent border-none outline-none text-base text-[#ededed] px-6 py-4 placeholder:text-white/20"
              disabled={status === 'thinking'}
            />
            <button 
              type="button"
              onClick={() => setStatus(status === 'listening' ? 'idle' : 'listening')}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-colors ${status === 'listening' ? 'bg-[#ff5500]/20 text-[#ff5500]' : 'text-white/30 hover:bg-white/[0.05] hover:text-white/80'}`}
            >
              <Wand2 className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right: Metrics */}
        <div className="w-[300px] flex flex-col items-end gap-2 pb-4">
           <div className="flex items-center gap-4 text-[10px] font-mono text-white/30">
             <div className="flex flex-col items-end">
               <span className="uppercase tracking-widest">Memory</span>
               <span className="text-white/80">32.4 GB</span>
             </div>
             <div className="h-6 w-[1px] bg-white/[0.05]" />
             <div className="flex flex-col items-end">
               <span className="uppercase tracking-widest">Latency</span>
               <span className="text-white/80 text-green-400">12ms</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
