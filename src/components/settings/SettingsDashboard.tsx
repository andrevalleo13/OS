"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import {
  Activity,
  BookOpen,
  ChevronRight,
  CircleCheck,
  CircleX,
  Component,
  ExternalLink,
  Layers,
  LayoutDashboard,
  Link2,
  Monitor,
  RefreshCw,
  Rocket,
  RotateCcw,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";

type ReadyState = { status: "ready" | "degraded"; checks: Record<string, boolean> };
type SystemStats = { cpu: number; ram: string; totalRam?: string };
type SectionId = "overview" | "interface" | "shadow" | "connections" | "system";

const sections: Array<{ id: SectionId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Resumen", icon: LayoutDashboard },
  { id: "interface", label: "Interfaz", icon: SlidersHorizontal },
  { id: "shadow", label: "Shadow", icon: Component },
  { id: "connections", label: "Conexiones", icon: Link2 },
  { id: "system", label: "Sistema", icon: Activity },
];

const checkLabels: Record<string, string> = {
  database: "Base de datos",
  vault: "Obsidian Vault",
  anthropicConfigured: "Motor de lenguaje",
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok && response.status !== 503) throw new Error("No disponible");
  return body;
};

export default function SettingsDashboard() {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const compactMode = useUIStore((state) => state.compactMode);
  const reducedMotion = useUIStore((state) => state.reducedMotion);
  const isSidebarExpanded = useUIStore((state) => state.isSidebarExpanded);
  const showSystemMetrics = useUIStore((state) => state.showSystemMetrics);
  const showStatusDetails = useUIStore((state) => state.showStatusDetails);
  const setCompactMode = useUIStore((state) => state.setCompactMode);
  const setReducedMotion = useUIStore((state) => state.setReducedMotion);
  const setSidebarExpanded = useUIStore((state) => state.setSidebarExpanded);
  const setShowSystemMetrics = useUIStore((state) => state.setShowSystemMetrics);
  const setShowStatusDetails = useUIStore((state) => state.setShowStatusDetails);
  const resetInterfacePreferences = useUIStore((state) => state.resetInterfacePreferences);
  const ready = useSWR<ReadyState>("/api/ready", fetcher, { refreshInterval: 30000, shouldRetryOnError: false });
  const system = useSWR<SystemStats>("/api/system", fetcher, { refreshInterval: 5000, shouldRetryOnError: false });

  const refresh = async () => Promise.all([ready.mutate(), system.mutate()]);
  const openPalette = () => document.dispatchEvent(new CustomEvent("valleos:command-palette"));

  return (
    <main className="os-page mx-auto w-full max-w-[1240px] py-4 md:py-7">
      <div className="grid min-h-[680px] overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#0d0d0d]/88 lg:grid-cols-[212px_minmax(0,1fr)]">
        <nav className="border-b border-white/[0.06] p-2 lg:border-b-0 lg:border-r" aria-label="Secciones de ajustes">
          <div className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5">
            {sections.map((section) => {
              const Icon = section.icon;
              const active = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-3 text-[11px] transition active:scale-[0.98] lg:w-full ${active ? "bg-white/[0.07] text-white/85" : "text-white/35 hover:bg-white/[0.035] hover:text-white/65"}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {section.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 hidden border-t border-white/[0.055] px-3 pt-4 lg:block">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/20">Runtime local</p>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-white/35">
              <span className={`h-1.5 w-1.5 rounded-full ${ready.data?.status === "ready" ? "bg-white/65" : "bg-white/25"}`} />
              {ready.isLoading ? "Comprobando" : ready.data?.status === "ready" ? "Operativo" : "Revisión requerida"}
            </div>
          </div>
        </nav>

        <div className="min-w-0 p-4 sm:p-6 lg:p-8">
          {activeSection === "overview" && (
            <SettingsSection title="Resumen operativo" description="Estado actual, accesos críticos y señales del backend.">
              <RuntimeStrip ready={ready.data} stats={system.data} loading={ready.isLoading || system.isLoading} />

              <SettingsGroup title="Control rápido" description="Los núcleos avanzados viven aquí, fuera de la navegación principal.">
                <ControlLink href="/shadow/memory" icon={<BookOpen />} title="Memoria" description="Indexación, hechos, entidades, relaciones y revisiones." meta="Administrar" />
                <ControlLink href="/shadow/autonomy" icon={<Rocket />} title="Autonomía" description="Política, patrones, aprobaciones y cola de ejecución." meta="Administrar" />
                <ActionRow icon={<LayoutDashboard />} title="Paleta de comandos" description="Busca módulos y ejecuta acciones sin cambiar de contexto." action="Abrir" onClick={openPalette} />
              </SettingsGroup>

              <SettingsGroup title="Salud del núcleo" description="Verificación local actualizada cada treinta segundos." action={<RefreshButton loading={ready.isValidating || system.isValidating} onClick={refresh} />}>
                <HealthRows ready={ready.data} loading={ready.isLoading} error={Boolean(ready.error)} />
              </SettingsGroup>
            </SettingsSection>
          )}

          {activeSection === "interface" && (
            <SettingsSection title="Interfaz" description="Preferencias persistentes aplicadas directamente al shell de ValleOS." aside={<button type="button" onClick={resetInterfacePreferences} className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/[0.07] px-2.5 text-[9px] text-white/35 transition hover:bg-white/[0.04] hover:text-white/65 active:scale-[0.98]"><RotateCcw /> Restaurar</button>}>
              <SettingsGroup title="Navegación" description="Estructura y densidad del espacio de trabajo.">
                <ToggleRow icon={<Layers />} title="Sidebar expandida" description="Muestra etiquetas junto a los iconos en escritorio." enabled={isSidebarExpanded} onChange={setSidebarExpanded} />
                <ToggleRow icon={<SlidersHorizontal />} title="Modo compacto" description="Reduce el espaciado de páginas y módulos operativos." enabled={compactMode} onChange={setCompactMode} />
              </SettingsGroup>

              <SettingsGroup title="Topbar" description="Elige qué telemetría permanece visible durante la operación.">
                <ToggleRow icon={<Activity />} title="Métricas del sistema" description="Muestra CPU y memoria en tiempo real en pantallas grandes." enabled={showSystemMetrics} onChange={setShowSystemMetrics} />
                <ToggleRow icon={<LayoutDashboard />} title="Detalle de estado" description="Muestra la línea de salud debajo del nombre del módulo." enabled={showStatusDetails} onChange={setShowStatusDetails} />
              </SettingsGroup>

              <SettingsGroup title="Accesibilidad" description="Control global del comportamiento animado.">
                <ToggleRow icon={<Monitor />} title="Reducir movimiento" description="Detiene loops y comprime transiciones en todo el OS." enabled={reducedMotion} onChange={setReducedMotion} />
              </SettingsGroup>
            </SettingsSection>
          )}

          {activeSection === "shadow" && (
            <SettingsSection title="Shadow" description="Configuración operativa de inteligencia, contexto y ejecución.">
              <SettingsGroup title="Núcleos" description="Cada consola modifica comportamiento real del backend.">
                <ControlLink href="/shadow/memory" icon={<BookOpen />} title="Memoria" description="Observa lo que Shadow sabe, consolida el índice y resuelve conflictos." meta="Abrir consola" />
                <ControlLink href="/shadow/autonomy" icon={<Rocket />} title="Autonomía" description="Define políticas, revisa riesgos y procesa acciones pendientes." meta="Abrir consola" />
              </SettingsGroup>

              <SettingsGroup title="Dependencias" description="Servicios que sostienen el razonamiento y el contexto.">
                <HealthRows ready={ready.data} loading={ready.isLoading} error={Boolean(ready.error)} filter={["anthropicConfigured", "vault", "database"]} />
              </SettingsGroup>
            </SettingsSection>
          )}

          {activeSection === "connections" && (
            <SettingsSection title="Conexiones" description="Fuentes y servicios conectados al runtime local.">
              <SettingsGroup title="Servicios activos" description="La disponibilidad se obtiene del backend, no del estado visual.">
                <HealthRows ready={ready.data} loading={ready.isLoading} error={Boolean(ready.error)} />
              </SettingsGroup>

              <SettingsGroup title="Fuentes de datos" description="Accesos a los módulos que alimentan contexto.">
                <ControlLink href="/obsidian" icon={<BookOpen />} title="Obsidian Vault" description="Notas, capturas e índice documental de Shadow." meta="Abrir" />
                <ControlLink href="/calendar" icon={<Layers />} title="Calendario" description="Agenda operativa y bloques de tiempo conectados." meta="Abrir" />
                <ControlLink href="/biometrics" icon={<Activity />} title="Biometría" description="Sueño, recuperación, peso y actividad personal." meta="Abrir" />
              </SettingsGroup>
            </SettingsSection>
          )}

          {activeSection === "system" && (
            <SettingsSection title="Sistema" description="Telemetría, alcance y comportamiento del runtime ValleOS." aside={<RefreshButton loading={ready.isValidating || system.isValidating} onClick={refresh} />}>
              <RuntimeStrip ready={ready.data} stats={system.data} loading={ready.isLoading || system.isLoading} />

              <SettingsGroup title="Runtime" description="Parámetros efectivos de esta instalación.">
                <InfoRow label="Ejecución" value="Local" />
                <InfoRow label="Actualización de salud" value="30 segundos" />
                <InfoRow label="Actualización de telemetría" value="5 segundos" />
                <InfoRow label="Persistencia de interfaz" value="Este dispositivo" />
              </SettingsGroup>

              <SettingsGroup title="Diagnóstico" description="Endpoints internos protegidos para inspección local.">
                <EndpointRow href="/api/health" label="Health" path="/api/health" />
                <EndpointRow href="/api/ready" label="Readiness" path="/api/ready" />
                <EndpointRow href="/api/system" label="Telemetría" path="/api/system" />
              </SettingsGroup>
            </SettingsSection>
          )}
        </div>
      </div>
    </main>
  );
}

function SettingsSection({ title, description, aside, children }: { title: string; description: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-7 flex min-h-10 items-start justify-between gap-4 border-b border-white/[0.055] pb-5">
        <div><h2 className="text-[13px] font-medium text-white/80">{title}</h2><p className="mt-1 text-[10px] leading-relaxed text-white/30">{description}</p></div>
        {aside}
      </div>
      <div className="space-y-7">{children}</div>
    </section>
  );
}

function SettingsGroup({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div><h3 className="text-[11px] font-medium text-white/65">{title}</h3><p className="mt-1 text-[9px] text-white/25">{description}</p></div>
        {action}
      </div>
      <div className="divide-y divide-white/[0.055] overflow-hidden rounded-xl border border-white/[0.065] bg-white/[0.015]">{children}</div>
    </section>
  );
}

function ToggleRow({ icon, title, description, enabled, onChange }: { icon: React.ReactNode; title: string; description: string; enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.055] bg-white/[0.025] text-white/35">{icon}</span>
      <div className="min-w-0 flex-1"><p className="text-[11px] text-white/70">{title}</p><p className="mt-0.5 text-[9px] leading-relaxed text-white/28">{description}</p></div>
      <button type="button" role="switch" aria-checked={enabled} aria-label={title} onClick={() => onChange(!enabled)} className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors active:scale-[0.96] ${enabled ? "border-white/30 bg-white/20" : "border-white/[0.09] bg-white/[0.035]"}`}>
        <span className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full transition-transform duration-200 ${enabled ? "translate-x-4 bg-white" : "translate-x-0 bg-white/35"}`} />
      </button>
    </div>
  );
}

function ControlLink({ href, icon, title, description, meta }: { href: string; icon: React.ReactNode; title: string; description: string; meta: string }) {
  return (
    <Link href={href} className="group flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-white/[0.025] active:bg-white/[0.04]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.055] bg-white/[0.025] text-white/40">{icon}</span>
      <div className="min-w-0 flex-1"><p className="text-[11px] text-white/70">{title}</p><p className="mt-0.5 text-[9px] leading-relaxed text-white/28">{description}</p></div>
      <span className="hidden text-[9px] text-white/25 sm:block">{meta}</span>
      <ChevronRight className="text-white/20 transition-transform group-hover:translate-x-0.5 group-hover:text-white/50" />
    </Link>
  );
}

function ActionRow({ icon, title, description, action, onClick }: { icon: React.ReactNode; title: string; description: string; action: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.025] active:bg-white/[0.04]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.055] bg-white/[0.025] text-white/40">{icon}</span>
      <div className="min-w-0 flex-1"><p className="text-[11px] text-white/70">{title}</p><p className="mt-0.5 text-[9px] leading-relaxed text-white/28">{description}</p></div>
      <span className="text-[9px] text-white/25">{action}</span><ChevronRight className="text-white/20 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function RuntimeStrip({ ready, stats, loading }: { ready?: ReadyState; stats?: SystemStats; loading: boolean }) {
  const checks = ready?.checks ? Object.values(ready.checks) : [];
  const connected = checks.filter(Boolean).length;
  return (
    <section aria-label="Telemetría del runtime" className="grid grid-cols-2 divide-x divide-y divide-white/[0.055] overflow-hidden rounded-xl border border-white/[0.065] bg-white/[0.02] sm:grid-cols-4 sm:divide-y-0">
      <RuntimeMetric label="Estado" value={loading ? "…" : ready?.status === "ready" ? "Nominal" : "Revisar"} />
      <RuntimeMetric label="CPU" value={stats ? `${stats.cpu}%` : "—"} />
      <RuntimeMetric label="Memoria" value={stats ? `${stats.ram} / ${stats.totalRam ?? "—"}` : "—"} />
      <RuntimeMetric label="Servicios" value={checks.length ? `${connected}/${checks.length}` : "—"} />
    </section>
  );
}

function RuntimeMetric({ label, value }: { label: string; value: string }) {
  return <div className="px-4 py-4"><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/22">{label}</p><p className="mt-2 truncate text-[13px] font-medium text-white/65">{value}</p></div>;
}

function HealthRows({ ready, loading, error, filter }: { ready?: ReadyState; loading: boolean; error: boolean; filter?: string[] }) {
  if (loading) return <div className="px-4 py-5 text-[10px] text-white/25">Comprobando servicios…</div>;
  if (error || !ready) return <div className="flex items-center gap-2 px-4 py-5 text-[10px] text-white/45"><CircleX /> No fue posible consultar el runtime.</div>;
  const entries = Object.entries(ready.checks).filter(([key]) => !filter || filter.includes(key));
  return <>{entries.map(([key, active]) => <StatusRow key={key} label={checkLabels[key] ?? key} active={active} />)}</>;
}

function StatusRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-3">
      {active ? <CircleCheck className="text-white/55" /> : <CircleX className="text-white/25" />}
      <span className="flex-1 text-[10px] text-white/55">{label}</span>
      <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/25">{active ? "Conectado" : "Revisar"}</span>
    </div>
  );
}

function RefreshButton({ loading, onClick }: { loading: boolean; onClick: () => Promise<unknown> }) {
  return <button type="button" onClick={() => void onClick()} disabled={loading} className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/[0.07] px-2.5 text-[9px] text-white/35 transition hover:bg-white/[0.04] hover:text-white/65 active:scale-[0.98] disabled:opacity-40"><RefreshCw className={loading ? "animate-spin" : ""} /> Verificar</button>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3"><span className="text-[10px] text-white/45">{label}</span><span className="font-mono text-[9px] text-white/30">{value}</span></div>;
}

function EndpointRow({ href, label, path }: { href: string; label: string; path: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="group flex min-h-12 items-center gap-3 px-4 py-3 transition hover:bg-white/[0.025]"><ExternalLink className="text-white/30" /><span className="flex-1 text-[10px] text-white/55">{label}</span><code className="text-[9px] text-white/25">{path}</code></a>;
}
