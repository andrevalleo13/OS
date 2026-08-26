import { describe, expect, it } from "vitest";
import { canonicalEntityKey } from "./life-graph";

describe("canonicalEntityKey", () => {
  it("unifica acentos, símbolos y mayúsculas", () => {
    expect(canonicalEntityKey("  Sofía (UP) ")).toBe("sofia up");
  });
});
