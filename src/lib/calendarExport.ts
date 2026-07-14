import { getEventDateRange } from "@/lib/scheduleQueries";
import { FESTIVAL_TIMEZONE, type FestivalEvent } from "@/models/schedule";

const CALENDAR_PROD_ID = "-//JOMO 2.0//Festival Schedule//EN";

export function exportEventAsCalendarFile(event: FestivalEvent): void {
  if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
    throw new Error("Calendar export is only available in the web app.");
  }

  const payload = createEventCalendarPayload(event);
  const fileName = createCalendarFileName(event);
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

function createEventCalendarPayload(event: FestivalEvent): string {
  const { start, end } = getEventDateRange(event);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `PRODID:${CALENDAR_PROD_ID}`,
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(createEventUid(event))}`,
    `DTSTAMP:${formatUtcDateTime(new Date())}`,
    `DTSTART;TZID=${FESTIVAL_TIMEZONE}:${formatLocalDateTime(start)}`,
    `DTEND;TZID=${FESTIVAL_TIMEZONE}:${formatLocalDateTime(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description || "No description provided.")}`,
    `LOCATION:${escapeIcsText(event.location.name)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return `${lines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
}

function createEventUid(event: FestivalEvent): string {
  return `${event.id}@jomo-2.local`;
}

function createCalendarFileName(event: FestivalEvent): string {
  const safeTitle = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  return `${safeTitle || event.id}.ics`;
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
