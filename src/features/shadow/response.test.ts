import { describe, expect, it } from "vitest";
import { cleanShadowMetadata } from "./response";

describe("cleanShadowMetadata", () => {
  it("extrae metadatos válidos y limpia el texto", () => {
    expect(cleanShadowMetadata("Listo. <mood>success</mood><widget>agenda</widget>")).toEqual({
      text: "Listo.", mood: "success", widget: "agenda",
    });
  });

  it("degrada valores inventados a opciones seguras", () => {
    expect(cleanShadowMetadata("Hola <mood>hacked</mood><widget>shell</widget>")).toEqual({
      text: "Hola", mood: "neutral", widget: "none",
    });
  });
});
