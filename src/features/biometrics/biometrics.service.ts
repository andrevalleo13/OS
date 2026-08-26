export type BiometricPoint = { weight: number | null; sleep: number | null; hrv: number | null; steps: number | null };

export function biometricAverages(points: BiometricPoint[]) {
  const average = (values: Array<number | null>) => {
    const valid = values.filter((value): value is number => value !== null);
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  };
  return {
    weight: average(points.map((point) => point.weight)),
    sleep: average(points.map((point) => point.sleep)),
    hrv: average(points.map((point) => point.hrv)),
    steps: average(points.map((point) => point.steps)),
  };
}

export function biometricReadiness(input: { sleep: number | null; hrv: number | null; steps: number | null }) {
  const sleepScore = input.sleep === null ? 60 : Math.min(100, Math.max(0, input.sleep / 8 * 100));
  const hrvScore = input.hrv === null ? 60 : Math.min(100, Math.max(0, input.hrv / 70 * 100));
  const activityScore = input.steps === null ? 60 : Math.min(100, Math.max(30, input.steps / 10000 * 100));
  return Math.round(sleepScore * 0.45 + hrvScore * 0.35 + activityScore * 0.2);
}
