import { describe, expect, it } from "vitest";
import { resolveWithinRoot } from "./path-policy";

describe("resolveWithinRoot", () => {
  it("permite rutas internas", () => {
    expect(resolveWithinRoot("/Users/test", "Desktop/file.txt")).toBe("/Users/test/Desktop/file.txt");
  });

  it("rechaza traversal y hermanos con prefijo común", () => {
    expect(() => resolveWithinRoot("/vault", "../vault-secret/file.md")).toThrow(/permitida/);
    expect(() => resolveWithinRoot("/vault", "../../etc/passwd")).toThrow(/permitida/);
  });
});
