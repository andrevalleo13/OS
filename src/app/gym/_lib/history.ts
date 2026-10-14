import "server-only";

import { prisma } from "@/lib/prisma";
import { dateKey } from "@/lib/dates";
import { serverConfig } from "@/lib/config";
import type { GymHistory } from "@/components/gym/lib/types";

export const EMPTY_HISTORY: GymHistory = { sessions: [], weights: [] };

/** Historial de entrenamiento y peso desde Postgres, con claves de día en la zona del usuario. */
export async function readGymHistory(): Promise<GymHistory> {
  const timezone = serverConfig.timezone;
  const [sessions, weights] = await Promise.all([
    prisma.workoutSession.findMany({
      orderBy: { date: "desc" },
      take: 600,
      include: { exercises: true },
    }),
    prisma.biometricLog.findMany({
      where: { weight: { not: null } },
      orderBy: { date: "desc" },
      take: 400,
      select: { date: true, weight: true },
    }),
  ]);

  return {
    sessions: sessions.map((session) => ({
      id: session.id,
      date: session.date.toISOString(),
      key: dateKey(session.date, timezone),
      title: session.title,
      duration: session.duration,
      volume: session.volume,
      exercises: session.exercises.map((exercise) => ({
        name: exercise.name,
        muscleId: exercise.muscleId,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
      })),
    })),
    weights: weights
      .filter((log) => log.weight !== null)
      .map((log) => ({ date: log.date.toISOString(), key: dateKey(log.date, timezone), weight: log.weight as number })),
  };
}
