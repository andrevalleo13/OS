import {
  BrainCircuit,
  Database,
  FileClock,
  GitBranch,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  resolveMemoryReviewAction,
  restoreObsidianRevisionAction,
  runKnowledgeIndexAction,
  runMemoryMaintenanceAction,
  setMemoryActiveAction,
  updateMemoryAction,
} from "@/app/actions/shadow-memory";
import { getMemoryDashboardData } from "@/features/shadow/memory-dashboard";

export const dynamic = "force-dynamic";

const panel = "rounded-3xl border border-white/[0.07] bg-[#080808] p-6";
const button = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white";

function confidenceLabel(value: number): string {
  if (value >= 0.9) return "alta";
  if (value >= 0.7) return "media";
  return "baja";
}

export default async function ShadowMemoryPage() {
  const data = await getMemoryDashboardData();
  const activeMemories = data.memories.filter((memory) => memory.active);
  const inactiveMemories = data.memories.filter((memory) => !memory.active);

  return (
    <main className="mx-auto w-full max-w-[1500px] pb-16 text-[#ededed]">
      <div className="mb-6 flex flex-wrap justify-end gap-2">
          <form action={runKnowledgeIndexAction}>
            <button className={button} type="submit"><Search className="h-3.5 w-3.5" /> Indexar cambios</button>
          </form>
          <form action={runMemoryMaintenanceAction}>
            <button className={button} type="submit"><RefreshCw className="h-3.5 w-3.5" /> Consolidar memoria</button>
          </form>
      </div>

      <section aria-label="Estado del núcleo de memoria" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Notas indexadas", value: data.stats.documents, icon: Database },
          { label: "Fragmentos semánticos", value: data.stats.chunks, icon: Search },
          { label: "Entidades", value: data.stats.entities, icon: BrainCircuit },
          { label: "Relaciones", value: data.stats.relations, icon: GitBranch },
        ].map((stat) => (
          <div key={stat.label} className={panel}>
            <stat.icon className="mb-5 h-4 w-4 text-white/30" />
            <p className="text-3xl font-light tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-white/35">{stat.label}</p>
          </div>
        ))}
      </section>

      {data.reviews.length > 0 ? (
        <section className={`${panel} mb-6 border-white/10 bg-white/[0.025]`}>
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-white/65" />
            <h2 className="text-sm font-medium">Revisiones pendientes</h2>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/60">{data.reviews.length}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm">{review.subject}</p>
                  <span className="text-[10px] uppercase tracking-wider text-white/45">{review.kind}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/45">{review.reason}</p>
                {review.proposedContent ? <p className="mt-3 rounded-xl bg-white/[0.035] p-3 text-xs text-white/65">{review.proposedContent}</p> : null}
                <div className="mt-4 flex gap-2">
                  <form action={resolveMemoryReviewAction.bind(null, review.id, "apply")}>
                    <button className={button} type="submit">Aplicar</button>
                  </form>
                  <form action={resolveMemoryReviewAction.bind(null, review.id, "dismiss")}>
                    <button className={button} type="submit">Descartar</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className={panel}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-medium">Recuerdos activos</h2>
            <span className="text-xs text-white/30">{activeMemories.length}</span>
          </div>
          <div className="space-y-3 [content-visibility:auto]">
            {activeMemories.length === 0 ? <p className="text-sm text-white/30">Shadow todavía no ha consolidado recuerdos operativos.</p> : null}
            {activeMemories.map((memory) => (
              <article key={memory.id} className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-white/85">{memory.subject}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-white/25">{memory.kind} · confianza {confidenceLabel(memory.confidence)}</p>
                  </div>
                  <form action={setMemoryActiveAction.bind(null, memory.id, false)}>
                    <button className={button} type="submit">Desactivar</button>
                  </form>
                </div>
                <form action={updateMemoryAction.bind(null, memory.id)} className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <label className="sr-only" htmlFor={`memory-${memory.id}`}>Contenido de {memory.subject}</label>
                  <input
                    id={`memory-${memory.id}`}
                    name="content"
                    defaultValue={memory.content}
                    maxLength={2000}
                    className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-xs text-white/70 outline-none transition focus:border-white/20"
                  />
                  <button className={button} type="submit">Corregir</button>
                </form>
                {memory.sourceRef ? <p className="mt-2 truncate text-[10px] text-white/20">{memory.sourceRef}</p> : null}
              </article>
            ))}
          </div>

          {inactiveMemories.length > 0 ? (
            <details className="mt-5 border-t border-white/[0.06] pt-5">
              <summary className="cursor-pointer text-xs text-white/40">Desactivados ({inactiveMemories.length})</summary>
              <div className="mt-3 space-y-2">
                {inactiveMemories.map((memory) => (
                  <div key={memory.id} className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.02] p-3">
                    <div className="min-w-0"><p className="text-xs">{memory.subject}</p><p className="truncate text-[10px] text-white/30">{memory.content}</p></div>
                    <form action={setMemoryActiveAction.bind(null, memory.id, true)}>
                      <button className={button} type="submit"><RotateCcw className="h-3 w-3" /> Restaurar</button>
                    </form>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <div className="space-y-6">
          <section className={panel}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-medium">Life Graph</h2>
              <span className="text-xs text-white/30">{data.entities.length} principales</span>
            </div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1 [content-visibility:auto]">
              {data.entities.map((entity) => (
                <article key={entity.id} className="rounded-xl border border-white/[0.05] p-3">
                  <div className="flex items-center justify-between gap-3"><p className="text-xs text-white/80">{entity.name}</p><span className="text-[9px] uppercase text-white/35">{entity.kind}</span></div>
                  {entity.description ? <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-white/30">{entity.description}</p> : null}
                  <p className="mt-2 text-[9px] text-white/20">{entity._count.outgoing + entity._count.incoming} conexiones · {entity.sourceCount} fuentes</p>
                </article>
              ))}
            </div>
          </section>

          <section className={panel}>
            <div className="mb-5 flex items-center gap-2"><FileClock className="h-4 w-4 text-white/30" /><h2 className="text-sm font-medium">Cambios restaurables</h2></div>
            <div className="space-y-2">
              {data.revisions.length === 0 ? <p className="text-xs text-white/30">No hay revisiones pendientes.</p> : null}
              {data.revisions.map((revision) => (
                <div key={revision.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.02] p-3">
                  <div className="min-w-0"><p className="truncate text-xs text-white/65">{revision.path}</p><p className="mt-1 text-[9px] text-white/25">{revision.operation} · {new Date(revision.createdAt).toLocaleString("es-MX")}</p></div>
                  <form action={restoreObsidianRevisionAction.bind(null, revision.id)}>
                    <button className={button} type="submit"><RotateCcw className="h-3 w-3" /> Revertir</button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className={panel}>
          <h2 className="mb-5 text-sm font-medium">Resúmenes conversacionales</h2>
          <div className="space-y-3">
            {data.conversations.map((conversation) => (
              <article key={conversation.id} className="rounded-2xl border border-white/[0.05] p-4">
                <div className="flex items-center justify-between"><p className="text-xs text-white/70">{conversation.channel}</p><span className="text-[9px] text-white/25">{conversation.summarizedMessageCount} mensajes resumidos</span></div>
                <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-white/35">{conversation.summary ?? "Aún no alcanza el umbral para compactar."}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={panel}>
          <h2 className="mb-5 text-sm font-medium">Event Bus</h2>
          <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1 [content-visibility:auto]">
            {data.events.map((event) => (
              <article key={event.id} className="border-l border-white/10 pl-4">
                <div className="flex items-center justify-between gap-3"><p className="text-[10px] uppercase tracking-wider text-white/35">{event.type}</p><time className="text-[9px] text-white/20">{new Date(event.occurredAt).toLocaleString("es-MX")}</time></div>
                <p className="mt-1 text-xs leading-relaxed text-white/45">{event.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
