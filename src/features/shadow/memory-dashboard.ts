import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publishLifeEvent } from "./events";

export async function getMemoryDashboardData() {
  const [
    memories,
    revisions,
    reviews,
    entities,
    events,
    conversations,
    documentCount,
    chunkCount,
    relationCount,
  ] = await Promise.all([
    prisma.shadowMemory.findMany({
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      take: 120,
      select: {
        id: true, kind: true, subject: true, content: true, sourceRef: true,
        confidence: true, sensitive: true, active: true, updatedAt: true,
        entity: { select: { id: true, name: true, kind: true } },
      },
    }),
    prisma.obsidianRevision.findMany({
      where: { status: "applied" },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, path: true, operation: true, createdAt: true },
    }),
    prisma.memoryReview.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, kind: true, subject: true, reason: true, proposedContent: true, confidence: true, createdAt: true },
    }),
    prisma.lifeEntity.findMany({
      orderBy: [{ sourceCount: "desc" }, { lastSeenAt: "desc" }],
      take: 60,
      select: {
        id: true, kind: true, name: true, description: true, confidence: true, sourceCount: true,
        _count: { select: { outgoing: true, incoming: true, memories: true } },
      },
    }),
    prisma.lifeEvent.findMany({
      orderBy: { occurredAt: "desc" },
      take: 30,
      select: { id: true, type: true, source: true, summary: true, priority: true, occurredAt: true },
    }),
    prisma.shadowConversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      take: 20,
      select: { id: true, channel: true, externalKey: true, summary: true, summarizedMessageCount: true, summaryUpdatedAt: true, lastMessageAt: true },
    }),
    prisma.knowledgeDocument.count({ where: { active: true } }),
    prisma.knowledgeChunk.count({ where: { document: { active: true } } }),
    prisma.lifeRelation.count({ where: { active: true } }),
  ]);

  return {
    memories: memories.map((memory) => ({ ...memory, updatedAt: memory.updatedAt.toISOString() })),
    revisions: revisions.map((revision) => ({ ...revision, createdAt: revision.createdAt.toISOString() })),
    reviews: reviews.map((review) => ({ ...review, createdAt: review.createdAt.toISOString() })),
    entities,
    events: events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
    conversations: conversations.map((conversation) => ({
      ...conversation,
      summaryUpdatedAt: conversation.summaryUpdatedAt?.toISOString(),
      lastMessageAt: conversation.lastMessageAt.toISOString(),
    })),
    stats: { documents: documentCount, chunks: chunkCount, entities: entities.length, relations: relationCount },
  };
}

export async function setShadowMemoryActive(id: string, active: boolean) {
  const safeId = z.string().uuid().parse(id);
  const memory = await prisma.shadowMemory.findUnique({ where: { id: safeId }, select: { id: true, subject: true } });
  if (!memory) throw new Error("Memoria no encontrada.");
  await prisma.shadowMemory.update({ where: { id: safeId }, data: { active } });
  await publishLifeEvent({
    type: active ? "memory.restored" : "memory.deactivated",
    source: "shadow",
    sourceId: `${safeId}:${active}`,
    summary: `${memory.subject} fue ${active ? "restaurado" : "desactivado"} en la memoria operativa.`,
  });
}

export async function updateShadowMemory(id: string, content: string) {
  const safeId = z.string().uuid().parse(id);
  const safeContent = z.string().trim().min(1).max(2_000).parse(content);
  const memory = await prisma.shadowMemory.findUnique({ where: { id: safeId }, select: { id: true, subject: true, content: true } });
  if (!memory) throw new Error("Memoria no encontrada.");
  await prisma.shadowMemory.update({
    where: { id: safeId },
    data: { content: safeContent, confidence: 1, lastConfirmedAt: new Date(), active: true },
  });
  await publishLifeEvent({
    type: "memory.corrected",
    source: "shadow",
    sourceId: `${safeId}:${Date.now()}`,
    summary: `${memory.subject} fue corregido manualmente.`,
    payload: { memoryId: safeId, previous: memory.content, current: safeContent },
  });
}

export async function resolveMemoryReview(id: string, decision: "apply" | "dismiss") {
  const safeId = z.string().uuid().parse(id);
  const review = await prisma.memoryReview.findUnique({ where: { id: safeId } });
  if (!review || review.status !== "pending") throw new Error("Revisión no disponible.");
  if (decision === "dismiss") {
    await prisma.memoryReview.update({ where: { id: safeId }, data: { status: "dismissed", resolvedAt: new Date() } });
    return;
  }

  const ids = z.array(z.string().uuid()).min(1).max(20).parse(review.memoryIds);
  const memories = await prisma.shadowMemory.findMany({ where: { id: { in: ids } }, orderBy: { confidence: "desc" } });
  if (memories.length === 0) throw new Error("Las memorias de la revisión ya no existen.");
  const keeper = memories[0];
  await prisma.$transaction([
    prisma.shadowMemory.update({
      where: { id: keeper.id },
      data: { content: review.proposedContent ?? keeper.content, active: true, confidence: Math.max(keeper.confidence, review.confidence) },
    }),
    prisma.shadowMemory.updateMany({
      where: { id: { in: memories.slice(1).map((memory) => memory.id) } },
      data: { active: false },
    }),
    prisma.memoryReview.update({ where: { id: safeId }, data: { status: "applied", resolvedAt: new Date() } }),
  ]);
  await publishLifeEvent({
    type: "memory.review.applied",
    source: "shadow",
    sourceId: safeId,
    summary: `Se aplicó una consolidación de memoria sobre ${review.subject}.`,
    payload: { reviewId: safeId, keeperId: keeper.id },
  });
}
