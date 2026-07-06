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
const campHostAliases = new Map(
  Object.entries({
    "Circus the Analog": ["CIRCUS the ANALOG", "Circus teh Analog", "Circus the analogue"],
    "Club Sin": ["Club SIN"],
    "End of the Rainbow": ["End Of The Rainbow", "End of the Rainbow (Venue)"],
    "Gate of Alvheim": ["Gate Of Alvheim"],
    "House of glöd": ["House of Glöd"],
    "Jam camp": ["Jam Camp", "JAM CAMP", "JAM CAMP !", "JamCamp"],
    "Lazy camp": ["LAZY camp", "LAZY Camp"],
    "Löyhä liitto": ["Löyhä Liitto"],
    "Passage to Lemuria": ["Passage To Lemuria"],
    "Room of Requirements": ["Room of Requirement", "Room Of Requirement"],
    "Secret sailors": ["Secret Sailors"],
    "Silly sanctuary": ["Silly Sanctuary"],
    "Tantric Trolls": ["Tantric trolls", "Trantric Trolls", "The Tantric Trolls"],
    "Tea by the Sea": ["Tea By The Sea"],
    "The Bureau of Justice, Joy, Bubbles and Other Dangerous Ideas": [
      "The Bureau of Justice, Joy, Bubbles, and Other Dangerous Ideas"
    ],
    "The church": ["The Church"],
    "The Goslings": ["The goslings"],
    "The Heartspace": ["THE HEARTSPACE"],
    "The Sealions Den": ["The SeaLions Den"],
    "The secret outpost": ["the secret outpost", "The secret outpost!"],
    "The Sun": ["The SUN"],
    "The Tribe, Agraba Village": [
      "The Tribe, Agraba village",
      "The Tribe, Argaba Village",
      "The Tribe, Argaba village"
    ],
    "Welcome Home Darling": ["Welcome Home, Darling"],
    "Sacred Kink": ["Sacret Kink"],
    "The Observatory": ["The Obsetvatory", "The Obvervatory"],
    "Foajé Villa Hutlös": ["Foyaé Villa Hutlös"],
    "The Wrecked Yachtees Asylum": ["The Wracked Yachtees Asylum", "The Wrecked Yachtees"],
    "Women who support women": ["Women who supports women"],
    "Kishmastle Space Station": ["Kishmastle Spacestation"],
    "Njorunn's Garden": ["Njorunns Garden"],
    "Camp Spaceport": ["Spaceport", "By the fire in Camp Spaceport", "Spaceport Camp VIP Lounge"],
    "Camp Socialen": ["Socialen", "Camp Socialen", "Socialen Public Offering"],
    "All Senses, No Sense": ["Camp All Senses, No Sense", "All Senses, No Sense - East slope"],
    "Wild Sacred Fire": ["The Wild Sacred Fire"],
    "Grateful Grogg": ["The Grateful Grogg"],
    "Jousting Jesters": ["The Jousting Jesters"]
  }).flatMap(([canonical, aliases]) => [
    [normalizeCampHostKey(canonical), canonical] as const,
    ...aliases.map((alias) => [normalizeCampHostKey(alias), canonical] as const)
  ])
);

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

export function getCampHosts(): string[] {
  return Array.from(
    new Set(schedule.events.map((event) => event.campHost).filter(isDefinedString).map(getCanonicalCampHost))
  ).sort((a, b) => a.localeCompare(b));
}

export function getCanonicalCampHost(campHost: string): string {
  return campHostAliases.get(normalizeCampHostKey(campHost)) ?? campHost.trim();
}

export function campHostMatchesQuery(campHost: string, query: string): boolean {
  const canonical = getCanonicalCampHost(campHost);
  const normalizedQuery = normalizeCampHostKey(query);
  if (!normalizedQuery) {
    return true;
  }

  if (normalizeCampHostKey(canonical).includes(normalizedQuery)) {
    return true;
  }

  return Array.from(campHostAliases.entries()).some(
    ([aliasKey, aliasCanonical]) => aliasCanonical === canonical && aliasKey.includes(normalizedQuery)
  );
}

export interface EventSearchFilters {
  dayId?: string;
  category?: FestivalCategory | "all";
  query?: string;
  campHostsOnly?: boolean;
  campHosts?: string[];
}

export function getDefaultScheduleDayId(now = new Date()): string {
  const today = toLocalDateString(now);
  const matchingDay = schedule.days.find((day) => day.date === today);

  return matchingDay?.id ?? schedule.days[0]?.id ?? "";
}

export function searchEvents(filters: EventSearchFilters, now = new Date()): FestivalEvent[] {
  const query = normalizeSearch(filters.query ?? "");
  const selectedCampHosts = new Set((filters.campHosts ?? []).map(getCanonicalCampHost));
  const matchingEvents = schedule.events.filter((event) => {
    if (filters.dayId && event.dayId !== filters.dayId) {
      return false;
    }

    if (filters.category && filters.category !== "all" && event.category !== filters.category) {
      return false;
    }

    if (filters.campHostsOnly && !event.campHost) {
      return false;
    }

    if (
      selectedCampHosts.size > 0 &&
      (!event.campHost || !selectedCampHosts.has(getCanonicalCampHost(event.campHost)))
    ) {
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
        event.campHost,
        event.campHost ? getCanonicalCampHost(event.campHost) : undefined,
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

export function getEventStartTime(event: FestivalEvent): number {
  return createLocalDateTime(event.date, event.time.start).getTime();
}

export function getEventEndTime(event: FestivalEvent): number {
  const start = createLocalDateTime(event.date, event.time.start);
  const end = createLocalDateTime(event.date, event.time.end);

  if (event.time.crossesMidnight || end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1);
  }

  return end.getTime();
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeCampHostKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isDefinedString(value: string | undefined): value is string {
  return Boolean(value);
}

function getEventTiming(event: FestivalEvent, now: Date): { group: number; sortTime: number } {
  const startTime = getEventStartTime(event);
  const endTime = getEventEndTime(event);

  const nowTime = now.getTime();

  if (nowTime >= startTime && nowTime < endTime) {
    return { group: 0, sortTime: endTime };
  }

  if (nowTime < startTime) {
    return { group: 1, sortTime: startTime };
  }

  return { group: 2, sortTime: startTime };
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
