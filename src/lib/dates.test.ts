import { describe, expect, it } from "vitest";
import { dateKey, dayRange } from "./dates";

describe("ValleOS dates", () => {
  it("mantiene el día de Ciudad de México cerca de medianoche UTC", () => {
    expect(dateKey(new Date("2026-08-21T03:30:00.000Z"), "America/Mexico_City")).toBe("2026-08-20");
  });

  it("crea un rango que contiene el instante local", () => {
    const instant = new Date("2026-08-21T03:30:00.000Z");
    const range = dayRange(instant, "America/Mexico_City");
    expect(range.start.getTime()).toBeLessThanOrEqual(instant.getTime());
    expect(range.end.getTime()).toBeGreaterThanOrEqual(instant.getTime());
  });
});
