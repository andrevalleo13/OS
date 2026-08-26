import { z } from "zod";

export const calendarNameSchema = z.string().trim().min(1).max(120).refine(
  (value) => !/[\u0000-\u001f]/.test(value),
  "El calendario contiene caracteres inválidos.",
);

export const calendarEventSchema = z.object({
  title: z.string().trim().min(1).max(300).refine(
    (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value),
    "El título contiene caracteres inválidos.",
  ),
  date: z.iso.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  calendar: calendarNameSchema.default("andrevalleo13@gmail.com"),
}).refine((input) => input.endTime > input.startTime, {
  message: "La hora final debe ser posterior a la inicial.",
  path: ["endTime"],
});

export const deleteCalendarEventSchema = z.object({
  id: z.string().trim().min(1).max(500),
  calendar: calendarNameSchema,
});

export type CalendarEventInput = z.input<typeof calendarEventSchema>;

export function calendarEventArguments(input: CalendarEventInput): string[] {
  const parsed = calendarEventSchema.parse(input);
  const [year, month, day] = parsed.date.split("-");
  const [startHour, startMinute] = parsed.startTime.split(":");
  const [endHour, endMinute] = parsed.endTime.split(":");
  return [parsed.title, parsed.calendar, year, month, day, startHour, startMinute, endHour, endMinute];
}
