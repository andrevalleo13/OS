"use client";

import { useState } from "react";
import ShadowOrb from "@/components/ShadowOrb";
import { Activity, Wand2, MessageSquare, ChevronRight } from "lucide-react";

export default function ShadowPage() {
  const [status, setStatus] = useState<'idle' | 'thinking' | 'speaking'>('idle');
  const [inputValue, setInputValue] = useState('');
  const [logs, setLogs] = useState([
    "[10:45:01] System boot complete.",
    "[10:45:03] Injecting memory indices... OK.",
    "[10:45:04] Polling biometrics sensors... OK.",
    "[10:46:12] User presence detected. Awaiting input."
  ]);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Simulate AI Interaction
    const command = inputValue;
    setInputValue('');
    setStatus('thinking');
    
    setLogs(prev => [...prev, `[USER] ${command}`]);
    
    setTimeout(() => {
      setLogs(prev => [...prev, `[SHADOW] Analyzing request semantics...`]);
    }, 500);

    // After 2.5s of "thinking", transition to "speaking"
    setTimeout(() => {
      setStatus('speaking');
      setLogs(prev => [...prev, `[SHADOW] Executing parameters. Integrating with ValleOS core.`]);
      
      // Stop speaking after 3s
      setTimeout(() => {
        setStatus('idle');
        setLogs(prev => [...prev, `[SHADOW] Task complete. Returning to idle state.`]);
      }, 3000);
    }, 2500);
  };
  return (
    <div className="w-full h-full flex flex-col pt-8">

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1">
        
        {/* Main Orb Display (Centerpiece) */}
        <div className="md:col-span-2 lg:col-span-2 row-span-2 bg-[#0a0a0a]/50 border border-[#1a1a1a] rounded-[32px] shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 z-10" />
          </div>
          
          <div className="w-full h-full min-h-[400px] relative z-0 flex items-center justify-center">
             <div className="w-[180px] h-[180px] relative">
               <ShadowOrb status={status} />
             </div>
          </div>

          <div className="absolute bottom-6 left-8 right-8 z-20">
            <form onSubmit={handleCommandSubmit} className="w-full bg-[#111]/80 backdrop-blur-md border border-[#222] rounded-full p-1.5 flex items-center focus-within:border-[#555] transition-colors shadow-lg">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a command or question..." 
                className="flex-1 bg-transparent border-none outline-none text-sm text-[#ededed] px-4 placeholder:text-[#555]"
                disabled={status !== 'idle'}
              />
              <button 
                type="submit"
                disabled={!inputValue.trim() || status !== 'idle'}
                className="w-8 h-8 rounded-full bg-[#333] text-white flex items-center justify-center hover:bg-[#555] disabled:opacity-50 disabled:hover:bg-[#333] transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* System Logs / Thoughts */}
        <div className="md:col-span-1 lg:col-span-2 row-span-2 bg-[#0a0a0a]/50 border border-[#1a1a1a] rounded-[32px] p-6 flex flex-col">
           <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-gray-500" />
             <h2 className="text-sm font-medium text-[#888]">Cognitive Stream</h2>
           </div>
           <div className="flex-1 flex flex-col gap-3 font-mono text-xs overflow-hidden relative">
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0a] z-10 pointer-events-none" />
             {logs.map((log, idx) => (
               <div key={idx} className={log.startsWith('[USER]') ? 'text-white' : log.startsWith('[SHADOW]') ? 'text-green-500' : 'text-[#555]'}>
                 {log}
               </div>
             ))}
           </div>
        </div>

      </div>
    </div>
  );
}
