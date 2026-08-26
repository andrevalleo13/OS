import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Prisma } from "@prisma/client";
import { addMinutes, subMinutes } from "date-fns";
import { z } from "zod";
import { addCalendarEvent } from "@/features/calendar/calendar.service";
import { prisma } from "@/lib/prisma";
import { errorMessage, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auditShadowAction } from "./audit";
import { publishLifeEvent } from "./events";

const execFileAsync = promisify(execFile);
const policyId = "primary";
const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const autonomyModeSchema = z.enum(["observe", "assist", "autonomous"]);
export const automationActionTypeSchema = z.enum([
  "notification.macos",
  "email.draft",
  "email.send",
  "whatsapp.send",
  "calendar.add",
]);

const notificationPayloadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1_000),
});
const emailPayloadSchema = z.object({
  recipient: z.email().max(320),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
});
const whatsappPayloadSchema = z.object({
  recipient: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4_000),
});
const calendarPayloadSchema = z.object({
  title: z.string().trim().min(1).max(300),
  date: z.iso.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  calendar: z.string().trim().min(1).max(120).optional(),
});

const queueSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(300),
  insightId: z.string().uuid().optional(),
  actionType: automationActionTypeSchema,
  summary: z.string().trim().min(1).max(500),
  payload: z.unknown(),
  scheduledFor: z.date().optional(),
  expiresAt: z.date().optional(),
  forceApproval: z.boolean().default(false),
});

export const autonomyPolicyInputSchema = z.object({
  mode: autonomyModeSchema,
  quietStart: clockSchema,
  quietEnd: clockSchema,
  dailyDeliveryLimit: z.number().int().min(1).max(30),
  allowMacNotifications: z.boolean(),
  allowWhatsAppSelf: z.boolean(),
  allowEmailDrafts: z.boolean(),
  allowExternalSend: z.boolean(),
});

export type AutomationActionType = z.infer<typeof automationActionTypeSchema>;
export type AutonomyMode = z.infer<typeof autonomyModeSchema>;
export type AutomationRisk = "low" | "medium" | "high" | "critical";

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function validateAutomationPayload(actionType: AutomationActionType, payload: unknown) {
  if (actionType === "notification.macos") return notificationPayloadSchema.parse(payload);
  if (actionType === "email.draft" || actionType === "email.send") return emailPayloadSchema.parse(payload);
  if (actionType === "whatsapp.send") return whatsappPayloadSchema.parse(payload);
  return calendarPayloadSchema.parse(payload);
}

export function assessAutonomyRisk(actionType: AutomationActionType): AutomationRisk {
  if (actionType === "notification.macos") return "low";
  if (actionType === "email.draft") return "medium";
  return "high";
}

export async function getAutonomyPolicy() {
  return prisma.shadowAutonomyPolicy.upsert({
    where: { id: policyId },
    create: { id: policyId },
    update: {},
  });
}

export async function updateAutonomyPolicy(input: unknown) {
  const policy = autonomyPolicyInputSchema.parse(input);
  return prisma.shadowAutonomyPolicy.upsert({
    where: { id: policyId },
    create: { id: policyId, ...policy },
    update: policy,
  });
}

function canAutoApprove(
  actionType: AutomationActionType,
  payload: ReturnType<typeof validateAutomationPayload>,
  policy: Awaited<ReturnType<typeof getAutonomyPolicy>>,
): boolean {
  if (policy.mode === "observe") return false;
  if (actionType === "notification.macos") return policy.allowMacNotifications;
  if (policy.mode !== "autonomous") return false;
  if (actionType === "email.draft") return policy.allowEmailDrafts;
  if (actionType === "whatsapp.send") {
    return policy.allowExternalSend && policy.allowWhatsAppSelf && "recipient" in payload && payload.recipient.toLowerCase() === "shadow";
  }
  return policy.allowExternalSend;
}

function actionLabel(actionType: AutomationActionType, payload: ReturnType<typeof validateAutomationPayload>): string {
  if (actionType === "notification.macos") return `Notificar: ${"title" in payload ? payload.title : "Shadow"}`;
  if (actionType === "calendar.add") return `Agregar al calendario: ${"title" in payload ? payload.title : "evento"}`;
  if (actionType === "email.draft") return `Crear borrador para ${"recipient" in payload ? payload.recipient : "correo"}`;
  if (actionType === "email.send") return `Enviar correo a ${"recipient" in payload ? payload.recipient : "destinatario"}`;
  return `Enviar WhatsApp a ${"recipient" in payload ? payload.recipient : "destinatario"}`;
}

export async function queueAutonomyJob(rawInput: unknown) {
  const input = queueSchema.parse(rawInput);
  const payload = validateAutomationPayload(input.actionType, input.payload);
  const [policy, existing] = await Promise.all([
    getAutonomyPolicy(),
    prisma.shadowAutomationJob.findUnique({ where: { idempotencyKey: input.idempotencyKey } }),
  ]);
  if (existing) return existing;
  if (input.actionType === "notification.macos" && !policy.allowMacNotifications) {
    throw new ValidationError("Las notificaciones de macOS están desactivadas.");
  }
  if (input.actionType === "email.draft" && !policy.allowEmailDrafts) {
    throw new ValidationError("Los borradores de correo están desactivados.");
  }

  const riskLevel = assessAutonomyRisk(input.actionType);
  const requiresApproval = input.forceApproval || !canAutoApprove(input.actionType, payload, policy);
  const status = requiresApproval ? "pending_approval" : "approved";
  const job = await prisma.shadowAutomationJob.create({
    data: {
      idempotencyKey: input.idempotencyKey,
      insightId: input.insightId,
      actionType: input.actionType,
      riskLevel,
      status,
      summary: input.summary,
      payload: jsonValue(payload),
      requiresApproval,
      scheduledFor: input.scheduledFor ?? new Date(),
      expiresAt: input.expiresAt ?? addMinutes(new Date(), riskLevel === "low" ? 180 : 1_440),
      approvedAt: requiresApproval ? undefined : new Date(),
      maxAttempts: riskLevel === "low" ? 3 : 1,
    },
  });
  await auditShadowAction({
    toolName: input.actionType,
    status: requiresApproval ? "pending" : "completed",
    summary: `${actionLabel(input.actionType, payload)} quedó ${requiresApproval ? "pendiente de aprobación" : "en cola"}.`,
    toolInput: { actionType: input.actionType, jobId: job.id },
    result: { status: job.status },
    reversible: requiresApproval || input.actionType === "email.draft" || input.actionType === "calendar.add",
  });
  return job;
}

export function pendingAutomationAction(job: { id: string; summary: string; expiresAt: Date | null }) {
  return {
    id: job.id,
    label: `Aprobar: ${job.summary}`,
    expiresAt: (job.expiresAt ?? addMinutes(new Date(), 1_440)).toISOString(),
  };
}

export async function approveAutonomyJob(id: string) {
  const safeId = z.string().uuid().parse(id);
  const job = await prisma.shadowAutomationJob.findUnique({ where: { id: safeId } });
  if (!job) throw new NotFoundError("La acción autónoma no existe.");
  if (job.status !== "pending_approval" && job.status !== "failed") {
    throw new ValidationError("La acción ya fue procesada o no admite aprobación.");
  }
  if (job.expiresAt && job.expiresAt < new Date()) {
    await prisma.shadowAutomationJob.update({ where: { id: safeId }, data: { status: "expired" } });
    throw new ValidationError("La propuesta expiró.");
  }
  return prisma.shadowAutomationJob.update({
    where: { id: safeId },
    data: { status: "approved", approvedAt: new Date(), scheduledFor: new Date(), lastError: null, maxAttempts: Math.max(job.maxAttempts, job.attempts + 1) },
  });
}

export async function cancelAutonomyJob(id: string) {
  const safeId = z.string().uuid().parse(id);
  const changed = await prisma.shadowAutomationJob.updateMany({
    where: { id: safeId, status: { in: ["pending_approval", "approved", "failed"] } },
    data: { status: "cancelled" },
  });
  if (changed.count === 0) throw new ValidationError("La acción ya no se puede cancelar.");
}

export async function claimNextAutomationJob(actionTypes?: AutomationActionType[]) {
  return prisma.$transaction(async (transaction) => {
    const job = await transaction.shadowAutomationJob.findFirst({
      where: {
        status: "approved",
        scheduledFor: { lte: new Date() },
        attempts: { lt: prisma.shadowAutomationJob.fields.maxAttempts },
        ...(actionTypes?.length ? { actionType: { in: actionTypes } } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    });
    if (!job) return null;
    const attempt = job.attempts + 1;
    const claimed = await transaction.shadowAutomationJob.updateMany({
      where: { id: job.id, status: "approved", attempts: job.attempts },
      data: { status: "running", attempts: attempt },
    });
    if (claimed.count === 0) return null;
    const execution = await transaction.shadowAutomationExecution.create({
      data: { jobId: job.id, attempt, status: "running" },
    });
    return { ...job, status: "running", attempts: attempt, executionId: execution.id };
  });
}

export async function completeAutomationJob(jobId: string, executionId: string, result: unknown) {
  const safeJobId = z.string().uuid().parse(jobId);
  const safeExecutionId = z.string().uuid().parse(executionId);
  await prisma.$transaction([
    prisma.shadowAutomationExecution.update({
      where: { id: safeExecutionId },
      data: { status: "completed", result: jsonValue(result), finishedAt: new Date() },
    }),
    prisma.shadowAutomationJob.update({
      where: { id: safeJobId },
      data: { status: "completed", result: jsonValue(result), executedAt: new Date(), lastError: null },
    }),
    prisma.shadowInsight.updateMany({
      where: { jobs: { some: { id: safeJobId } }, status: "pending" },
      data: { status: "delivered", deliveredAt: new Date() },
    }),
  ]);
  await publishLifeEvent({
    type: "automation.completed",
    source: "shadow",
    sourceId: safeJobId,
    summary: "Shadow completó una acción autónoma aprobada.",
    payload: { jobId: safeJobId },
  });
}

export async function failAutomationJob(
  job: { id: string; attempts: number; maxAttempts: number; riskLevel: string },
  executionId: string,
  error: unknown,
) {
  const message = errorMessage(error).slice(0, 1_000);
  const retry = job.riskLevel === "low" && job.attempts < job.maxAttempts;
  await prisma.$transaction([
    prisma.shadowAutomationExecution.update({
      where: { id: z.string().uuid().parse(executionId) },
      data: { status: "failed", error: message, finishedAt: new Date() },
    }),
    prisma.shadowAutomationJob.update({
      where: { id: z.string().uuid().parse(job.id) },
      data: {
        status: retry ? "approved" : "failed",
        lastError: message,
        scheduledFor: retry ? addMinutes(new Date(), 2 ** job.attempts) : undefined,
      },
    }),
  ]);
  logger.error("shadow.automation.failed", { jobId: job.id, attempt: job.attempts, retry, message });
}

async function runAppleScript(script: string, args: string[]) {
  await execFileAsync("osascript", ["-e", script, "--", ...args], { timeout: 15_000 });
}

async function executeLocalJob(job: NonNullable<Awaited<ReturnType<typeof claimNextAutomationJob>>>) {
  const actionType = automationActionTypeSchema.parse(job.actionType);
  const payload = validateAutomationPayload(actionType, job.payload);
  if (actionType === "notification.macos") {
    const input = notificationPayloadSchema.parse(payload);
    await runAppleScript("on run argv\ndisplay notification (item 2 of argv) with title (item 1 of argv)\nend run", [input.title, input.body]);
    return { channel: "macos" };
  }
  if (actionType === "email.draft" || actionType === "email.send") {
    const input = emailPayloadSchema.parse(payload);
    const shouldSend = actionType === "email.send" ? "true" : "false";
    const script = `on run argv
set targetAddress to item 1 of argv
set targetSubject to item 2 of argv
set targetBody to item 3 of argv
set shouldSend to item 4 of argv
tell application "Mail"
  set outgoingMessage to make new outgoing message with properties {subject:targetSubject, content:targetBody & return, visible:(shouldSend is "false")}
  tell outgoingMessage to make new to recipient at end of to recipients with properties {address:targetAddress}
  if shouldSend is "true" then send outgoingMessage
  activate
end tell
end run`;
    await runAppleScript(script, [input.recipient, input.subject, input.body, shouldSend]);
    return { channel: "mail", operation: actionType === "email.send" ? "sent" : "drafted" };
  }
  if (actionType === "calendar.add") {
    const input = calendarPayloadSchema.parse(payload);
    await addCalendarEvent(input);
    return { channel: "calendar" };
  }
  throw new ValidationError("Los trabajos de WhatsApp se ejecutan exclusivamente desde el daemon.");
}

export async function executeReadyAutomationJobs(limit = 8) {
  const safeLimit = z.number().int().min(1).max(30).parse(limit);
  let completed = 0;
  let failed = 0;
  for (let index = 0; index < safeLimit; index += 1) {
    const job = await claimNextAutomationJob(["notification.macos", "email.draft", "email.send", "calendar.add"]);
    if (!job) break;
    try {
      const result = await executeLocalJob(job);
      await completeAutomationJob(job.id, job.executionId, result);
      completed += 1;
    } catch (error) {
      await failAutomationJob(job, job.executionId, error);
      failed += 1;
    }
  }
  return { completed, failed };
}

export async function recoverStuckAutomationJobs() {
  const stale = await prisma.shadowAutomationJob.findMany({
    where: { status: "running", updatedAt: { lt: subMinutes(new Date(), 10) } },
    select: { id: true, riskLevel: true },
  });
  for (const job of stale) {
    await prisma.shadowAutomationJob.update({
      where: { id: job.id },
      data: {
        status: job.riskLevel === "low" ? "approved" : "failed",
        lastError: "El worker se interrumpió durante la ejecución; se evitó repetir una acción externa ambigua.",
      },
    });
  }
  return stale.length;
}
