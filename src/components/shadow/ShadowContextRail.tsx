"use client";

import Link from "next/link";
import { Activity, BrainCircuit, ChevronRight, Clock3, ShieldCheck, X } from "lucide-react";
import type { ShadowStatus } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  status: ShadowStatus;
  messageCount: number;
  title: string;
  pendingActions: number;
};

const STATUS_COPY: Record<ShadowStatus, { label: string; detail: string }> = {
  idle: { label: "Disponible", detail: "Esperando una instrucción" },
  listening: { label: "Escuchando", detail: "Capturando tu mensaje" },
  thinking: { label: "Procesando", detail: "Construyendo una respuesta" },
  speaking: { label: "Respondiendo", detail: "Entregando el resultado" },
  done: { label: "Listo", detail: "La tarea quedó resuelta" },
  warning: { label: "Atención", detail: "Hay algo que revisar" },
  error: { label: "Algo falló", detail: "No pude completar la solicitud" },
};

export function ShadowContextRail(props: Props) {
  return (
    <>
      <aside className="hidden w-[228px] shrink-0 border-l border-white/[0.055] xl:flex">
        <ContextContent {...props} />
      </aside>
      {props.open ? (
        <div className="fixed inset-0 z-[70] xl:hidden" role="dialog" aria-modal="true" aria-label="Contexto de Shadow">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={props.onClose} aria-label="Cerrar contexto" />
          <aside className="absolute bottom-3 right-3 top-3 flex w-[min(310px,calc(100vw-24px))] overflow-hidden rounded-[26px] border border-white/10 bg-[#0c0c0c]/98 shadow-2xl">
            <ContextContent {...props} compact />
          </aside>
        </div>
      ) : null}
    </>
  );
}

function ContextContent({ status, messageCount, title, pendingActions, compact, onClose }: Props & { compact?: boolean }) {
  const state = STATUS_COPY[status];
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-white/[0.009] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-white/65">Contexto activo</p>
          <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-white/23">{title}</p>
        </div>
        {compact ? <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/35 hover:bg-white/5 hover:text-white" aria-label="Cerrar contexto"><X className="h-4 w-4" /></button> : null}
      </div>

      <div className="mt-5 border-y border-white/[0.055] py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035]">
            <Activity className="h-3.5 w-3.5 text-white/50" />
            <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${status === "idle" ? "bg-white/35" : "animate-pulse bg-white/80"}`} />
          </span>
          <div>
            <p className="text-[10px] text-white/65">{state.label}</p>
            <p className="mt-0.5 text-[8px] text-white/22">{state.detail}</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/[0.045]">
        <Metric icon={Clock3} label="Mensajes en contexto" value={String(messageCount)} />
        <Metric icon={ShieldCheck} label="Acciones por aprobar" value={String(pendingActions)} />
        <Metric icon={BrainCircuit} label="Memoria global" value="Activa" />
      </div>

      <div className="mt-5">
        <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.16em] text-white/20">Núcleo de Shadow</p>
        <ContextLink href="/shadow/memory" icon={BrainCircuit} label="Memoria" description="Recuerdos y conexiones" />
        <ContextLink href="/shadow/autonomy" icon={ShieldCheck} label="Autonomía" description="Políticas y acciones" />
      </div>

      <div className="mt-auto rounded-2xl border border-white/[0.055] bg-white/[0.02] p-3">
        <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/25">Separación de contexto</p>
        <p className="mt-2 text-[9px] leading-relaxed text-white/30">Este chat conserva su propio hilo. La memoria personal de Shadow continúa disponible entre conversaciones.</p>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return <div className="flex items-center gap-3 py-3"><Icon className="h-3.5 w-3.5 text-white/22" /><span className="flex-1 text-[9px] text-white/30">{label}</span><span className="font-mono text-[9px] text-white/55">{value}</span></div>;
}

function ContextLink({ href, icon: Icon, label, description }: { href: string; icon: typeof Activity; label: string; description: string }) {
  return (
    <Link href={href} className="group mb-1 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.035] active:scale-[0.99]">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.055] bg-white/[0.025]"><Icon className="h-3.5 w-3.5 text-white/35" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[10px] text-white/55 group-hover:text-white/80">{label}</span><span className="mt-0.5 block text-[8px] text-white/20">{description}</span></span>
      <ChevronRight className="h-3 w-3 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-white/40" />
    </Link>
  );
}
