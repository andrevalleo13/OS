import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { publishLifeEvent } from "./events";

const conversationKeySchema = z.string().trim().min(1).max(240).refine(
  (value) => !/[\u0000-\u001f]/.test(value),
  "La clave de conversación contiene caracteres inválidos.",
);
const channelSchema = z.enum(["dashboard", "whatsapp", "system"]);
const storedMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(20_000),
  mood: z.string().trim().max(40).optional(),
  widget: z.string().trim().max(40).optional(),
});

export type StoredShadowMessage = z.infer<typeof storedMessageSchema>;

export async function getOrCreateConversation(externalKey: string, channel: string) {
  const safeKey = conversationKeySchema.parse(externalKey);
  const safeChannel = channelSchema.parse(channel);
  return prisma.shadowConversation.upsert({
    where: { externalKey: safeKey },
    create: { externalKey: safeKey, channel: safeChannel },
    update: { channel: safeChannel },
  });
}

export async function addConversationMessage(conversationId: string, input: StoredShadowMessage) {
  const safeConversationId = z.string().uuid().parse(conversationId);
  const message = storedMessageSchema.parse(input);
  const [created] = await prisma.$transaction([
    prisma.shadowMessage.create({
      data: {
        conversationId: safeConversationId,
        role: message.role,
        content: message.content,
        mood: message.mood,
        widget: message.widget,
      },
    }),
    prisma.shadowConversation.update({
      where: { id: safeConversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);
  await publishLifeEvent({
    type: "conversation.message",
    source: "shadow",
    sourceId: created.id,
    summary: `${message.role === "user" ? "Andre" : "Shadow"} agregó un mensaje a la conversación.`,
    payload: { conversationId: safeConversationId, role: message.role },
  });
  return created;
}

export async function getConversationPromptState(conversationId: string, limit = 24) {
  const safeConversationId = z.string().uuid().parse(conversationId);
  const [conversation, messages] = await Promise.all([
    prisma.shadowConversation.findUnique({
      where: { id: safeConversationId },
      select: { summary: true, summarizedMessageCount: true },
    }),
    getRecentConversationMessages(safeConversationId, limit),
  ]);
  return {
    summary: conversation?.summary ?? undefined,
    summarizedMessageCount: conversation?.summarizedMessageCount ?? 0,
    messages,
  };
}

export async function getRecentConversationMessages(conversationId: string, limit = 30) {
  const safeConversationId = z.string().uuid().parse(conversationId);
  const safeLimit = z.number().int().min(1).max(80).parse(limit);
  const messages = await prisma.shadowMessage.findMany({
    where: { conversationId: safeConversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: safeLimit,
    select: { role: true, content: true },
  });
  return messages.reverse() as Array<{ role: "user" | "assistant"; content: string }>;
}

export async function getConversationMessages(externalKey: string, limit = 80) {
  const safeKey = conversationKeySchema.parse(externalKey);
  const safeLimit = z.number().int().min(1).max(80).parse(limit);
  const conversation = await prisma.shadowConversation.findUnique({
    where: { externalKey: safeKey },
    select: {
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: safeLimit,
        select: { role: true, content: true, mood: true, widget: true, createdAt: true },
      },
    },
  });

  return (conversation?.messages ?? []).reverse().map((message) => ({
    sender: message.role === "user" ? "USR" as const : "SHDW" as const,
    text: message.content,
    mood: message.mood ?? undefined,
    widget: message.widget ?? undefined,
    createdAt: message.createdAt.toISOString(),
  }));
}

export async function importConversationMessages(
  externalKey: string,
  channel: string,
  input: unknown,
) {
  const messages = z.array(storedMessageSchema).max(80).parse(input);
  const conversation = await getOrCreateConversation(externalKey, channel);
  const existingCount = await prisma.shadowMessage.count({ where: { conversationId: conversation.id } });
  if (existingCount > 0 || messages.length === 0) return existingCount;

  await prisma.$transaction([
    prisma.shadowMessage.createMany({
      data: messages.map((message) => ({ conversationId: conversation.id, ...message })),
    }),
    prisma.shadowConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    }),
  ]);
  return messages.length;
}
