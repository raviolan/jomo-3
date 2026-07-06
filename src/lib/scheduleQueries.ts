import generatedSchedule from "@/data/generatedSchedule";
import type {
  FestivalCategory,
  FestivalDay,
  FestivalEvent,
  FestivalEventId,
  FestivalTag,
  NormalizedSchedule
} from "@/models/schedule";

export const schedule: NormalizedSchedule = generatedSchedule;

const byId = new Map(schedule.events.map((event) => [event.id, event]));
const tagAliases: Record<FestivalTag, string[]> = {
  "Adults only": ["Adult only", "Adults"],
  "Queer-inclusive": ["Queer inclusive", "Queer-focused", "Queer focused", "Queer"],
  "Sensory content": ["Sensory", "Sensory warning", "Sensory warnings"],
  "Sex positive": ["Sex-positive", "Sexpositive"],
  Sober: [],
  "Triggering themes": ["Triggering", "Trigger warning", "Trigger warnings"]
};
const tagAliasLookup = new Map(
  Object.entries(tagAliases).flatMap(([canonical, aliases]) => [
    [normalizeTagKey(canonical), canonical as FestivalTag] as const,
    ...aliases.map((alias) => [normalizeTagKey(alias), canonical as FestivalTag] as const)
  ])
);
const campHostAliases = new Map(
  Object.entries({
    "All Senses, No Sense": [
      "Camp All Senses, No Sense",
      "All Senses, No Sense - East slope",
      "All Senses, No Sense - East slope only"
    ],
    "B.L.U.E Bureau of Logical Universal Enquiries": ["B.L.U.E Bureau"],
    "Cheeky Butt Chill Camp": ["Cheeky Butt", "Chillcamp"],
    "Circus the Analog": ["CIRCUS the ANALOG", "Circus teh Analog", "Circus the analogue"],
    "Club Sin": ["Club SIN", "Club SIN only"],
    "Eld&Rötter Mystic Hammock Haven": ["Eld&Rötter (but start is next to Threshold)"],
    "Elven Saunacave": ["Elven Saunacave-DOME"],
    "End of the Rainbow": ["End Of The Rainbow", "End of the Rainbow (Venue)"],
    "Free camp": ["Free camping"],
    "Gate of Alvheim": ["Gate Of Alvheim"],
    GlitterTind: ["Glittertind in Trolltunga mini tent"],
    "House of glöd": ["House of Glöd"],
    "Jam camp": ["Jam Camp", "JAM CAMP", "JAM CAMP !", "JamCamp"],
    Kidsville: ["Kidsville dome", "Kidsville Workshop Dome"],
    "Lucifer's Pit": ["Lucifer's Pit · content"],
    "Lazy camp": ["LAZY camp", "LAZY Camp"],
    "Löyhä liitto": ["Löyhä Liitto"],
    MŸS: ["MYS Dome"],
    "Njorunns (Space) Garden": ["Njorunn's Garden", "Njorunns Garden"],
    "Passage to Lemuria": ["Passage To Lemuria"],
    "Pink Parachute": ["Pink Parachute & secret location in forest"],
    "Room of Requirements": ["Room of Requirement", "Room Of Requirement"],
    "Secret sailors": ["Secret Sailors"],
    "Secret Garden": ["Secret Garden · themes", "Secret Garden themes"],
    "Silly sanctuary": ["Silly Sanctuary", "Silly sanctuary content"],
    Somewhere: ["Somewhere in the hills", "somewhere near a fireplace"],
    "Tantric Trolls": ["Tantric trolls", "Trantric Trolls", "The Tantric Trolls"],
    "Tea by the Sea": ["Tea By The Sea", "Tea by the Sea dream"],
    "The Bear's Den": ["The Bears Den"],
    "The Bureau of Justice, Joy, Bubbles and Other Dangerous Ideas": [
      "The Bureau of Justice, Joy, Bubbles, and Other Dangerous Ideas"
    ],
    "The church": ["The Church"],
    "The Goslings": ["The goslings"],
    "The Heartspace": ["THE HEARTSPACE", "The Heartspace · themes"],
    "The Sealions Den": ["The SeaLions Den"],
    "The secret outpost": ["the secret outpost", "The secret outpost!"],
    "The Sun": ["The SUN"],
    "The Tribe": [
      "The Tribe (in Agrabah Village)",
      "The Tribe, Agraba Village",
      "The Tribe, Agraba village",
      "The Tribe, Argaba Village",
      "The Tribe, Argaba village"
    ],
    "Welcome Home Darling": ["Welcome Home, Darling", "Welcome Home Darling! (Meeting place)"],
    "Sacred Kink": ["Sacret Kink"],
    "The Observatory": ["The Obsetvatory", "The Obvervatory"],
    "Foajé Villa Hutlös": ["Foyaé Villa Hutlös"],
    "The Wrecked Yachtees Asylum": ["The Wracked Yachtees Asylum", "The Wrecked Yachtees"],
    "Kishmastle Space Station": ["Kishmastle Spacestation"],
    "Camp Spaceport": ["Spaceport", "By the fire in Camp Spaceport", "Spaceport Camp VIP Lounge"],
    "Camp Socialen": ["Socialen", "Camp Socialen", "Socialen Public Offering"],
    "Wild Sacred Fire": ["The Wild Sacred Fire", "Wild Sacred Fire · themes"],
    "Grateful Grogg": ["The Grateful Grogg"],
    "Jousting Jesters": ["The Jousting Jesters"],
    "Women who support women": ["Women who supports women"]
  }).flatMap(([canonical, aliases]) => [
    [normalizeCampHostKey(canonical), canonical] as const,
    ...aliases.map((alias) => [normalizeCampHostKey(alias), canonical] as const)
  ])
);
const campHostGroupAliases = new Map<string, string[]>([
  [normalizeCampHostKey("End of the Block Lounge in collab with Kidsville"), ["End of the Block Lounge", "Kidsville"]]
]);

export function getScheduleDays(): FestivalDay[] {
  return schedule.days;
}

export function getAllEvents(): FestivalEvent[] {
  return sortEvents(schedule.events);
}

export function getEventById(id: FestivalEventId): FestivalEvent | undefined {
  return byId.get(id);
}

export function getDayLabelForEvent(event: FestivalEvent): string {
  const day = schedule.days.find((item) => item.id === event.dayId);
  if (!day) {
    return event.date;
  }

  return day.label.split(/\s+/)[0] ?? event.date;
}

export function getEventsForDay(dayId: string): FestivalEvent[] {
  return sortEvents(schedule.events.filter((event) => event.dayId === dayId));
}

export function getCategories(): FestivalCategory[] {
  return Array.from(new Set(schedule.events.map((event) => event.category))).sort();
}

export function getTags(): FestivalTag[] {
  const presentTags = new Set(schedule.events.flatMap((event) => event.tags).map(getCanonicalTag));
  const stableTagOrder: FestivalTag[] = [
    "Adults only",
    "Queer-inclusive",
    "Sensory content",
    "Sex positive",
    "Sober",
    "Triggering themes"
  ];

  return stableTagOrder.filter((tag) => presentTags.has(tag));
}

export function getCanonicalTag(tag: string): FestivalTag {
  return tagAliasLookup.get(normalizeTagKey(tag)) ?? (tag as FestivalTag);
}

export function getSearchableTagTerms(tag: FestivalTag): string[] {
  const canonical = getCanonicalTag(tag);

  return [tag, canonical, ...(tagAliases[canonical] ?? [])];
}

export function tagMatchesQuery(tag: FestivalTag, query: string): boolean {
  const normalizedQuery = normalizeTagKey(query);
  if (!normalizedQuery) {
    return true;
  }

  return getSearchableTagTerms(tag).some((term) => normalizeTagKey(term).includes(normalizedQuery));
}

export function getEventTitleSuggestions(query: string, limit = 6, dayId?: string): string[] {
  return getEventSuggestions(query, limit, dayId).map((event) => event.title);
}

export function getEventSuggestions(query: string, limit = 6, dayId?: string): FestivalEvent[] {
  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery.length < 2) {
    return [];
  }

  const eventsByTitle = new Map<string, FestivalEvent>();
  const matchingEvents = sortEvents(schedule.events)
    .filter((event) => !dayId || event.dayId === dayId)
    .filter((event) => normalizeSearch(event.title).includes(normalizedQuery));

  for (const event of matchingEvents) {
    if (!eventsByTitle.has(event.title)) {
      eventsByTitle.set(event.title, event);
    }
  }

  return Array.from(eventsByTitle.values())
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function getCampHosts(): string[] {
  return Array.from(
    new Set(schedule.events.map((event) => event.campHost).filter(isDefinedString).flatMap(getCampHostGroups))
  ).sort((a, b) => getCampHostSortKey(a).localeCompare(getCampHostSortKey(b)));
}

export function getCanonicalCampHost(campHost: string): string {
  return campHostAliases.get(normalizeCampHostKey(campHost)) ?? campHost.trim();
}

export function getCampHostGroups(campHost: string): string[] {
  return campHostGroupAliases.get(normalizeCampHostKey(campHost)) ?? [getCanonicalCampHost(campHost)];
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
  tags?: FestivalTag[];
}

export function getDefaultScheduleDayId(now = new Date()): string {
  const today = toLocalDateString(now);
  const matchingDay = schedule.days.find((day) => day.date === today);

  return matchingDay?.id ?? schedule.days[0]?.id ?? "";
}

export function getDefaultHomeDayId(now = new Date()): string | undefined {
  const today = toLocalDateString(now);
  const matchingDay = schedule.days.find((day) => day.date === today);

  return matchingDay?.id;
}

export function searchEvents(filters: EventSearchFilters, now = new Date()): FestivalEvent[] {
  const query = normalizeSearch(filters.query ?? "");
  const selectedCampHosts = new Set((filters.campHosts ?? []).map(getCanonicalCampHost));
  const selectedTags = (filters.tags ?? []).map(getCanonicalTag);
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
      (!event.campHost || !getCampHostGroups(event.campHost).some((campHost) => selectedCampHosts.has(campHost)))
    ) {
      return false;
    }

    if (selectedTags.length > 0) {
      const eventTags = new Set(event.tags.map(getCanonicalTag));
      if (!selectedTags.every((tag) => eventTags.has(tag))) {
        return false;
      }
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
        ...(event.campHost ? getCampHostGroups(event.campHost) : []),
        event.location.name,
        event.location.area,
        event.location.gridSquare,
        event.location.notes,
        event.description,
        ...event.tags.flatMap(getSearchableTagTerms)
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

function normalizeTagKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function getCampHostSortKey(campHost: string): string {
  return campHost.replace(/^the\s+/i, "").toLocaleLowerCase();
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
