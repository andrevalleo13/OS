import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { calendarEventArguments, deleteCalendarEventSchema } from "./calendar.schemas";
import type { CalendarEventInput } from "./calendar.schemas";

const execFileAsync = promisify(execFile);
const processOptions = { timeout: 15_000, maxBuffer: 1024 * 1024 } as const;

const SCRIPT_GET_EVENTS = String.raw`
on replaceText(findText, replacementText, sourceText)
  set AppleScript's text item delimiters to findText
  set textItems to every text item of sourceText
  set AppleScript's text item delimiters to replacementText
  set sourceText to textItems as text
  set AppleScript's text item delimiters to ""
  return sourceText
end replaceText
set startDate to current date
set time of startDate to 0
set endDate to startDate + (14 * days)
set eventList to ""
tell application "Calendar"
  set targetCalendars to {"andrevalleo13@gmail.com", "Work", "Home", "Familia"}
  repeat with calName in targetCalendars
    if exists calendar calName then
      set cal to calendar calName
      set theEvents to every event of cal whose start date ≥ startDate and start date ≤ endDate
      repeat with ev in theEvents
        set safeSummary to my replaceText("|||", " ", summary of ev as text)
        set safeSummary to my replaceText(return, " ", safeSummary)
        set sDate to start date of ev
        set eDate to end date of ev
        set startValue to (year of sDate as text) & "-" & (month of sDate as integer as text) & "-" & (day of sDate as text) & " " & (time string of sDate)
        set endValue to (year of eDate as text) & "-" & (month of eDate as integer as text) & "-" & (day of eDate as text) & " " & (time string of eDate)
        set eventList to eventList & (uid of ev) & "|||" & safeSummary & "|||" & startValue & "|||" & endValue & "|||" & calName & linefeed
      end repeat
    end if
  end repeat
end tell
return eventList
`;

const SCRIPT_ADD_EVENT = String.raw`
on run argv
  set eventTitle to item 1 of argv
  set calendarName to item 2 of argv
  set eventYear to item 3 of argv as integer
  set eventMonth to item 4 of argv as integer
  set eventDay to item 5 of argv as integer
  set startHour to item 6 of argv as integer
  set startMinute to item 7 of argv as integer
  set endHour to item 8 of argv as integer
  set endMinute to item 9 of argv as integer
  set startDate to current date
  set year of startDate to eventYear
  set month of startDate to eventMonth
  set day of startDate to eventDay
  set hours of startDate to startHour
  set minutes of startDate to startMinute
  set seconds of startDate to 0
  set endDate to startDate
  set hours of endDate to endHour
  set minutes of endDate to endMinute
  tell application "Calendar"
    if not (exists calendar calendarName) then error "Calendar not found"
    tell calendar calendarName
      make new event with properties {summary:eventTitle, start date:startDate, end date:endDate}
    end tell
  end tell
end run
`;

const SCRIPT_DELETE_EVENT = String.raw`
on run argv
  set eventId to item 1 of argv
  set calendarName to item 2 of argv
  tell application "Calendar"
    if not (exists calendar calendarName) then error "Calendar not found"
    tell calendar calendarName
      set matches to every event whose uid is eventId
      repeat with matchingEvent in matches
        delete matchingEvent
      end repeat
    end tell
  end tell
end run
`;

export async function listCalendarEvents() {
  const { stdout } = await execFileAsync("osascript", ["-e", SCRIPT_GET_EVENTS], processOptions);
  return stdout.split("\n").filter(Boolean).map((line) => {
    const [id, title, start, end, calendar] = line.split("|||");
    return { id: id?.trim(), title: title?.trim(), start: start?.trim(), end: end?.trim(), calendar: calendar?.trim() };
  }).filter((event) => event.id);
}

export async function addCalendarEvent(input: CalendarEventInput) {
  const args = calendarEventArguments(input);
  await execFileAsync("osascript", [
    "-e", SCRIPT_ADD_EVENT, "--", ...args,
  ], processOptions);
}

export async function deleteCalendarEvent(input: unknown) {
  const parsed = deleteCalendarEventSchema.parse(input);
  await execFileAsync("osascript", ["-e", SCRIPT_DELETE_EVENT, "--", parsed.id, parsed.calendar], processOptions);
}
