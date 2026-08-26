import { describe, expect, it } from "vitest";
import { memorySimilarity } from "./memory-consolidation";

describe("memorySimilarity", () => {
  it("detecta recuerdos casi duplicados", () => {
    expect(memorySimilarity("Sofi conoce el proyecto Cord", "Sofi conoce Cord, el proyecto SaaS")).toBeGreaterThan(0.5);
  });

  it("separa recuerdos no relacionados", () => {
    expect(memorySimilarity("Andre entrena por la tarde", "Cord necesita nuevos clientes")).toBeLessThan(0.2);
  });
});
