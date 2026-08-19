"use server";

import { prisma } from "@/lib/prisma";
import { SessionHistory, PersonalRecord } from "@/components/gym/MuscleData";

function getRelativeTime(date: Date) {
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const daysDifference = Math.round((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDifference === 0) return "Hoy";
  if (daysDifference === -1) return "Ayer";
  return rtf.format(daysDifference, 'day');
}

export async function getGymData() {
  try {
    const sessions = await prisma.workoutSession.findMany({
      orderBy: { date: "desc" },
      take: 5,
    });

    const aggregate = await prisma.workoutSession.aggregate({
      _sum: { volume: true },
      _count: { id: true }
    });
    const lifetimeVolume = aggregate._sum.volume || 0;
    const totalWorkouts = aggregate._count.id;

    const sessionHistory: SessionHistory[] = sessions.map((session) => ({
      id: session.id,
      date: getRelativeTime(session.date),
      routineName: session.title,
      duration: session.duration >= 60 ? `${Math.floor(session.duration / 60)}h ${session.duration % 60}m` : `${session.duration}m`,
      totalVolume: session.volume,
    }));

    // PRs & Lift History
    const weightLogs = await prisma.exerciseLog.findMany({
      where: { NOT: { weight: null } },
      orderBy: { session: { date: "asc" } },
      include: { session: true }
    });

    const prMap = new Map<string, PersonalRecord>();
    const liftHistory: Record<string, { date: string, weight: number }[]> = {};

    for (const log of weightLogs) {
      // History
      if (!liftHistory[log.name]) liftHistory[log.name] = [];
      liftHistory[log.name].push({
        date: log.session.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weight: log.weight!
      });

      // Max PR
      const currentPr = prMap.get(log.name);
      if (!currentPr || log.weight! >= currentPr.weight) {
        prMap.set(log.name, {
          id: log.id,
          lift: log.name,
          weight: log.weight!,
          date: getRelativeTime(log.session.date)
        });
      }
    }
    const personalRecords = Array.from(prMap.values()).sort((a, b) => b.weight - a.weight);

    // Dynamic Muscle Stats (Soreness, Volume, Last Trained)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentLogs = await prisma.exerciseLog.findMany({
      where: { session: { date: { gte: thirtyDaysAgo } } },
      include: { session: true },
      orderBy: { session: { date: 'desc' } }
    });

    const muscleStats: Record<string, { soreness: number, weeklyVolume: number, lastTrained: string, exercises: string[] }> = {};
    const now = new Date().getTime();
    
    for (const log of recentLogs) {
      if (!log.muscleId) continue;
      
      if (!muscleStats[log.muscleId]) {
        muscleStats[log.muscleId] = { soreness: 0, weeklyVolume: 0, lastTrained: 'Nunca', exercises: [] };
      }
      const stats = muscleStats[log.muscleId];
      
      const daysAgo = (now - log.session.date.getTime()) / (1000 * 60 * 60 * 24);
      
      // Soreness (Max of last 3 days)
      let soreness = 0;
      if (daysAgo <= 1.5) soreness = 100;
      else if (daysAgo <= 2.5) soreness = 60;
      else if (daysAgo <= 3.5) soreness = 20;
      if (soreness > stats.soreness) stats.soreness = soreness;

      // Weekly volume
      if (daysAgo <= 7) {
        stats.weeklyVolume += log.sets;
      }

      // Last trained (since ordered by desc, the first one encountered is the most recent)
      if (stats.lastTrained === 'Nunca') {
        stats.lastTrained = getRelativeTime(log.session.date);
      }

      // Exercises
      if (!stats.exercises.includes(log.name)) {
        stats.exercises.push(log.name);
      }
    }

    // Heatmap (Last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const heatmapLogs = await prisma.workoutSession.findMany({
      where: { date: { gte: ninetyDaysAgo } },
      select: { date: true }
    });

    const heatmap: Record<string, number> = {};
    for (const session of heatmapLogs) {
      const dateStr = session.date.toISOString().split('T')[0];
      heatmap[dateStr] = (heatmap[dateStr] || 0) + 1;
    }

    // Bodyweight
    const latestBiometric = await prisma.biometricLog.findFirst({
      where: { weight: { not: null } },
      orderBy: { date: 'desc' }
    });
    const currentWeight = latestBiometric?.weight || 62.0;

    return { sessionHistory, personalRecords, muscleStats, liftHistory, lifetimeVolume, totalWorkouts, heatmap, currentWeight };
  } catch (error) {
    console.error("Error fetching gym data:", error);
    return { sessionHistory: [], personalRecords: [], muscleStats: {}, liftHistory: {}, lifetimeVolume: 0, totalWorkouts: 0, heatmap: {}, currentWeight: 62.0 };
  }
}

export async function logSteps(steps: number) {
  try {
    await prisma.biometricLog.create({
      data: {
        steps,
        date: new Date()
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Error logging steps:", error);
    return { success: false };
  }
}

export async function logWeight(weight: number) {
  try {
    await prisma.biometricLog.create({
      data: {
        weight,
        date: new Date()
      }
    });
    revalidatePath('/gym');
    return { success: true };
  } catch (error) {
    console.error("Error logging weight:", error);
    return { success: false };
  }
}

import { revalidatePath } from "next/cache";

export async function saveWorkoutSession(
  title: string, 
  duration: number, 
  volume: number,
  exercises: { name: string; sets: number; reps: string; weight: number; muscleId: string }[]
) {
  try {
    await prisma.workoutSession.create({
      data: {
        title,
        duration,
        volume,
        exercises: {
          create: exercises.map(ex => ({
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            muscleId: ex.muscleId
          }))
        }
      }
    });
    revalidatePath('/gym');
    return { success: true };
  } catch (error) {
    console.error("Error saving workout session:", error);
    return { success: false };
  }
}
