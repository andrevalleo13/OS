import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const [{ runProactiveCycle }, { executeReadyAutomationJobs }, { prisma }] = await Promise.all([
    import("../src/features/shadow/proactivity"),
    import("../src/features/shadow/autonomy"),
    import("../src/lib/prisma"),
  ]);
  const proactive = await runProactiveCycle();
  const worker = await executeReadyAutomationJobs();
  const [patterns, pendingInsights, pendingApprovals, completedJobs] = await Promise.all([
    prisma.shadowPattern.count({ where: { status: "active" } }),
    prisma.shadowInsight.count({ where: { status: "pending" } }),
    prisma.shadowAutomationJob.count({ where: { status: "pending_approval" } }),
    prisma.shadowAutomationJob.count({ where: { status: "completed" } }),
  ]);
  console.log(JSON.stringify({ proactive, worker, state: { patterns, pendingInsights, pendingApprovals, completedJobs } }));
  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error("[Shadow Autonomy] Falló el ciclo:", error);
  process.exitCode = 1;
});
