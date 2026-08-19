"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Mic, MicOff, CloudRain, Sun, Moon } from "lucide-react";
import { WidgetCard, useWidget } from "@/components/ui/widget";
import { useWakeWord } from "@/hooks/useWakeWord";

export default function ShadowWidget() {
  const [greeting, setGreeting] = useState("Initializing systems...");
  const [weather, setWeather] = useState<{ temp: number, isDay: boolean, desc: string } | null>(null);
  
  const { activeWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "shadow";
  const isShrunk = activeWidgetId !== null && activeWidgetId !== "shadow";
  
  const { isListening, setIsListening, transcript } = useWakeWord();

  // 1. Context Awareness: Get Location & Weather
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
          const data = await res.json();
          if (data.current_weather) {
            setWeather({
              temp: Math.round(data.current_weather.temperature),
              isDay: data.current_weather.is_day === 1,
              desc: "Clear" // Open-meteo has weathercodes we could map, keeping it simple
            });
          }
        } catch (error) {
          console.error("Failed to fetch weather", error);
        }
      }, () => {
        console.warn("Geolocation denied");
      });
    }
  }, []);

  // 2. Dynamic Greeting based on Context
  useEffect(() => {
    const hour = new Date().getHours();
    let timeGreeting = "";
    if (hour >= 5 && hour < 12) timeGreeting = "Good morning.";
    else if (hour >= 12 && hour < 18) timeGreeting = "Good afternoon.";
    else if (hour >= 18 && hour < 22) timeGreeting = "Good evening.";
    else timeGreeting = "Late night.";

    const weatherContext = weather ? ` ${weather.temp}°C outside.` : "";
    setGreeting(`${timeGreeting}${weatherContext} Awaiting instructions.`);
  }, [weather]);

  // Global Keyboard Shortcut (Fallback)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && e.metaKey) {
        e.preventDefault();
        // The widget expands automatically because we dispatch an event, 
        // wait, let's just let the div handle it below or use document event listener.
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <WidgetCard 
      id="shadow"
      defaultClassName="col-span-1 lg:col-span-4 flex flex-col items-center justify-center min-h-[280px]"
      expandedClassName="col-span-1 lg:col-span-4 flex flex-col items-center justify-center min-h-[400px]"
      shrunkClassName="col-span-1 lg:col-span-4 flex flex-col items-center justify-center min-h-[140px]"
      onClick={() => {
        // Expand manually if clicked
        // Also ensure microphone is listening if we expand manually
      }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      {/* Ambient glow behind the core */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] blur-[100px] rounded-full pointer-events-none transition-colors duration-1000 ${
        isExpanded ? 'bg-[#ffffff08]' : 'bg-white/[0.015] group-hover:bg-white/[0.03]'
      }`} />
      
      {/* Mic Toggle Button */}
      <div className="absolute top-6 right-6 z-20">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsListening(!isListening);
          }}
          className={`p-2.5 rounded-full border transition-all ${
            isListening 
              ? 'bg-red-500/10 border-red-500/20 text-red-400' 
              : 'bg-white/[0.02] border-white/[0.05] text-[#555] hover:text-[#ededed]'
          }`}
        >
          {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>
      </div>

      {/* The Core / Face of Shadow */}
      <motion.div layout className={`relative z-10 flex flex-col items-center ${isShrunk ? 'gap-4' : 'gap-8'} w-full`}>
        <motion.div 
          animate={{ 
            scale: isExpanded ? [1.2, 1.3, 1.2] : [1, 1.05, 1], 
            opacity: [0.7, 1, 0.7] 
          }}
          transition={{ repeat: Infinity, duration: isExpanded ? 2 : 4, ease: "easeInOut" }}
          className={`relative ${isShrunk ? 'w-12 h-12' : (isExpanded ? 'w-32 h-32' : 'w-24 h-24')} transition-all duration-500 rounded-full bg-black border border-white/[0.08] flex items-center justify-center overflow-hidden shadow-[0_0_60px_rgba(255,255,255,0.03)]`}
        >
          {/* Inner precision rings */}
          <div className="absolute inset-0 border border-white/[0.04] rounded-full m-2" />
          <div className={`absolute inset-0 border border-white/[0.02] rounded-full ${isShrunk ? 'm-3' : 'm-5'}`} />
          
          {/* The eye/pulse */}
          <motion.div 
            animate={{ 
              scale: isExpanded ? [1, 1.5, 1] : [1, 1.3, 1], 
              opacity: [0.6, 1, 0.6] 
            }}
            transition={{ repeat: Infinity, duration: isExpanded ? 1 : 2, ease: "easeInOut" }}
            className={`rounded-full ${
              isExpanded ? 'bg-white shadow-[0_0_40px_#ffffff]' : 'bg-[#ededed] shadow-[0_0_20px_#ffffff]'
            } ${isShrunk ? 'w-1.5 h-1.5' : 'w-2.5 h-2.5'}`}
          />
        </motion.div>

        {/* Text Area */}
        <motion.div layout className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-1 h-1 rounded-full animate-pulse ${isExpanded ? 'bg-red-500' : 'bg-[#888]'}`} />
            <span className={`font-mono text-[10px] uppercase tracking-[0.3em] ${isExpanded ? 'text-red-400' : 'text-[#666]'}`}>
              {isExpanded ? 'Listening...' : (isListening ? 'Awaiting Wake Word' : 'Shadow Protocol Inactive')}
            </span>
          </div>
          
          <AnimatePresence mode="wait">
            {!isShrunk && (
              <motion.div 
                key={isExpanded ? 'transcript' : 'greeting'}
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className={`text-center mt-1 ${isExpanded ? 'text-2xl lg:text-3xl font-medium' : 'text-3xl lg:text-4xl font-light'} tracking-tight text-[#ededed] max-w-2xl px-4`}
              >
                {isExpanded ? (transcript || "...") : greeting}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Command Prompt Hint */}
      <AnimatePresence>
        {!isShrunk && !isExpanded && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-8 right-10 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#555]">
              {isListening ? "Say 'Shadow'" : "Click to activate"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </WidgetCard>
  );
}
