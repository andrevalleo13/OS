import "server-only";

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export function canonicalEntityKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const entitySchema = z.object({
  kind: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(160),
  aliases: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  description: z.string().trim().max(1_000).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
});

function aliasesJson(aliases: string[]): Prisma.InputJsonValue {
  return aliases as Prisma.InputJsonValue;
}

export async function upsertLifeEntity(rawInput: unknown) {
  const input = entitySchema.parse(rawInput);
  const canonicalKey = canonicalEntityKey(input.name);
  return prisma.lifeEntity.upsert({
    where: { kind_canonicalKey: { kind: input.kind, canonicalKey } },
    create: {
      kind: input.kind,
      name: input.name,
      canonicalKey,
      aliases: aliasesJson(input.aliases),
      description: input.description,
      confidence: input.confidence,
    },
    update: {
      name: input.name,
      aliases: aliasesJson(input.aliases),
      description: input.description,
      confidence: Math.max(input.confidence, 0.5),
      sourceCount: { increment: 1 },
      lastSeenAt: new Date(),
    },
  });
}

const relationSchema = z.object({
  fromName: z.string().trim().min(1).max(160),
  toName: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1).max(80),
  evidence: z.string().trim().max(1_000).optional(),
  sourceRef: z.string().trim().max(500).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
});

async function findEntityByName(name: string) {
  const canonicalKey = canonicalEntityKey(name);
  return prisma.lifeEntity.findFirst({
    where: { canonicalKey },
    orderBy: [{ confidence: "desc" }, { sourceCount: "desc" }],
  });
}

export async function upsertLifeRelation(rawInput: unknown) {
  const input = relationSchema.parse(rawInput);
  if (canonicalEntityKey(input.fromName) === canonicalEntityKey(input.toName)) return undefined;
  const [fromEntity, toEntity] = await Promise.all([
    findEntityByName(input.fromName),
    findEntityByName(input.toName),
  ]);
  if (!fromEntity || !toEntity) return undefined;
  const type = canonicalEntityKey(input.type).replace(/\s+/g, "_").slice(0, 80) || "related_to";
  return prisma.lifeRelation.upsert({
    where: {
      fromEntityId_toEntityId_type: {
        fromEntityId: fromEntity.id,
        toEntityId: toEntity.id,
        type,
      },
    },
    create: {
      fromEntityId: fromEntity.id,
      toEntityId: toEntity.id,
      type,
      evidence: input.evidence,
      sourceRef: input.sourceRef,
      confidence: input.confidence,
    },
    update: {
      evidence: input.evidence,
      sourceRef: input.sourceRef,
      confidence: input.confidence,
      active: true,
      lastSeenAt: new Date(),
    },
  });
}

export async function lifeGraphContext(query: string, limit = 8) {
  const terms = canonicalEntityKey(query).split(" ").filter((term) => term.length > 2);
  if (terms.length === 0) return [];
  return prisma.lifeEntity.findMany({
    where: {
      OR: terms.flatMap((term) => [
        { canonicalKey: { contains: term } },
        { name: { contains: term, mode: "insensitive" as const } },
        { description: { contains: term, mode: "insensitive" as const } },
      ]),
    },
    orderBy: [{ confidence: "desc" }, { lastSeenAt: "desc" }],
    take: z.number().int().min(1).max(20).parse(limit),
    select: {
      id: true,
      kind: true,
      name: true,
      description: true,
      confidence: true,
      outgoing: {
        where: { active: true },
        take: 8,
        select: { type: true, evidence: true, toEntity: { select: { name: true, kind: true } } },
      },
      incoming: {
        where: { active: true },
        take: 8,
        select: { type: true, evidence: true, fromEntity: { select: { name: true, kind: true } } },
      },
    },
  });
}
