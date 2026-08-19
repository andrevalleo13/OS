import { getCourses, getAssignments, seedUniversityData } from "@/app/actions/university";
import UniversityDashboard from "@/components/uni/UniversityDashboard";

export default async function UniversityPage() {
  await seedUniversityData(); // Ensure mock data exists
  const courses = await getCourses();
  const assignments = await getAssignments();

  return (
    <div className="w-full h-full p-8 md:p-12 overflow-y-auto custom-scrollbar">
      <UniversityDashboard courses={courses} assignments={assignments} />
    </div>
  );
}
