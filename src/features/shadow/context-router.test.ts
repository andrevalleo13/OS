import { describe, expect, it } from "vitest";
import { routeShadowContext } from "./context-router";

describe("routeShadowContext", () => {
  it("mantiene una conversación general fuera de Obsidian y de la DB", () => {
    expect(routeShadowContext("Explícame por qué el cielo es azul")).toEqual({
      intent: "general",
      domains: [],
      needsObsidian: false,
      needsDirectives: false,
      personalQuery: undefined,
    });
  });

  it("recupera únicamente los dominios operativos sugeridos", () => {
    const route = routeShadowContext("¿Cómo voy de proteína y qué entrenamiento toca?");
    expect(route.domains).toEqual(["nutrition", "fitness"]);
    expect(route.needsObsidian).toBe(false);
    expect(route.intent).toBe("operational");
  });

  it("activa memoria personal cuando la conversación la sugiere", () => {
    const route = routeShadowContext("¿Quién es Sofi y qué relación tiene con mi proyecto?");
    expect(route.needsObsidian).toBe(true);
    expect(route.personalQuery).toContain("Sofi");
  });

  it("incluye directivas solo para preferencias o planeación personal", () => {
    const route = routeShadowContext("No me digas cuando guardes algo, prefiero que sea silencioso");
    expect(route.needsDirectives).toBe(true);
    expect(route.intent).toBe("personal");
  });
});
