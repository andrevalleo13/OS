import { getRecentNotes } from "@/app/actions/obsidian";
import ObsidianDashboard from "@/components/obsidian/ObsidianDashboard";

export default async function ObsidianPage() {
  const notes = await getRecentNotes(12);
  return <ObsidianDashboard initialNotes={notes} />;
}
