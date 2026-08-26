import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const { indexKnowledgeVault } = await import("../src/features/shadow/knowledge-index");
  const maxArgument = process.argv.find((argument) => argument.startsWith("--max="));
  const maxDocuments = maxArgument ? Number(maxArgument.split("=")[1]) : 500;
  const result = await indexKnowledgeVault({
    maxDocuments,
    force: process.argv.includes("--force"),
    useAi: !process.argv.includes("--local"),
  });
  console.log(`[Shadow Memory] ${result.indexed}/${result.discovered} notas indexadas; ${result.changed} cambiaron.`);
}

void main().catch((error) => {
  console.error("[Shadow Memory] Falló la indexación:", error);
  process.exitCode = 1;
});
