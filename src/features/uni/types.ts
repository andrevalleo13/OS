/**
 * Tipos del módulo Universidad compartidos entre servidor y cliente.
 * Sin dependencias de servidor: se pueden importar desde componentes cliente.
 */

export type RiskLevel = "critico" | "alto" | "medio" | "bajo";
export type ExamKind = "P1" | "P2" | "P3" | "Final" | "Control" | "Otro";
export type DataSource = "boveda" | "diario" | "db";

export type UniTopic = { text: string; note: string | null; focus: boolean };

export type UniExamStatus = "hecho" | "hoy" | "proximo" | "sin-resultado";

export type UniExam = {
  id: string;
  subjectId: string;
  subject: string;
  kind: ExamKind;
  label: string;
  /** Fecha civil `YYYY-MM-DD` en la zona horaria de la bóveda. */
  date: string;
  /** `HH:mm` si se conoce. */
  time: string | null;
  /** De dónde salió la hora: anotada en la bóveda/diario o inferida del horario de clase. */
  timeSource: "nota" | "horario" | null;
  /** Instante ISO cuando hay hora. */
  at: string | null;
  place: string | null;
  grade: number | null;
  /** Peso sobre la calificación final, en %. */
  weight: number | null;
  status: UniExamStatus;
  daysUntil: number;
  source: DataSource;
  risk: RiskLevel;
};

export type UniComponent = {
  kind: ExamKind | "Tareas" | "Proyecto";
  label: string;
  /** Peso en % sobre la final. */
  weight: number;
  grade: number | null;
  date: string | null;
  assumed: boolean;
};

export type UniMention = { date: string; text: string; path: string };

export type SubjectStanding = "asegurada" | "en-control" | "exigente" | "fuera-de-alcance" | "sin-datos";

export type UniSubject = {
  id: string;
  name: string;
  fullName: string | null;
  codes: string[];
  aliases: string[];
  professor: string | null;
  email: string | null;
  schedule: string | null;
  place: string | null;
  components: UniComponent[];
  weightsAssumed: boolean;
  /** Promedio ponderado de lo ya calificado (0-10). */
  current: number | null;
  /** Puntos ya ganados sobre la final (0-10). */
  securedPoints: number;
  /** Fracción (0-1) del peso total que ya tiene calificación. */
  gradedWeight: number;
  /** Promedio necesario en lo que falta para cerrar la materia en el umbral de beca. */
  neededForThreshold: number | null;
  /** Promedio necesario en lo que falta para aprobar (6.0). */
  neededToPass: number | null;
  standing: SubjectStanding;
  absences: { used: number | null; limit: number; remaining: number | null; level: RiskLevel };
  risk: { level: RiskLevel; reasons: string[] };
  nextExam: UniExam | null;
  topics: UniTopic[];
  laterTopics: string[];
  tips: string[];
  details: { label: string; value: string }[];
  mentions: UniMention[];
  notePath: string | null;
  dbCourseId: string | null;
  sources: DataSource[];
};

export type UniScholarship = {
  threshold: number;
  percent: number | null;
  current: number | null;
  /** Promedio necesario en todo lo que falta del semestre para cerrar ≥ umbral. */
  neededRemaining: number | null;
  /** Promedio final si sacas 10 en todo lo que falta. */
  ceiling: number | null;
  securedPointsTotal: number;
  remainingWeightTotal: number;
  subjectsCounted: number;
  secured: string[];
  dragging: { id: string; name: string; delta: number }[];
  balance: { id: string; name: string; current: number; delta: number }[];
};

export type UniStudyItem = {
  examId: string;
  subjectId: string;
  subject: string;
  label: string;
  date: string;
  time: string | null;
  daysUntil: number;
  /** 0-100, relativo al ítem más urgente. */
  priority: number;
  today: boolean;
  target: number | null;
  reasons: string[];
  topics: UniTopic[];
  tip: string | null;
};

export type UniAssignment = {
  id: string;
  title: string;
  courseId: string;
  course: string;
  subjectId: string | null;
  dueDate: string;
  status: string;
  effectiveStatus: "pending" | "in-progress" | "done";
  weight: number | null;
  grade: number | null;
  synced: DataSource | null;
  archived: boolean;
};

export type UniOverview = {
  generatedAt: string;
  today: string;
  timezone: string;
  vault: { available: boolean; notePath: string | null; updatedAt: string | null; reason: string | null };
  db: { available: boolean };
  /** Semana de exámenes: `start/end` según el HQ; `rangeStart/rangeEnd` incluye los exámenes del mismo calendario. */
  window: { label: string; start: string; end: string; rangeStart: string; rangeEnd: string; active: boolean; day: number; days: number } | null;
  alerts: { title: string; body: string; path: string }[];
  subjects: UniSubject[];
  exams: UniExam[];
  finals: UniExam[];
  nextExam: UniExam | null;
  scholarship: UniScholarship;
  study: UniStudyItem[];
  assignments: UniAssignment[];
  courses: { id: string; name: string; current: boolean }[];
};
