import { getEventDateRange } from "@/lib/scheduleQueries";
import { FESTIVAL_TIMEZONE, type FestivalEvent } from "@/models/schedule";

const CALENDAR_PROD_ID = "-//JOMO 2.0//Festival Schedule//EN";

export function exportEventAsCalendarFile(event: FestivalEvent): void {
  exportEventsAsCalendarFile([event], { fileNameBase: createCalendarFileNameBase(event.title, event.id) });
}

export function exportEventsAsCalendarFile(
  events: FestivalEvent[],
  options?: { fileNameBase?: string }
): void {
  if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
    throw new Error("Calendar export is only available in the web app.");
  }

  if (events.length === 0) {
    throw new Error("No events available for calendar export.");
  }

  const payload = createEventCalendarPayload(events);
  const fileName = `${options?.fileNameBase ?? "jomo-saved-events"}.ics`;
  const blob = new Blob([payload], { type: "text/calendar;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  link.target = "_blank";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function createEventCalendarPayload(events: FestivalEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `PRODID:${CALENDAR_PROD_ID}`,
    ...events.flatMap(createEventLines),
    "END:VCALENDAR"
  ];

  return `${lines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
}

function createEventLines(event: FestivalEvent): string[] {
  const { start, end } = getEventDateRange(event);

  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(createEventUid(event))}`,
    `DTSTAMP:${formatUtcDateTime(new Date())}`,
    `DTSTART;TZID=${FESTIVAL_TIMEZONE}:${formatLocalDateTime(start)}`,
    `DTEND;TZID=${FESTIVAL_TIMEZONE}:${formatLocalDateTime(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description || "No description provided.")}`,
    `LOCATION:${escapeIcsText(event.location.name)}`,
    "END:VEVENT"
  ];
}

function createEventUid(event: FestivalEvent): string {
  return `${event.id}@jomo-2.local`;
}

function createCalendarFileNameBase(title: string, fallback: string): string {
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  return safeTitle || fallback;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string): string[] {
  const maxLineLength = 75;

  if (line.length <= maxLineLength) {
    return [line];
  }

  const segments: string[] = [];
  let remaining = line;

  while (remaining.length > maxLineLength) {
    segments.push(remaining.slice(0, maxLineLength));
    remaining = ` ${remaining.slice(maxLineLength)}`;
  }

  segments.push(remaining);
  return segments;
}

function formatLocalDateTime(value: Date): string {
  return [
    value.getFullYear(),
    padNumber(value.getMonth() + 1),
    padNumber(value.getDate()),
    "T",
    padNumber(value.getHours()),
    padNumber(value.getMinutes()),
    "00"
  ].join("");
}

function formatUtcDateTime(value: Date): string {
  return [
    value.getUTCFullYear(),
    padNumber(value.getUTCMonth() + 1),
    padNumber(value.getUTCDate()),
    "T",
    padNumber(value.getUTCHours()),
    padNumber(value.getUTCMinutes()),
    padNumber(value.getUTCSeconds()),
    "Z"
  ].join("");
}

function padNumber(value: number): string {
  return String(value).padStart(2, "0");
}
