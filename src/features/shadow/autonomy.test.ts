import { describe, expect, it } from "vitest";
import { assessAutonomyRisk, validateAutomationPayload } from "./autonomy";

describe("Shadow autonomy policy", () => {
  it("clasifica comunicaciones externas como riesgo alto", () => {
    expect(assessAutonomyRisk("notification.macos")).toBe("low");
    expect(assessAutonomyRisk("email.draft")).toBe("medium");
    expect(assessAutonomyRisk("email.send")).toBe("high");
    expect(assessAutonomyRisk("whatsapp.send")).toBe("high");
  });

  it("rechaza destinatarios y horarios inválidos", () => {
    expect(() => validateAutomationPayload("email.send", { recipient: "no-email", subject: "Hola", body: "Texto" })).toThrow();
    expect(() => validateAutomationPayload("calendar.add", {
      title: "Cita", date: "2026-08-21", startTime: "25:00", endTime: "12:00",
    })).toThrow();
  });
});
