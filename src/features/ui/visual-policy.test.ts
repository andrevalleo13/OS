import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(process.cwd(), "src");

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(css|ts|tsx)$/.test(entry.name) && entry.name !== "visual-policy.test.ts" ? [target] : [];
  });
}

function location(file: string, content: string, index: number): string {
  const line = content.slice(0, index).split("\n").length;
  return `${path.relative(sourceRoot, file)}:${line}`;
}

describe("ValleOS visual policy", () => {
  it("keeps the interface monochrome", () => {
    const hueNames = ["red", "green", "blue", "purple", "violet", "cyan", "emerald", "amber", "orange", "yellow", "lime", "teal", "pink", "rose", "indigo", "sky", "fuchsia"];
    const hueUtility = new RegExp(`\\b(?:text|bg|border|from|via|to|ring|shadow)-(?:${hueNames.join("|")})-[0-9]+`, "g");
    const violations: string[] = [];

    for (const file of sourceFiles(sourceRoot)) {
      const content = fs.readFileSync(file, "utf8");
      for (const match of content.matchAll(hueUtility)) violations.push(location(file, content, match.index));
      for (const match of content.matchAll(/#[0-9a-fA-F]{6}/g)) {
        const value = match[0];
        const red = Number.parseInt(value.slice(1, 3), 16);
        const green = Number.parseInt(value.slice(3, 5), 16);
        const blue = Number.parseInt(value.slice(5, 7), 16);
        if (red !== green || green !== blue) violations.push(location(file, content, match.index));
      }
      for (const match of content.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
        if (match[1] !== match[2] || match[2] !== match[3]) violations.push(location(file, content, match.index));
      }
    }

    expect(violations).toEqual([]);
  });

  it("does not use AI sparkle iconography or internal page h1 elements", () => {
    const iconNames = ["Sparkles", "Stars", "Wand2"];
    const iconPattern = new RegExp(`\\b(?:${iconNames.join("|")})\\b`, "g");
    const violations: string[] = [];

    for (const file of sourceFiles(sourceRoot)) {
      const content = fs.readFileSync(file, "utf8");
      for (const match of content.matchAll(iconPattern)) violations.push(location(file, content, match.index));
      for (const match of content.matchAll(/<h1\b/g)) violations.push(location(file, content, match.index));
    }

    expect(violations).toEqual([]);
  });
});
