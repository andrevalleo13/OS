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

const METADATA_TAGS = ["<mood>", "<widget>"];

/**
 * Filtra el texto en streaming: deja pasar la respuesta y se detiene en cuanto
 * empiezan los metadatos de UI. Retiene un posible inicio de etiqueta al final
 * de cada fragmento ("<", "<wi"…) hasta saber si lo es.
 */
export class MetadataStripper {
  private pending = "";
  private closed = false;

  push(delta: string): string {
    if (this.closed) return "";
    this.pending += delta;
    const lower = this.pending.toLowerCase();
    const starts = METADATA_TAGS.map((tag) => lower.indexOf(tag)).filter((index) => index >= 0);
    if (starts.length > 0) {
      this.closed = true;
      const visible = this.pending.slice(0, Math.min(...starts));
      this.pending = "";
      return visible;
    }
    const open = this.pending.lastIndexOf("<");
    if (open >= 0 && METADATA_TAGS.some((tag) => tag.startsWith(lower.slice(open)))) {
      const visible = this.pending.slice(0, open);
      this.pending = this.pending.slice(open);
      return visible;
    }
    const visible = this.pending;
    this.pending = "";
    return visible;
  }

  /** Lo retenido que resultó no ser una etiqueta. */
  flush(): string {
    if (this.closed) return "";
    const visible = this.pending;
    this.pending = "";
    return visible;
  }
}
