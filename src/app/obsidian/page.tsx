import { getRecentNotes } from "@/app/actions/obsidian";
import ObsidianDashboard from "@/components/obsidian/ObsidianDashboard";

export const dynamic = "force-dynamic";

export default async function ObsidianPage() {
  // Sin vault (OBSIDIAN_VAULT_PATH vacío, p. ej. en Vercel) la página carga vacía en vez de romper.
  const notes = await getRecentNotes(12).catch((error: unknown) => {
    console.error("Obsidian vault unavailable:", error);
    return [];
  });
  return <ObsidianDashboard initialNotes={notes} />;
}
