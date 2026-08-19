"use client";

import { Bell, SkipBack, SkipForward, Play, Pause } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useUIStore } from "@/store/useUIStore";
import useSWR, { useSWRConfig } from "swr";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

gsap.registerPlugin(useGSAP);

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function MusicIsland({ music }: { music: any }) {
  const [isHovered, setIsHovered] = useState(false);
  const { mutate } = useSWRConfig();

  const handleControl = async (e: React.MouseEvent, action: string) => {
    e.stopPropagation();
    try {
      await fetch('/api/music/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      mutate("/api/music");
    } catch (err) {
      console.error(err);
    }
  };

  if (!music || !music.albumArt || music.albumArt === '') return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex items-center bg-[#111]/80 backdrop-blur-xl border border-[#222] rounded-full p-1.5 shadow-2xl cursor-pointer hover:bg-[#1a1a1a] transition-colors overflow-hidden"
    >
      <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0">
        <img src={music.albumArt} alt="cover" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/20 rounded-full border border-white/10" />
      </div>
      
      <AnimatePresence mode="wait" initial={false}>
        {isHovered ? (
          <motion.div 
            key="controls"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex items-center gap-2 px-3 overflow-hidden whitespace-nowrap shrink-0"
          >
            <button onClick={(e) => handleControl(e, 'previous')} className="text-gray-400 hover:text-white p-1 transition-colors">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={(e) => handleControl(e, 'playpause')} className="text-white p-1 transition-transform active:scale-90">
              {music.playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
            </button>
            <button onClick={(e) => handleControl(e, 'next')} className="text-gray-400 hover:text-white p-1 transition-colors">
              <SkipForward className="w-4 h-4" />
            </button>
          </motion.div>
        ) : (
          music.playing && (
            <motion.div 
              key="eq"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="flex items-center justify-center pl-3 pr-2 overflow-hidden shrink-0"
            >
              <div className="flex items-end gap-[2px] h-3">
                 <motion.div className="w-[2px] bg-white rounded-t" animate={{ height: ["4px", "12px", "4px"] }} transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }} />
                 <motion.div className="w-[2px] bg-white rounded-t" animate={{ height: ["12px", "4px", "12px"] }} transition={{ duration: 0.6, repeat: Infinity, ease: "linear", delay: 0.2 }} />
                 <motion.div className="w-[2px] bg-white rounded-t" animate={{ height: ["6px", "10px", "6px"] }} transition={{ duration: 0.6, repeat: Infinity, ease: "linear", delay: 0.4 }} />
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SystemStatsIndicator({ sysStats }: { sysStats: any }) {
  const [isHovered, setIsHovered] = useState(false);

  // Mock total RAM for calculation (e.g. 16G)
  const usedRam = sysStats ? parseFloat(sysStats.ram) : 0;
  const totalRam = 16.0;
  const ramPercent = (usedRam / totalRam) * 100;
  
  const cpuPercent = sysStats ? sysStats.cpu : 0;

  return (
    <div 
      className="relative flex items-center h-full mr-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3 text-xs font-mono text-gray-500 cursor-default hover:text-gray-300 transition-colors">
        <div className="flex items-center gap-1">
          <span>CPU</span>
          <span className="text-gray-300">{sysStats ? `${sysStats.cpu}%` : '--%'}</span>
        </div>
        <div className="w-1 h-1 bg-[#333] rounded-full" />
        <div className="flex items-center gap-1">
          <span>RAM</span>
          <span className="text-gray-300">{sysStats ? sysStats.ram : '--G'}</span>
        </div>
      </div>

      <AnimatePresence>
        {isHovered && (
          <motion.div 
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full right-0 mt-3 w-56 bg-[#0a0a0a]/95 backdrop-blur-3xl border border-white/10 rounded-xl p-3.5 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.8)] z-50 flex flex-col gap-4 cursor-default"
          >
            {/* CPU Details */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] font-medium text-gray-300">Uso de CPU</span>
                <span className="text-[10px] text-gray-500 font-mono tracking-tight">{cpuPercent}%</span>
              </div>
              <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-white rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${cpuPercent}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                <span>ValleOS Core</span>
                <span>{100 - cpuPercent}% Libre</span>
              </div>
            </div>

            {/* RAM Details */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] font-medium text-gray-300">Memoria</span>
                <span className="text-[10px] text-gray-500 font-mono tracking-tight">{usedRam}GB / {totalRam}GB</span>
              </div>
              <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-white rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${ramPercent}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                <span>Chrome (2.1G)</span>
                <span>{(totalRam - usedRam).toFixed(1)}GB Libres</span>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Topbar() {
  const [time, setTime] = useState("");
  const isSidebarExpanded = useUIStore((state) => state.isSidebarExpanded);
  const topbarRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // Calculate page name from pathname
  const formatPageName = (path: string) => {
    if (path === '/') return 'Inicio';
    if (path.startsWith('/food')) return 'Nutrición';
    if (path.startsWith('/gym')) return 'Gimnasio';
    if (path.startsWith('/biometrics')) return 'Biometría';
    if (path.startsWith('/finances')) return 'Finanzas';
    if (path.startsWith('/shadow')) return 'Shadow';
    if (path.startsWith('/obsidian')) return 'Obsidian';
    const name = path.replace('/', '').replace('-', ' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  const pageName = formatPageName(pathname);

  // Poll system stats every 3 seconds
  const { data: sysStats } = useSWR("/api/system", fetcher, { 
    refreshInterval: 3000,
    revalidateOnFocus: true
  });

  // Poll music state (shares cache with MusicModule)
  const { data: music } = useSWR("/api/music", fetcher, { 
    refreshInterval: 2000,
  });

  useEffect(() => {
    // Set initial time
    setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useGSAP(() => {
    // Animate the left offset of the topbar to not overlap with the sidebar
    gsap.to(topbarRef.current, {
      left: isSidebarExpanded ? 240 + 32 : 64 + 32, // Sidebar width + 16px gap + 16px offset
      duration: 0.45,
      ease: "power3.inOut",
    });
  }, [isSidebarExpanded]);

  return (
    <header 
      ref={topbarRef} 
      className="fixed top-4 right-4 h-14 bg-[#0a0a0a]/90 backdrop-blur-2xl border border-[#1a1a1a] shadow-2xl shadow-black/50 rounded-[32px] flex items-center justify-between px-6 z-30"
    >
      
      {/* Breadcrumb / Status */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-200">{pageName}</span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-5">
        
        {/* Dynamic Island / Music Pill */}
        <AnimatePresence>
          {music && <MusicIsland music={music} />}
        </AnimatePresence>
        
        {/* Mini System Stats (Real Time with Hover Dropdown) */}
        <SystemStatsIndicator sysStats={sysStats} />

        <span className="text-sm font-mono text-gray-400 border-l border-[#222] pl-5">{time}</span>
        
        <button className="relative text-gray-400 hover:text-white transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#ff5500] rounded-full" />
        </button>
        
        {/* User Profile Pill */}
        <div className="flex items-center gap-2 bg-[#1a1a1a] pl-1 pr-3 py-1 rounded-full border border-[#222]">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#ff5500] to-purple-600" />
          <span className="text-xs font-mono text-gray-300">AV</span>
        </div>
      </div>

    </header>
  );
}

