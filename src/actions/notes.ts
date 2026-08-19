"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getNotes() {
  try {
    const notes = await prisma.note.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return notes;
  } catch (error) {
    console.error("Failed to fetch notes:", error);
    return [];
  }
}

export async function addNote(title: string, content?: string) {
  try {
    const note = await prisma.note.create({
      data: { title, content },
    });
    revalidatePath("/");
    return note;
  } catch (error) {
    console.error("Failed to add note:", error);
    throw new Error("Failed to add note");
  }
}
