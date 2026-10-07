import { describe, expect, it } from "vitest";
import { cleanShadowMetadata, MetadataStripper } from "./response";

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

describe("MetadataStripper", () => {
  const run = (chunks: string[]) => {
    const stripper = new MetadataStripper();
    return chunks.map((chunk) => stripper.push(chunk)).join("") + stripper.flush();
  };

  it("deja pasar el texto y corta en los metadatos aunque lleguen partidos", () => {
    expect(run(["Listo, ", "lo regist", "ré.\n<mo", "od>success</mood><widget>none</widget>"])).toBe("Listo, lo registré.\n");
    expect(run(["Hola <", "widget>stats</widget>"])).toBe("Hola ");
  });

  it("no retiene un < que no es etiqueta", () => {
    expect(run(["3 <", " 5 y a<b"])).toBe("3 < 5 y a<b");
    expect(run(["termina en <"])).toBe("termina en <");
  });
});
