"use client";

import { memo, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import useSWR, { useSWRConfig } from "swr";
import { WidgetCard, useWidget } from "@/components/ui/widget";

type MusicState = {
  playing?: boolean;
  track?: string;
  title?: string;
  artist?: string;
  duration?: number;
  position?: number;
};

const fetcher = async (url: string): Promise<MusicState> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Música no disponible");
  return response.json();
};

export default function MusicModule() {
  const { data: music, error, isLoading } = useSWR<MusicState>("/api/music", fetcher, { refreshInterval: 2_500, shouldRetryOnError: false });
  const { mutate } = useSWRConfig();
  const { activeWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "music";
  const [localPosition, setLocalPosition] = useState(0);
  const isPlaying = Boolean(music?.playing);
  const title = music?.track || music?.title;

  useEffect(() => setLocalPosition(music?.position ?? 0), [music?.position]);
  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => setLocalPosition((position) => Math.min(music?.duration ?? position + 1, position + 1)), 1_000);
    return () => window.clearInterval(interval);
  }, [isPlaying, music?.duration]);

  const control = async (action: "previous" | "playpause" | "next") => {
    await fetch("/api/music/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    await mutate("/api/music");
  };

  const duration = music?.duration ?? 0;
  const progress = duration > 0 ? Math.min(1, localPosition / duration) : 0;

  return (
    <WidgetCard id="music" defaultClassName="min-h-[132px] md:col-span-6 xl:col-span-12" expandedClassName="min-h-[240px] md:col-span-6 xl:col-span-12" shrunkClassName="min-h-[112px] md:col-span-6 xl:col-span-12">
      <div className="relative z-10 grid h-full items-center gap-5 sm:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.065] bg-white/[0.025]">{isPlaying ? <Equalizer /> : <Music2 className="h-4 w-4 text-white/30" />}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${isPlaying ? "bg-white/55" : "bg-white/15"}`} /><p className="font-mono text-[8px] uppercase tracking-[0.17em] text-white/25">{isLoading ? "Conectando" : error ? "No disponible" : isPlaying ? "Reproduciendo" : "Música"}</p></div>
            <p className="mt-1.5 truncate text-[13px] font-medium text-white/65">{title || "Nada reproduciéndose"}</p>
            <p className="mt-0.5 truncate text-[10px] text-white/25">{music?.artist || "Abre Música para comenzar"}</p>
          </div>
        </div>

        <div data-no-expand className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => void control("previous")} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/25 transition hover:bg-white/[0.05] hover:text-white/60 active:scale-90" aria-label="Pista anterior"><SkipBack className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => void control("playpause")} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#111] transition hover:bg-white/90 active:scale-[0.95]" aria-label={isPlaying ? "Pausar" : "Reproducir"}>{isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}</button>
          <button type="button" onClick={() => void control("next")} className="flex h-9 w-9 items-center justify-center rounded-xl text-white/25 transition hover:bg-white/[0.05] hover:text-white/60 active:scale-90" aria-label="Siguiente pista"><SkipForward className="h-3.5 w-3.5" /></button>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="sm:col-span-2">
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.045]"><motion.div animate={{ scaleX: progress }} transition={{ duration: 0.25, ease: "linear" }} style={{ transformOrigin: "left" }} className="h-full w-full rounded-full bg-white/45" /></div>
              <div className="mt-2 flex justify-between font-mono text-[8px] text-white/20"><span>{formatTime(localPosition)}</span><span>−{formatTime(Math.max(0, duration - localPosition))}</span></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </WidgetCard>
  );
}

const Equalizer = memo(function Equalizer() {
  return <div className="flex h-4 items-center gap-[3px]" aria-hidden>{[0.7, 1, 0.55].map((scale, index) => <motion.span key={scale} animate={{ scaleY: [0.3, scale, 0.3] }} transition={{ repeat: Infinity, duration: 0.85 + index * 0.14, ease: "easeInOut" }} className="h-4 w-[2px] rounded-full bg-white/55" />)}</div>;
});

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}
