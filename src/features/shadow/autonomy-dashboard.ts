import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dayRange } from "@/lib/dates";
import { serverConfig } from "@/lib/config";
import { publishLifeEvent } from "./events";

const safeId = z.string().uuid();

function payloadPreview(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(input).map(([key, field]) => [
    key,
    typeof field === "string" ? field.slice(0, key === "body" ? 2_000 : 300) : field,
  ]));
}

export async function getAutonomyDashboardData() {
  const today = dayRange(new Date(), serverConfig.timezone);
  const [policy, patterns, insights, jobs, completedToday] = await Promise.all([
    prisma.shadowAutonomyPolicy.findUnique({ where: { id: "primary" } }),
    prisma.shadowPattern.findMany({
      where: { status: "active" },
      orderBy: [{ confidence: "desc" }, { lastObservedAt: "desc" }],
      take: 60,
      select: {
        id: true, kind: true, subject: true, title: true, description: true,
        confidence: true, sampleSize: true, lastObservedAt: true,
      },
    }),
    prisma.shadowInsight.findMany({
      orderBy: [{ status: "asc" }, { urgency: "desc" }, { createdAt: "desc" }],
      take: 80,
      select: {
        id: true, type: true, title: true, body: true, rationale: true, urgency: true,
        status: true, availableAt: true, expiresAt: true, deliveredAt: true,
      },
    }),
    prisma.shadowAutomationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true, actionType: true, riskLevel: true, status: true, summary: true,
        payload: true, requiresApproval: true, scheduledFor: true, expiresAt: true,
        attempts: true, maxAttempts: true, lastError: true, createdAt: true, executedAt: true,
      },
    }),
    prisma.shadowAutomationJob.count({
      where: { status: "completed", executedAt: { gte: today.start, lte: today.end } },
    }),
  ]);

  const safePolicy = policy ?? {
    id: "primary",
    mode: "assist",
    quietStart: "23:00",
    quietEnd: "08:00",
    dailyDeliveryLimit: 6,
    allowMacNotifications: true,
    allowWhatsAppSelf: true,
    allowEmailDrafts: true,
    allowExternalSend: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    policy: {
      mode: safePolicy.mode,
      quietStart: safePolicy.quietStart,
      quietEnd: safePolicy.quietEnd,
      dailyDeliveryLimit: safePolicy.dailyDeliveryLimit,
      allowMacNotifications: safePolicy.allowMacNotifications,
      allowWhatsAppSelf: safePolicy.allowWhatsAppSelf,
      allowEmailDrafts: safePolicy.allowEmailDrafts,
      allowExternalSend: safePolicy.allowExternalSend,
    },
    patterns: patterns.map((pattern) => ({ ...pattern, lastObservedAt: pattern.lastObservedAt.toISOString() })),
    insights: insights.map((insight) => ({
      ...insight,
      availableAt: insight.availableAt.toISOString(),
      expiresAt: insight.expiresAt?.toISOString(),
      deliveredAt: insight.deliveredAt?.toISOString(),
    })),
    jobs: jobs.map((job) => ({
      ...job,
      payload: payloadPreview(job.payload),
      scheduledFor: job.scheduledFor.toISOString(),
      expiresAt: job.expiresAt?.toISOString(),
      createdAt: job.createdAt.toISOString(),
      executedAt: job.executedAt?.toISOString(),
    })),
    stats: {
      activePatterns: patterns.length,
      pendingInsights: insights.filter((insight) => insight.status === "pending").length,
      pendingApprovals: jobs.filter((job) => job.status === "pending_approval").length,
      completedToday,
    },
  };
}

export async function dismissShadowInsight(id: string) {
  const insightId = safeId.parse(id);
  const insight = await prisma.shadowInsight.findUnique({ where: { id: insightId }, select: { id: true, title: true, status: true } });
  if (!insight || insight.status !== "pending") throw new Error("El insight ya no está pendiente.");
  await prisma.$transaction([
    prisma.shadowInsight.update({ where: { id: insightId }, data: { status: "dismissed" } }),
    prisma.shadowAutomationJob.updateMany({
      where: { insightId, status: { in: ["pending_approval", "approved"] } },
      data: { status: "cancelled" },
    }),
  ]);
  await publishLifeEvent({
    type: "insight.dismissed",
    source: "shadow",
    sourceId: insightId,
    summary: `${insight.title} fue descartado por Andre.`,
  });
}

export async function dismissShadowPattern(id: string) {
  const patternId = safeId.parse(id);
  const changed = await prisma.shadowPattern.updateMany({ where: { id: patternId, status: "active" }, data: { status: "dismissed" } });
  if (changed.count === 0) throw new Error("El patrón ya no está activo.");
}
