import generatedSchedule from "@/data/generatedSchedule";
import type {
  FestivalCategory,
  FestivalDay,
  FestivalEvent,
  FestivalEventId,
  NormalizedSchedule
} from "@/models/schedule";

export const schedule: NormalizedSchedule = generatedSchedule;

const byId = new Map(schedule.events.map((event) => [event.id, event]));

export function getScheduleDays(): FestivalDay[] {
  return schedule.days;
}

export function getAllEvents(): FestivalEvent[] {
  return sortEvents(schedule.events);
}

export function getEventById(id: FestivalEventId): FestivalEvent | undefined {
  return byId.get(id);
}

export function getEventsForDay(dayId: string): FestivalEvent[] {
  return sortEvents(schedule.events.filter((event) => event.dayId === dayId));
}

export function getCategories(): FestivalCategory[] {
  return Array.from(new Set(schedule.events.map((event) => event.category))).sort();
}

export interface EventSearchFilters {
  dayId?: string;
  category?: FestivalCategory | "all";
  query?: string;
}

export function getDefaultScheduleDayId(now = new Date()): string {
  const today = toLocalDateString(now);
  const matchingDay = schedule.days.find((day) => day.date === today);

  return matchingDay?.id ?? schedule.days[0]?.id ?? "";
}

export function searchEvents(filters: EventSearchFilters, now = new Date()): FestivalEvent[] {
  const query = normalizeSearch(filters.query ?? "");
  const matchingEvents = schedule.events.filter((event) => {
    if (filters.dayId && event.dayId !== filters.dayId) {
      return false;
    }

    if (filters.category && filters.category !== "all" && event.category !== filters.category) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = normalizeSearch(
      [
        event.title,
        event.category,
        event.host,
        event.location.name,
        event.location.area,
        event.location.gridSquare,
        event.location.notes,
        event.description,
        ...event.tags
      ]
        .filter(Boolean)
        .join(" ")
    );

    return haystack.includes(query);
  });

  return sortEventsForSelectedDay(matchingEvents, filters.dayId, now);
}

export function sortEvents(events: FestivalEvent[]): FestivalEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }

    if (a.time.start !== b.time.start) {
      return a.time.start.localeCompare(b.time.start);
    }

    return a.title.localeCompare(b.title);
  });
}

export function sortEventsForSelectedDay(
  events: FestivalEvent[],
  selectedDayId: string | undefined,
  now = new Date()
): FestivalEvent[] {
  const selectedDay = schedule.days.find((day) => day.id === selectedDayId);

  if (!selectedDay || selectedDay.date !== toLocalDateString(now)) {
    return sortEvents(events);
  }

  return [...events].sort((a, b) => {
    const aTiming = getEventTiming(a, now);
    const bTiming = getEventTiming(b, now);

    if (aTiming.group !== bTiming.group) {
      return aTiming.group - bTiming.group;
    }

    if (aTiming.sortTime !== bTiming.sortTime) {
      return aTiming.sortTime - bTiming.sortTime;
    }

    return a.title.localeCompare(b.title);
  });
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function getEventTiming(event: FestivalEvent, now: Date): { group: number; sortTime: number } {
  const start = createLocalDateTime(event.date, event.time.start);
  const end = createLocalDateTime(event.date, event.time.end);

  if (event.time.crossesMidnight || end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1);
  }

  const nowTime = now.getTime();

  if (nowTime >= start.getTime() && nowTime < end.getTime()) {
    return { group: 0, sortTime: end.getTime() };
  }

  if (nowTime < start.getTime()) {
    return { group: 1, sortTime: start.getTime() };
  }

  return { group: 2, sortTime: start.getTime() };
}

function createLocalDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
