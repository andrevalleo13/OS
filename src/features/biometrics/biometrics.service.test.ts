import { describe, expect, it } from "vitest";
import { biometricAverages, biometricReadiness } from "./biometrics.service";

describe("biometrics service", () => {
  it("ignora métricas ausentes al promediar", () => {
    expect(biometricAverages([{ weight: 60, sleep: null, hrv: 50, steps: null }, { weight: 62, sleep: 8, hrv: null, steps: 10000 }])).toEqual({ weight: 61, sleep: 8, hrv: 50, steps: 10000 });
  });

  it("limita readiness a una escala de 0 a 100", () => {
    expect(biometricReadiness({ sleep: 12, hrv: 150, steps: 30000 })).toBe(100);
  });
});
