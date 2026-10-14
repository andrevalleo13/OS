import { describe, expect, it } from "vitest";
import { formatMoment, renderTemplate } from "./template";

const date = new Date(2026, 9, 14, 9, 5); // miércoles 14 de octubre de 2026, 09:05

describe("formatMoment", () => {
  it("formatea como moment.js en español", () => {
    expect(formatMoment(date, "YYYY-MM-DD")).toBe("2026-10-14");
    expect(formatMoment(date, "dddd, D [de] MMMM")).toBe("Miércoles, 14 de Octubre");
    expect(formatMoment(date, "HH:mm")).toBe("09:05");
    expect(formatMoment(date, "gggg-[W]ww")).toBe("2026-W42");
  });
});

describe("renderTemplate", () => {
  it("sustituye la sintaxis del core y de Templater", () => {
    const template = "# {{title}}\nfecha: {{date:YYYY-MM-DD}} · {{date:dddd}}\n<% tp.file.title %> <% tp.date.now(\"DD/MM\") %> <% tp.date.tomorrow(\"YYYY-MM-DD\") %>";
    expect(renderTemplate(template, { title: "2026-10-14", date })).toBe("# 2026-10-14\nfecha: 2026-10-14 · Miércoles\n2026-10-14 14/10 2026-10-15");
  });

  it("deja intactas las expresiones que no entiende", () => {
    expect(renderTemplate("<% tp.system.prompt(\"x\") %>", { title: "x", date })).toBe("<% tp.system.prompt(\"x\") %>");
  });
});
