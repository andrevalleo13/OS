"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export async function getCourses() {
  return await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      assignments: {
        where: { status: { not: "done" } },
        orderBy: { dueDate: "asc" }
      }
    }
  });
}

export async function getAssignments() {
  return await prisma.assignment.findMany({
    orderBy: { dueDate: "asc" },
    include: { course: true }
  });
}

export async function seedUniversityData() {
  const hasTrueData = await prisma.course.findFirst({ where: { name: "Finanzas Corporativas" } });
  const hasExamData = await prisma.course.findFirst({ where: { name: "Presupuestos" } });
  
  if (hasTrueData && hasExamData) return; // All data already exists

  // Delete all old data
  await prisma.assignment.deleteMany({});
  await prisma.course.deleteMany({});

  const year = new Date().getFullYear();
  
  // ============================================
  // MATERIAS DEL CALENDARIO DE EXÁMENES (7)
  // Parciales con fechas exactas del documento
  // ============================================

  // 1. Presupuestos (sáb)
  await prisma.course.create({
    data: { 
      name: "Presupuestos", professor: "Asignado", schedule: "Sáb", color: "#ef4444", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 1, 28), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 3, 18), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 4, 30), weight: 34 },
        ]
      }
    }
  });

  // 2. Derecho Laboral (mié)
  await prisma.course.create({
    data: { 
      name: "Derecho Laboral", professor: "Asignado", schedule: "Mié", color: "#a855f7", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 1, 25), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 3, 22), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 5, 3), weight: 34 },
        ]
      }
    }
  });

  // 3. Análisis Técnico (mar)
  await prisma.course.create({
    data: { 
      name: "Análisis Técnico", professor: "Asignado", schedule: "Mar", color: "#14b8a6", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 1, 17), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 3, 14), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 4, 26), weight: 34 },
        ]
      }
    }
  });

  // 4. Mercados Bursátiles (Cátedra) (jue)
  await prisma.course.create({
    data: { 
      name: "Mercados Bursátiles", professor: "Cátedra", schedule: "Jue", color: "#22c55e", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 1, 26), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 3, 23), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 5, 4), weight: 34 },
        ]
      }
    }
  });

  // 5. Probabilidad y Estadística Descriptiva (lun)
  await prisma.course.create({
    data: { 
      name: "Prob. y Estadística", professor: "Asignado", schedule: "Lun", color: "#f59e0b", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 1, 23), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 3, 20), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 5, 1), weight: 34 },
        ]
      }
    }
  });

  // 6. Análisis Financiero (mié)
  await prisma.course.create({
    data: { 
      name: "Análisis Financiero", professor: "Asignado", schedule: "Mié", color: "#06b6d4", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 1, 18), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 3, 15), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 4, 27), weight: 34 },
        ]
      }
    }
  });

  // 7. Competencias Personales (mié)
  await prisma.course.create({
    data: { 
      name: "Competencias Personales", professor: "Asignado", schedule: "Mié", color: "#ec4899", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 1, 18), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 3, 15), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 4, 27), weight: 34 },
        ]
      }
    }
  });

  // ============================================
  // MATERIAS DEL HORARIO DE GOOGLE CALENDAR (8)
  // Semestre Agosto - Diciembre
  // ============================================

  // 8. Análisis y Procesamiento de la Info
  await prisma.course.create({
    data: { 
      name: "Análisis y Proc. de Info", professor: "Asignado", schedule: "Lun/Jue 7:00am", color: "#dc2626", currentGrade: 0,
      absences: 2, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 8, 15), weight: 30 },
          { title: "2° Parcial", dueDate: new Date(year, 9, 20), weight: 30 },
          { title: "Proyecto Final", dueDate: new Date(year, 10, 25), weight: 40 },
        ]
      }
    }
  });

  // 9. Finanzas Corporativas
  await prisma.course.create({
    data: { 
      name: "Finanzas Corporativas", professor: "Asignado", schedule: "Lun/Jue 10:30am", color: "#f87171", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 8, 16), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 9, 21), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 10, 26), weight: 34 },
        ]
      }
    }
  });

  // 10. Derivados Financieros
  await prisma.course.create({
    data: { 
      name: "Derivados Financieros", professor: "Asignado", schedule: "Lun/Vie 1:30pm", color: "#ea580c", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 8, 17), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 9, 22), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 10, 27), weight: 34 },
        ]
      }
    }
  });

  // 11. Introducción al Cristianismo
  await prisma.course.create({
    data: { 
      name: "Intro al Cristianismo", professor: "Asignado", schedule: "Mar/Vie 10:00am", color: "#9333ea", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 8, 18), weight: 30 },
          { title: "2° Parcial", dueDate: new Date(year, 9, 23), weight: 30 },
          { title: "Trabajo Final", dueDate: new Date(year, 10, 28), weight: 40 },
        ]
      }
    }
  });

  // 12. Estadística Inferencial
  await prisma.course.create({
    data: { 
      name: "Estadística Inferencial", professor: "Asignado", schedule: "Mar/Jue 2:00pm", color: "#0284c7", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 8, 19), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 9, 24), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 10, 29), weight: 34 },
        ]
      }
    }
  });

  // 13. Macroeconomía
  await prisma.course.create({
    data: { 
      name: "Macroeconomía", professor: "Asignado", schedule: "Mié 7:00am", color: "#6366f1", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 8, 20), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 9, 25), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 10, 30), weight: 34 },
        ]
      }
    }
  });

  // 14. Análisis de Inversiones
  await prisma.course.create({
    data: { 
      name: "Análisis de Inversiones", professor: "Asignado", schedule: "Mié 4:00pm", color: "#4338ca", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 8, 21), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 9, 26), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 11, 1), weight: 34 },
        ]
      }
    }
  });

  // 15. Fintech
  await prisma.course.create({
    data: { 
      name: "Fintech", professor: "Asignado", schedule: "Jue/Vie 8:30am / 12pm", color: "#10b981", currentGrade: 0,
      absences: 0, maxAbsences: 6,
      assignments: {
        create: [
          { title: "1° Parcial", dueDate: new Date(year, 8, 22), weight: 33 },
          { title: "2° Parcial", dueDate: new Date(year, 9, 27), weight: 33 },
          { title: "3° Parcial", dueDate: new Date(year, 11, 2), weight: 34 },
        ]
      }
    }
  });
}
