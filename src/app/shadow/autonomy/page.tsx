import {
  Activity,
  BrainCircuit,
  Check,
  Clock3,
  Mail,
  MessageCircle,
  Play,
  Search,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import {
  approveAutonomyJobAction,
  cancelAutonomyJobAction,
  dismissShadowInsightAction,
  dismissShadowPatternAction,
  runAutomationWorkerAction,
  runProactiveCycleAction,
  updateAutonomyPolicyAction,
} from "@/app/actions/shadow-autonomy";
import { getAutonomyDashboardData } from "@/features/shadow/autonomy-dashboard";

export const dynamic = "force-dynamic";

const panel = "rounded-3xl border border-white/[0.07] bg-[#080808] p-6";
const button = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white";
const input = "rounded-xl border border-white/[0.08] bg-black/50 px-3 py-2 text-xs text-white/75 outline-none focus:border-white/20";

function riskColor(risk: string): string {
  if (risk === "high" || risk === "critical") return "text-white/80";
  if (risk === "medium") return "text-white/55";
  return "text-white/35";
}

function jobIcon(actionType: string) {
  if (actionType.startsWith("email")) return Mail;
  if (actionType.startsWith("whatsapp")) return MessageCircle;
  return Zap;
}

export default async function ShadowAutonomyPage() {
  const data = await getAutonomyDashboardData();
  const pendingInsights = data.insights.filter((insight) => insight.status === "pending");

  return (
    <main className="mx-auto w-full max-w-[1500px] pb-16 text-[#ededed]">
      <div className="mb-6 flex flex-wrap justify-end gap-2">
          <form action={runProactiveCycleAction}><button className={button} type="submit"><Search className="h-3.5 w-3.5" /> Analizar ahora</button></form>
          <form action={runAutomationWorkerAction}><button className={button} type="submit"><Play className="h-3.5 w-3.5" /> Procesar cola</button></form>
      </div>

      <section aria-label="Estado de autonomía" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Patrones activos", value: data.stats.activePatterns, icon: BrainCircuit },
          { label: "Insights pendientes", value: data.stats.pendingInsights, icon: Activity },
          { label: "Aprobaciones", value: data.stats.pendingApprovals, icon: ShieldCheck },
          { label: "Ejecutadas hoy", value: data.stats.completedToday, icon: Check },
        ].map((stat) => (
          <div key={stat.label} className={panel}>
            <stat.icon className="mb-5 h-4 w-4 text-white/30" />
            <p className="text-3xl font-light tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-white/35">{stat.label}</p>
          </div>
        ))}
      </section>

      <section className={`${panel} mb-6`}>
        <div className="mb-5 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-white/35" /><h2 className="text-sm font-medium">Política de autonomía</h2></div>
        <form action={updateAutonomyPolicyAction} className="grid gap-5 xl:grid-cols-[1fr_1fr_1.3fr]">
          <label className="grid gap-2 text-xs text-white/45">
            Modo
            <select name="mode" defaultValue={data.policy.mode} className={input}>
              <option value="observe">Observar — no ejecutar</option>
              <option value="assist">Asistir — notificar y pedir aprobación</option>
              <option value="autonomous">Autónomo — ejecutar lo permitido</option>
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-2 text-xs text-white/45">Silencio desde<input name="quietStart" type="time" defaultValue={data.policy.quietStart} className={input} /></label>
            <label className="grid gap-2 text-xs text-white/45">Hasta<input name="quietEnd" type="time" defaultValue={data.policy.quietEnd} className={input} /></label>
            <label className="grid gap-2 text-xs text-white/45">Límite diario<input name="dailyDeliveryLimit" type="number" min={1} max={30} defaultValue={data.policy.dailyDeliveryLimit} className={input} /></label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["allowMacNotifications", "Notificaciones Mac", data.policy.allowMacNotifications],
              ["allowWhatsAppSelf", "WhatsApp a Shadow", data.policy.allowWhatsAppSelf],
              ["allowEmailDrafts", "Borradores de Mail", data.policy.allowEmailDrafts],
              ["allowExternalSend", "Envíos externos autónomos", data.policy.allowExternalSend],
            ].map(([name, label, checked]) => (
              <label key={String(name)} className="flex items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2 text-xs text-white/50">
                <input name={String(name)} type="checkbox" defaultChecked={Boolean(checked)} className="accent-red-400" /> {String(label)}
              </label>
            ))}
          </div>
          <div className="xl:col-span-3"><button className={button} type="submit">Guardar política</button></div>
        </form>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.2fr]">
        <section className={panel}>
          <div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-medium">Intervenciones pendientes</h2><span className="text-xs text-white/25">{pendingInsights.length}</span></div>
          <div className="space-y-3 [content-visibility:auto]">
            {pendingInsights.length === 0 ? <p className="text-xs text-white/30">No hay nada suficientemente importante para interrumpirte.</p> : null}
            {pendingInsights.map((insight) => (
              <article key={insight.id} className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
                <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-white/85">{insight.title}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/35">{insight.type}</p></div><span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] text-white/40">urgencia {insight.urgency}</span></div>
                <p className="mt-3 text-xs leading-relaxed text-white/55">{insight.body}</p>
                {insight.rationale ? <p className="mt-2 text-[10px] leading-relaxed text-white/25">{insight.rationale}</p> : null}
                <form action={dismissShadowInsightAction.bind(null, insight.id)} className="mt-4"><button className={button} type="submit"><X className="h-3 w-3" /> Descartar</button></form>
              </article>
            ))}
          </div>
        </section>

        <section className={panel}>
          <div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-medium">Cola de acciones</h2><span className="text-xs text-white/25">{data.jobs.length}</span></div>
          <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1 [content-visibility:auto]">
            {data.jobs.length === 0 ? <p className="text-xs text-white/30">Shadow todavía no ha propuesto acciones.</p> : null}
            {data.jobs.map((job) => {
              const Icon = jobIcon(job.actionType);
              const actionable = job.status === "pending_approval" || job.status === "failed";
              return (
                <article key={job.id} className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 text-white/30" /><div><p className="text-sm text-white/80">{job.summary}</p><p className="mt-1 text-[10px] text-white/25">{job.actionType} · {job.status}</p></div></div>
                    <span className={`text-[10px] uppercase tracking-wider ${riskColor(job.riskLevel)}`}>{job.riskLevel}</span>
                  </div>
                  {Object.keys(job.payload).length > 0 ? <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-white/[0.025] p-3 text-[10px] leading-relaxed text-white/45">{JSON.stringify(job.payload, null, 2)}</pre> : null}
                  {job.lastError ? <p className="mt-3 text-[10px] text-white/55">{job.lastError}</p> : null}
                  {actionable ? (
                    <div className="mt-4 flex gap-2">
                      <form action={approveAutonomyJobAction.bind(null, job.id)}><button className={button} type="submit"><Check className="h-3 w-3" /> {job.status === "failed" ? "Reintentar" : "Aprobar"}</button></form>
                      <form action={cancelAutonomyJobAction.bind(null, job.id)}><button className={button} type="submit"><X className="h-3 w-3" /> Cancelar</button></form>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <section className={`${panel} mt-6`}>
        <div className="mb-5 flex items-center gap-2"><Clock3 className="h-4 w-4 text-white/30" /><h2 className="text-sm font-medium">Patrones aprendidos</h2></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 [content-visibility:auto]">
          {data.patterns.length === 0 ? <p className="text-xs text-white/30">Aún no hay suficientes muestras para detectar hábitos estables.</p> : null}
          {data.patterns.map((pattern) => (
            <article key={pattern.id} className="rounded-2xl border border-white/[0.05] p-4">
              <div className="flex items-center justify-between gap-3"><p className="text-xs text-white/75">{pattern.title}</p><span className="text-[9px] text-white/25">{Math.round(pattern.confidence * 100)}%</span></div>
              <p className="mt-2 text-[11px] leading-relaxed text-white/40">{pattern.description}</p>
              <p className="mt-3 text-[9px] text-white/20">{pattern.sampleSize} muestras · {pattern.subject}</p>
              <form action={dismissShadowPatternAction.bind(null, pattern.id)} className="mt-3"><button className="text-[10px] text-white/25 transition hover:text-white/60" type="submit">Esto no me representa</button></form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
