import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishLifeEvent } from "./events";

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function auditShadowAction(input: {
  conversationId?: string;
  toolName: string;
  status: "completed" | "failed" | "pending" | "no_change";
  summary: string;
  toolInput?: unknown;
  result?: unknown;
  reversible?: boolean;
}) {
  try {
    const audit = await prisma.shadowActionAudit.create({
      data: {
        conversationId: input.conversationId,
        toolName: input.toolName,
        status: input.status,
        summary: input.summary.slice(0, 500),
        input: jsonValue(input.toolInput),
        result: jsonValue(input.result),
        reversible: input.reversible ?? false,
      },
    });
    await publishLifeEvent({
      type: `action.${input.status}`,
      source: "shadow",
      sourceId: audit.id,
      summary: input.summary,
      payload: { toolName: input.toolName, reversible: input.reversible ?? false },
      priority: input.status === "failed" ? 50 : input.status === "pending" ? 20 : 0,
    });
  } catch (error) {
    console.error("Shadow action audit failed", {
      toolName: input.toolName,
      message: error instanceof Error ? error.message : "Unknown audit error",
    });
  }
}
