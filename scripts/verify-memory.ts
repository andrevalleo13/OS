import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const [documents, chunks, entities, relations, events, revisions, reviews] = await Promise.all([
    prisma.knowledgeDocument.count({ where: { active: true } }),
    prisma.knowledgeChunk.count(),
    prisma.lifeEntity.count(),
    prisma.lifeRelation.count({ where: { active: true } }),
    prisma.lifeEvent.count(),
    prisma.obsidianRevision.count(),
    prisma.memoryReview.count(),
  ]);

  console.log(JSON.stringify({ documents, chunks, entities, relations, events, revisions, reviews }));
  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error("[Shadow Memory] Falló la verificación:", error);
  process.exitCode = 1;
});
