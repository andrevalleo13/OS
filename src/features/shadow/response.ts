import { z } from "zod";

const moodSchema = z.enum(["neutral", "success", "warning", "info", "urgent"]);
const widgetSchema = z.enum(["agenda", "stats", "none"]);

export function cleanShadowMetadata(text: string) {
  const moodMatch = text.match(/<mood>(.*?)<\/mood>/i);
  const widgetMatch = text.match(/<widget>(.*?)<\/widget>/i);
  return {
    mood: moodSchema.catch("neutral").parse(moodMatch?.[1]?.trim()),
    widget: widgetSchema.catch("none").parse(widgetMatch?.[1]?.trim()),
    text: text.replace(/<mood>.*?<\/mood>/gi, "").replace(/<widget>.*?<\/widget>/gi, "").trim(),
  };
}
