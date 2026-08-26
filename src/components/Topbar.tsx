"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, ChevronRight, CircleAlert, Mic, MicOff, Pause, Play, Search, Server, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useUIStore } from "@/store/useUIStore";
import { useShadowVoice } from "@/components/shadow/ShadowVoiceProvider";

type SystemStats = { cpu: number; ram: string; totalRam?: string };
type ReadyState = { status: "ready" | "degraded"; checks: Record<string, boolean> };
type MusicState = { playing?: boolean; albumArt?: string; title?: string; artist?: string };

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok && response.status !== 503) throw new Error(body?.message ?? `Error ${response.status}`);
  return body;
};

const pageNames: Record<string, string> = {
  "/": "Centro de mando",
  "/calendar": "Calendario",
  "/shadow": "Shadow",
  "/shadow/memory": "Memoria",
  "/shadow/autonomy": "Autonomía",
  "/biometrics": "Biometría",
  "/obsidian": "Obsidian",
  "/gym": "Gimnasio",
  "/food": "Nutrición",
  "/uni": "Universidad",
  "/finances": "Finanzas",
  "/settings": "Ajustes",
};

export default function Topbar() {
  const voice = useShadowVoice();
  const pathname = usePathname();
  const isSidebarExpanded = useUIStore((state) => state.isSidebarExpanded);
  const showSystemMetrics = useUIStore((state) => state.showSystemMetrics);
  const showStatusDetails = useUIStore((state) => state.showStatusDetails);
  const [time, setTime] = useState("");
  const [centerOpen, setCenterOpen] = useState(false);
  const { data: stats } = useSWR<SystemStats>("/api/system", fetcher, { refreshInterval: 5000, keepPreviousData: true });
  const { data: ready, isLoading: readyLoading } = useSWR<ReadyState>("/api/ready", fetcher, { refreshInterval: 30000, shouldRetryOnError: false });
  const { data: music } = useSWR<MusicState>("/api/music", fetcher, { refreshInterval: 2500, shouldRetryOnError: false });

  useEffect(() => {
    const update = () => setTime(new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setCenterOpen(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  const pageName = pageNames[pathname] ?? pageNames[Object.keys(pageNames).find((key) => key !== "/" && pathname.startsWith(`${key}/`)) ?? ""] ?? "ValleOS";
  const healthy = ready?.status === "ready";
  const openPalette = () => document.dispatchEvent(new CustomEvent("valleos:command-palette"));
  const voiceActive = voice.enabled && voice.phase !== "blocked" && voice.phase !== "unsupported";
  const voiceLabel = voice.phase === "listening" ? "Escuchando" : voice.phase === "processing" ? "Pensando" : voice.phase === "speaking" ? "Hablando" : voiceActive ? "Voz activa" : "Voz pausada";

  return (
    <header className={`os-surface fixed left-3 right-3 top-3 z-40 flex h-14 items-center justify-between rounded-[22px] px-3 transition-[left] duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] sm:right-4 sm:top-4 sm:px-4 ${isSidebarExpanded ? "md:left-[272px]" : "md:left-[96px]"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${readyLoading ? "animate-pulse bg-white/25" : healthy ? "bg-white/60" : "bg-white/25"}`} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-white/90">{pageName}</p>
          {showStatusDetails && <p className="hidden font-mono text-[8px] uppercase tracking-[0.18em] text-white/25 sm:block">{healthy ? "Todos los sistemas nominales" : "Revisión requerida"}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {music?.albumArt && <MusicPill music={music} />}

        <button
          type="button"
          onClick={voice.phase === "blocked" ? voice.listenNow : voice.toggleEnabled}
          className={`flex h-9 items-center gap-2 rounded-xl border px-2.5 text-[10px] transition active:scale-[0.98] ${voiceActive ? "border-white/[0.1] bg-white/[0.055] text-white/70" : "border-white/[0.06] bg-white/[0.02] text-white/30 hover:text-white/60"}`}
          aria-label={voiceActive ? "Pausar la escucha de Shadow" : "Activar la escucha de Shadow"}
          title={voice.error ?? "Shadow escucha la palabra de activación mientras ValleOS está abierto"}
        >
          {voiceActive ? <Mic className={`h-3.5 w-3.5 ${voice.phase === "listening" ? "animate-pulse" : ""}`} /> : <MicOff className="h-3.5 w-3.5" />}
          <span className="hidden xl:inline">{voiceLabel}</span>
        </button>

        <button type="button" onClick={openPalette} className="hidden h-9 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 text-[11px] text-white/40 transition hover:bg-white/[0.05] hover:text-white/75 active:scale-[0.98] sm:flex" aria-label="Abrir paleta de comandos">
          <Search className="h-3.5 w-3.5" />
          <span>Comandos</span>
          <kbd className="ml-1 font-mono text-[9px] text-white/20">⌘K</kbd>
        </button>

        <div className={`${showSystemMetrics ? "hidden lg:flex" : "hidden"} items-center gap-2 border-l border-white/[0.06] pl-3`}>
          <span className="font-mono text-[9px] text-white/25">CPU</span>
          <span className="font-mono text-[10px] text-white/65">{stats ? `${stats.cpu}%` : "—"}</span>
          <span className="ml-1 font-mono text-[9px] text-white/25">RAM</span>
          <span className="font-mono text-[10px] text-white/65">{stats?.ram ?? "—"}</span>
        </div>

        <span className="hidden min-w-11 border-l border-white/[0.06] pl-3 text-center font-mono text-[11px] text-white/45 sm:block">{time}</span>

        <div className="relative">
          <button type="button" onClick={() => setCenterOpen((open) => !open)} className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition active:scale-95 ${centerOpen ? "bg-white/[0.08] text-white" : "text-white/40 hover:bg-white/[0.04] hover:text-white/80"}`} aria-label="Abrir centro del sistema" aria-expanded={centerOpen}>
            <Bell className="h-4 w-4" />
            {!healthy && !readyLoading && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />}
          </button>
          <AnimatePresence>{centerOpen && <SystemCenter ready={ready} stats={stats} onClose={() => setCenterOpen(false)} />}</AnimatePresence>
        </div>

        <Link href="/settings" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.035] font-mono text-[10px] text-white/65 transition hover:border-white/[0.12] hover:text-white active:scale-95" aria-label="Abrir ajustes">AV</Link>
      </div>
    </header>
  );
}

function MusicPill({ music }: { music: MusicState }) {
  const { mutate } = useSWRConfig();
  const control = async () => {
    await fetch("/api/music/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "playpause" }) });
    await mutate("/api/music");
  };
  return (
    <button type="button" onClick={control} className="hidden h-9 max-w-44 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] p-1 pr-3 transition hover:bg-white/[0.05] active:scale-[0.98] xl:flex" aria-label={music.playing ? "Pausar música" : "Reproducir música"}>
      <img src={music.albumArt} alt="" className="h-7 w-7 rounded-lg object-cover" />
      <span className="min-w-0 flex-1 truncate text-left text-[10px] text-white/55">{music.title ?? music.artist ?? "Música"}</span>
      {music.playing ? <Pause className="h-3 w-3 text-white/65" /> : <Play className="h-3 w-3 text-white/65" />}
    </button>
  );
}

function SystemCenter({ ready, stats, onClose }: { ready?: ReadyState; stats?: SystemStats; onClose: () => void }) {
  const checks = ready?.checks ? Object.entries(ready.checks) : [];
  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} className="os-surface absolute right-0 top-12 w-[min(330px,calc(100vw-24px))] rounded-2xl p-4 shadow-2xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium">Centro del sistema</p>
          <p className="mt-1 text-[11px] text-white/35">Estado local y conexiones de ValleOS.</p>
        </div>
        <div className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-white/50">{ready?.status === "ready" ? "Nominal" : "Degradado"}</div>
      </div>
      <div className="mt-4 grid grid-cols-2 divide-x divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02] py-3">
        <Metric label="CPU" value={stats ? `${stats.cpu}%` : "—"} />
        <Metric label="Memoria" value={stats?.ram ?? "—"} />
      </div>
      <div className="mt-4 divide-y divide-white/[0.055] border-y border-white/[0.055]">
        {checks.length === 0 ? <p className="py-4 text-xs text-white/30">Comprobando servicios…</p> : checks.map(([name, ok]) => (
          <div key={name} className="flex items-center gap-3 py-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.035] text-white/45">{ok ? <Check className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}</span>
            <span className="flex-1 text-[11px] capitalize text-white/55">{name.replace(/([A-Z])/g, " $1")}</span>
            <span className="font-mono text-[8px] uppercase tracking-wider text-white/20">{ok ? "Conectado" : "Revisar"}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href="/shadow/autonomy" onClick={onClose} className="flex h-9 items-center justify-between rounded-xl bg-white/[0.035] px-3 text-[10px] text-white/50 transition hover:bg-white/[0.06] hover:text-white"><span className="flex items-center gap-2"><Server className="h-3.5 w-3.5" /> Autonomía</span><ChevronRight className="h-3 w-3" /></Link>
        <Link href="/settings" onClick={onClose} className="flex h-9 items-center justify-between rounded-xl bg-white/[0.035] px-3 text-[10px] text-white/50 transition hover:bg-white/[0.06] hover:text-white"><span className="flex items-center gap-2"><Settings2 className="h-3.5 w-3.5" /> Ajustes</span><ChevronRight className="h-3 w-3" /></Link>
      </div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="px-3"><p className="font-mono text-[8px] uppercase tracking-widest text-white/25">{label}</p><p className="mt-1 text-lg font-medium tracking-[-0.04em] text-white/80">{value}</p></div>;
}
