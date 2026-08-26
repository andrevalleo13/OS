import crypto from "node:crypto";
import dotenv from "dotenv";
import type { ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";

dotenv.config({ path: ".env.local" });

async function main() {
  const [{ executeShadowTool }, { cancelAutonomyJob }, { prisma }] = await Promise.all([
    import("../src/features/shadow/tools"),
    import("../src/features/shadow/autonomy"),
    import("../src/lib/prisma"),
  ]);
  const toolUse = {
    type: "tool_use",
    id: `verify-${crypto.randomUUID()}`,
    name: "draft_email",
    input: { recipient: "prueba@example.com", subject: "Verificación Fase 4", body: "Prueba local; no enviar." },
  } as ToolUseBlock;
  const result = await executeShadowTool(toolUse);
  if (!result.pendingAction) throw new Error("draft_email no creó una aprobación.");
  const queued = await prisma.shadowAutomationJob.findUnique({ where: { id: result.pendingAction.id } });
  if (!queued || queued.status !== "pending_approval" || queued.actionType !== "email.draft") {
    throw new Error("El trabajo durable no coincide con la propuesta.");
  }
  await cancelAutonomyJob(queued.id);
  const cancelled = await prisma.shadowAutomationJob.findUnique({ where: { id: queued.id }, select: { status: true } });
  console.log(JSON.stringify({ tool: "draft_email", queued: true, requiredApproval: queued.requiresApproval, finalStatus: cancelled?.status }));
  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error("[Shadow Autonomy] Falló la verificación:", error);
  process.exitCode = 1;
});
