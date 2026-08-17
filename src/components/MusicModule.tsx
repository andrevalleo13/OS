"use client";

import { useRef, useState, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { motion, AnimatePresence } from "framer-motion";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MusicModule({ itemVariants, cardHover }: any) {
  const { data: music } = useSWR("/api/music", fetcher, { 
    refreshInterval: 2000,
    revalidateOnFocus: true
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [localPosition, setLocalPosition] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const playIconRef = useRef<HTMLDivElement>(null);

  const { mutate } = useSWRConfig();

  const handleMusicControl = async (action: string) => {
    if (action === 'playpause') setIsPlaying(!isPlaying);
    try {
      await fetch('/api/music/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      // Force an instant re-fetch to make UI feel instantaneous
      mutate("/api/music");
    } catch (e) {
      console.error(e);
    }
  };

  useGSAP(() => {
    if (!music) return;
    
    // Sync play state
    if (music.playing !== isPlaying) {
      setIsPlaying(music.playing);
    }

    if (music.track) {
      setCurrentTrack(music);
      
      // Smoothly animate the diffuse background glow
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          backgroundColor: music.dominantColor || '#fa243c',
          duration: 1.5,
          ease: "power2.out"
        });
      }
    } else if (!music.track && currentTrack) {
      setCurrentTrack(null);
    }
  }, [music?.track, music?.playing]);

  // Sync local position when music data arrives
  useEffect(() => {
    if (music?.position !== undefined) {
      setLocalPosition(music.position);
    }
  }, [music?.position]);

  // Tick the local position every 1s for "live" UI feel
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setLocalPosition((prev) => {
        if (music?.duration && prev >= music.duration) return prev;
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, music?.duration]);

  // Helper for time formatting
  const formatTime = (seconds: number) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <motion.div 
      variants={itemVariants}
      whileHover={cardHover}
      className="col-span-1 bg-[#0a0a0a] border border-[#222] rounded-[24px] p-6 flex flex-col justify-between cursor-pointer relative overflow-hidden group"
      ref={containerRef}
    >
      {/* Vercel-style huge soft orb (instead of messy blur) */}
      <div 
        ref={glowRef}
        className="absolute -top-20 -right-20 w-72 h-72 blur-[100px] rounded-full opacity-30 pointer-events-none transition-opacity duration-1000 group-hover:opacity-40"
        style={{ backgroundColor: currentTrack?.dominantColor || '#fa243c' }} 
      />
      
      <div className="z-10 flex items-center justify-between mb-8">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#666]">
          {music?.playing ? "Now Playing" : "Offline"}
        </span>
        <div className="flex gap-1 items-center h-3 overflow-hidden">
          {/* Subtle Equalizer */}
          <motion.div animate={{ height: isPlaying ? [4, 10, 4] : 2 }} transition={{ repeat: isPlaying ? Infinity : 0, duration: 1 }} className="w-0.5 rounded-full bg-white/40" />
          <motion.div animate={{ height: isPlaying ? [6, 12, 6] : 2 }} transition={{ repeat: isPlaying ? Infinity : 0, duration: 1.2, delay: 0.1 }} className="w-0.5 rounded-full bg-white/40" />
          <motion.div animate={{ height: isPlaying ? [4, 8, 4] : 2 }} transition={{ repeat: isPlaying ? Infinity : 0, duration: 0.8, delay: 0.2 }} className="w-0.5 rounded-full bg-white/40" />
        </div>
      </div>
      
      <div className="z-10 mt-auto flex flex-col gap-6">
        {currentTrack ? (
          <>
            <div className="flex items-center gap-4">
              {/* Actual Album Cover with PopLayout Transition */}
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-[#333] shadow-2xl bg-[#111] relative">
                <AnimatePresence mode="popLayout">
                  {currentTrack.albumArt && (
                    <motion.img 
                      key={currentTrack.albumArt}
                      src={currentTrack.albumArt} 
                      alt="Cover" 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "circOut" }}
                      className="absolute inset-0 w-full h-full object-cover" 
                    />
                  )}
                </AnimatePresence>
              </div>
              
              {/* Mask Reveal Text Container with PopLayout */}
              <div className="flex flex-col min-w-0 flex-1 py-1 relative">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={currentTrack.track}
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -15, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "circOut" }}
                  >
                    <div className="text-[19px] font-semibold tracking-tight text-[#ededed] truncate leading-tight">
                      {currentTrack.track}
                    </div>
                    <div className="text-sm text-[#888] truncate mt-0.5">
                      {currentTrack.artist}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              {/* Minimalist Matte Progress Bar */}
              <div className="w-full bg-[#222] h-[3px] rounded-full overflow-hidden relative">
                <div 
                  className="h-full absolute left-0 top-0 transition-all duration-[1000ms] ease-linear rounded-full" 
                  style={{ 
                    width: `${music.duration ? (localPosition / music.duration) * 100 : 0}%`,
                    backgroundColor: currentTrack.dominantColor || '#fff'
                  }} 
                />
              </div>
              
              {/* Controls & Timers */}
              <div className="flex items-center justify-between">
                 <div className="text-[10px] font-mono text-[#666] w-8">
                    {formatTime(localPosition)}
                 </div>
                 
                 <div className="flex items-center gap-6">
                  <button onClick={(e) => { e.stopPropagation(); handleMusicControl('previous'); }} className="text-[#666] hover:text-[#ededed] transition-colors active:scale-90">
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleMusicControl('playpause'); }} className="text-[#ededed] hover:scale-110 active:scale-95 transition-transform">
                    {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleMusicControl('next'); }} className="text-[#666] hover:text-[#ededed] transition-colors active:scale-90">
                    <SkipForward className="w-4 h-4" />
                  </button>
                 </div>

                 <div className="text-[10px] font-mono text-[#666] w-8 text-right">
                    -{formatTime(music.duration - localPosition)}
                 </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1 pb-2">
            <div className="text-xl font-medium tracking-tight text-[#555]">Not Playing</div>
            <div className="text-sm text-[#777]">Open Music app to start</div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
