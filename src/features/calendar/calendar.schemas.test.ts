import { describe, expect, it } from "vitest";
import { calendarEventArguments, calendarEventSchema } from "./calendar.schemas";

describe("calendar event boundary", () => {
  it("mantiene comillas como un argumento literal, no como código", () => {
    const title = `Junta con O'Reilly \"importante\"`;
    expect(calendarEventArguments({ title, date: "2026-08-20", startTime: "10:00", endTime: "11:00" })[0]).toBe(title);
  });

  it("rechaza horarios invertidos y caracteres de control", () => {
    expect(() => calendarEventSchema.parse({ title: "Evento", date: "2026-08-20", startTime: "12:00", endTime: "11:00" })).toThrow();
    expect(() => calendarEventSchema.parse({ title: "Evento\u0000", date: "2026-08-20", startTime: "10:00", endTime: "11:00" })).toThrow();
  });
});
