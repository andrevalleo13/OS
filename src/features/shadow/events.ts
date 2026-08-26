import "server-only";

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const eventSchema = z.object({
  type: z.string().trim().min(1).max(100),
  source: z.string().trim().min(1).max(100),
  sourceId: z.string().trim().min(1).max(240).optional(),
  dedupeKey: z.string().trim().min(1).max(300).optional(),
  summary: z.string().trim().min(1).max(1_000),
  payload: z.unknown().optional(),
  priority: z.number().int().min(0).max(100).default(0),
  occurredAt: z.date().default(() => new Date()),
});

export async function publishLifeEvent(rawInput: unknown) {
  const input = eventSchema.parse(rawInput);
  const dedupeKey = input.dedupeKey ?? (input.sourceId ? `${input.source}:${input.type}:${input.sourceId}` : undefined);
  if (dedupeKey) {
    return prisma.lifeEvent.upsert({
      where: { dedupeKey },
      create: {
        ...input,
        dedupeKey,
        payload: jsonValue(input.payload),
      },
      update: {
        summary: input.summary,
        payload: jsonValue(input.payload),
        priority: input.priority,
        occurredAt: input.occurredAt,
      },
    });
  }
  return prisma.lifeEvent.create({
    data: { ...input, payload: jsonValue(input.payload) },
  });
}

export async function recentLifeEvents(limit = 12) {
  const safeLimit = z.number().int().min(1).max(50).parse(limit);
  return prisma.lifeEvent.findMany({
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: safeLimit,
    select: { type: true, source: true, summary: true, priority: true, occurredAt: true },
  });
}
