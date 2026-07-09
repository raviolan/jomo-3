import generatedSchedule from "@/data/generatedSchedule";
import {
  getCampAliasesForCanonical,
  getCampHostGroups,
  getCanonicalCampHost,
  getCanonicalHost,
  getHostAliasesForCanonical,
  getRawCampHostLabelsForEvent,
  getRawHostLabelsForEvent,
  normalizeAssociationKey,
  resolveCampHostSelection,
  resolveHostSelection
} from "@/lib/campAliases";
import { getAdjacentGridSquares } from "@/lib/mapGrid";
import type {
  FestivalCategory,
  FestivalCampListing,
  FestivalDay,
  FestivalEvent,
  FestivalEventId,
  FestivalTag,
  GridSquareRef,
  NormalizedSchedule
} from "@/models/schedule";

export {
  getCampHostGroups,
  getCanonicalCampHost,
  getCanonicalHost,
  getRawCampHostLabelsForEvent,
  getRawHostLabelsForEvent,
  resolveCampHostSelection,
  resolveHostSelection
};

export const schedule: NormalizedSchedule = generatedSchedule;

export interface CampLocationGroup {
  camps: string[];
  square: GridSquareRef;
}

interface SearchQuery {
  exact: string;
  terms: string[];
}

interface SearchFieldIndex {
  text: string;
  terms: string[];
}

interface SearchIndex {
  primary: SearchFieldIndex;
  secondary: SearchFieldIndex;
  description: SearchFieldIndex;
  full: SearchFieldIndex;
}

const byId = new Map(schedule.events.map((event) => [event.id, event]));
const campListingsById = new Map(schedule.campListings.map((listing) => [listing.id, listing]));
const campListingsByName = new Map(schedule.campListings.map((listing) => [normalizeCampHostKey(listing.name), listing]));
const campListingsByCanonicalName = schedule.campListings.reduce((map, listing) => {
  const canonicalName = getCanonicalCampHost(listing.name);
  const existing = map.get(canonicalName) ?? [];
  existing.push(listing);
  map.set(canonicalName, existing);
  return map;
}, new Map<string, FestivalCampListing[]>());
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

export function getScheduleDays(): FestivalDay[] {
  return schedule.days;
}

export function getAllEvents(): FestivalEvent[] {
  return sortEvents(schedule.events);
}

export function getEventById(id: FestivalEventId): FestivalEvent | undefined {
  return byId.get(id);
}

export function getEventHosts(event: FestivalEvent): string[] {
  return Array.from(new Set(getRawHostLabelsForEvent(event).map(getCanonicalHost).filter(Boolean)));
}

export function getEventCampHosts(event: FestivalEvent): string[] {
  return Array.from(new Set(getRawCampHostLabelsForEvent(event).flatMap(getCampHostGroups)));
}

export function getEventsForGridSquare(square: GridSquareRef): FestivalEvent[] {
  return sortEvents(schedule.events.filter((event) => event.gridSquares?.some((item) => item.key === square.key)));
}

export function getEventsForAdjacentGridSquares(square: GridSquareRef): FestivalEvent[] {
  const adjacentSquareKeys = new Set(getAdjacentGridSquares(square).map((item) => item.key));
  const eventsById = new Map<FestivalEventId, FestivalEvent>();

  for (const event of schedule.events) {
    if (event.gridSquares?.some((item) => adjacentSquareKeys.has(item.key))) {
      eventsById.set(event.id, event);
    }
  }

  return sortEvents(Array.from(eventsById.values()));
}

export function getCampListings(): FestivalCampListing[] {
  return [...schedule.campListings].sort((a, b) => a.name.localeCompare(b.name));
}

export function getCampListingById(id: string): FestivalCampListing | undefined {
  return campListingsById.get(id);
}

export function getCampListingByName(name: string): FestivalCampListing | undefined {
  const normalizedName = normalizeCampHostKey(name);
  const directMatch = campListingsByName.get(normalizedName);
  if (directMatch) {
    return directMatch;
  }

  return campListingsByCanonicalName.get(getCanonicalCampHost(name))?.[0];
}

export function getCampListingsForCampHost(name: string): FestivalCampListing[] {
  return campListingsByCanonicalName.get(getCanonicalCampHost(name)) ?? [];
}

export function getCampLocationsByGridSquare(): CampLocationGroup[] {
  const campsBySquare = new Map<string, { camps: Set<string>; square: GridSquareRef }>();

  for (const event of schedule.events) {
    const campHosts = getEventCampHosts(event);
    if (campHosts.length === 0 || !event.gridSquares?.length) {
      continue;
    }

    for (const square of event.gridSquares) {
      const existing = campsBySquare.get(square.key) ?? { camps: new Set<string>(), square };
      for (const campHost of campHosts) {
        existing.camps.add(campHost);
      }
      campsBySquare.set(square.key, existing);
    }
  }

  for (const listing of schedule.campListings) {
    if (!listing.gridSquares?.length) {
      continue;
    }

    for (const square of listing.gridSquares) {
      const existing = campsBySquare.get(square.key) ?? { camps: new Set<string>(), square };
      existing.camps.add(getCanonicalCampHost(listing.name));
      campsBySquare.set(square.key, existing);
    }
  }

  return Array.from(campsBySquare.values())
    .map(({ camps, square }) => ({
      camps: Array.from(camps).sort((a, b) => getCampHostSortKey(a).localeCompare(getCampHostSortKey(b))),
      square
    }))
    .sort((a, b) => a.square.key.localeCompare(b.square.key));
}

export function getCampsForGridSquare(square: GridSquareRef): string[] {
  return getCampLocationsByGridSquare().find((item) => item.square.key === square.key)?.camps ?? [];
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

export function getEventsForCampHost(campHost: string): FestivalEvent[] {
  const canonicalCampHost = getCanonicalCampHost(campHost);
  return sortEvents(
    schedule.events.filter((event) => getEventCampHosts(event).includes(canonicalCampHost))
  );
}

export function getEventsForHost(host: string): FestivalEvent[] {
  const canonicalHost = getCanonicalHost(host);
  return sortEvents(schedule.events.filter((event) => getEventHosts(event).includes(canonicalHost)));
}

export function getMatchedCampHostLabelForEvent(event: FestivalEvent, canonicalCampHosts: string[]): string | undefined {
  const selectedCampHosts = new Set(canonicalCampHosts.map(getCanonicalCampHost));
  const matchingLabels = getRawCampHostLabelsForEvent(event).filter((label) =>
    getCampHostGroups(label).some((campHost) => selectedCampHosts.has(campHost))
  );

  return matchingLabels.length > 0 ? matchingLabels.join(" · ") : event.campHost;
}

export function getMatchedHostLabelForEvent(event: FestivalEvent, canonicalHosts: string[]): string | undefined {
  const selectedHosts = new Set(canonicalHosts.map(getCanonicalHost));
  const matchingLabels = getRawHostLabelsForEvent(event).filter((label) => selectedHosts.has(getCanonicalHost(label)));

  return matchingLabels.length > 0 ? matchingLabels.join(" · ") : event.host;
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
  const searchQuery = createSearchQuery(query);
  if (!searchQuery.exact) {
    return true;
  }

  const index = createSearchIndex(getSearchableTagTerms(tag));
  return matchesSearchIndex(index, searchQuery);
}

export function getEventTitleSuggestions(query: string, limit = 6, dayId?: string): string[] {
  return getEventSuggestions(query, limit, dayId).map((event) => event.title);
}

export function getEventSuggestions(query: string, limit = 6, dayId?: string): FestivalEvent[] {
  const searchQuery = createSearchQuery(query);
  if (searchQuery.exact.length < 2) {
    return [];
  }

  const eventsByTitle = new Map<string, FestivalEvent>();
  const matchingEvents = sortEvents(schedule.events)
    .filter((event) => !dayId || event.dayId === dayId)
    .filter((event) => matchesSearchIndex(getEventSearchIndex(event), searchQuery));

  for (const event of matchingEvents) {
    if (!eventsByTitle.has(event.title)) {
      eventsByTitle.set(event.title, event);
    }
  }

  return Array.from(eventsByTitle.values())
    .sort((a, b) => compareSuggestedEvents(a, b, searchQuery))
    .slice(0, limit);
}

export function getCampHosts(): string[] {
  const byNormalizedName = new Map<string, string>();

  for (const campHost of schedule.events.flatMap(getEventCampHosts)) {
    byNormalizedName.set(normalizeCampHostKey(campHost), campHost);
  }

  for (const listing of schedule.campListings) {
    const normalizedName = normalizeCampHostKey(getCanonicalCampHost(listing.name));
    if (!byNormalizedName.has(normalizedName)) {
      byNormalizedName.set(normalizedName, getCanonicalCampHost(listing.name));
    }
  }

  return Array.from(byNormalizedName.values()).sort((a, b) => getCampHostSortKey(a).localeCompare(getCampHostSortKey(b)));
}

export function campHostMatchesQuery(campHost: string, query: string): boolean {
  const canonical = getCanonicalCampHost(campHost);
  if (getCanonicalCampHost(query) === canonical) {
    return true;
  }

  const listings = getCampListingsForCampHost(campHost);
  const searchQuery = createSearchQuery(query);
  if (!searchQuery.exact) {
    return true;
  }

  const aliases = getCampAliasesForCanonical(canonical);
  const index = createSearchIndex([
    campHost,
    canonical,
    ...aliases,
    ...listings.flatMap(getSearchPartsFromCampListing)
  ]);

  return matchesSearchIndex(index, searchQuery);
}

export interface EventSearchFilters {
  dayId?: string;
  category?: FestivalCategory | "all";
  query?: string;
  hosts?: string[];
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
  const searchQuery = createSearchQuery(filters.query ?? "");
  const selectedCampHosts = new Set((filters.campHosts ?? []).map(getCanonicalCampHost));
  const selectedHosts = new Set((filters.hosts ?? []).map(getCanonicalHost));
  const selectedTags = (filters.tags ?? []).map(getCanonicalTag);
  const matchingEvents = schedule.events.filter((event) => {
    if (filters.dayId && event.dayId !== filters.dayId) {
      return false;
    }

    if (filters.category && filters.category !== "all" && event.category !== filters.category) {
      return false;
    }

    const eventCampHosts = getEventCampHosts(event);
    const eventHosts = getEventHosts(event);

    if (filters.campHostsOnly && eventCampHosts.length === 0) {
      return false;
    }

    if (selectedCampHosts.size > 0 && !eventCampHosts.some((campHost) => selectedCampHosts.has(campHost))) {
      return false;
    }

    if (selectedHosts.size > 0 && !eventHosts.some((host) => selectedHosts.has(host))) {
      return false;
    }

    if (selectedTags.length > 0) {
      const eventTags = new Set(event.tags.map(getCanonicalTag));
      if (!selectedTags.every((tag) => eventTags.has(tag))) {
        return false;
      }
    }

    if (!searchQuery.exact) {
      return true;
    }

    return matchesSearchIndex(getEventSearchIndex(event), searchQuery);
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
  return normalizeAssociationKey(value).replace(/\band\b/g, " and ").replace(/\s+/g, " ").trim();
}

function normalizeTagKey(value: string): string {
  return normalizeSearch(value);
}

function normalizeCampHostKey(value: string): string {
  return normalizeAssociationKey(value);
}

function getCampHostSortKey(campHost: string): string {
  return campHost.replace(/^the\s+/i, "").toLocaleLowerCase();
}

function getSearchPartsFromCampListing(listing: FestivalCampListing): string[] {
  const canonicalName = getCanonicalCampHost(listing.name);
  const aliases = getCampAliasesForCanonical(canonicalName);

  return compactDefinedStrings([
    listing.name,
    listing.type,
    canonicalName,
    ...aliases,
    listing.location.name,
    listing.location.area,
    listing.location.gridSquare,
    listing.location.notes,
    ...(listing.gridSquares ?? []).flatMap((square) => [square.key, square.label]),
    listing.description,
    ...listing.tags.flatMap(getSearchableTagTerms)
  ]);
}

function getEventSearchIndex(event: FestivalEvent): SearchIndex {
  const eventHosts = getEventHosts(event);
  const eventCampHosts = getEventCampHosts(event);
  const rawHosts = getRawHostLabelsForEvent(event);
  const rawCampHosts = getRawCampHostLabelsForEvent(event);
  const campAliases = eventCampHosts.flatMap(getCampAliasesForCanonical);
  const hostAliases = eventHosts.flatMap(getHostAliasesForCanonical);
  const gridTerms = (event.gridSquares ?? []).flatMap((square) => [square.key, square.label]);

  return createSearchIndex(
    [event.title],
    [
      event.category,
      ...rawHosts,
      ...eventHosts,
      ...rawCampHosts,
      ...eventCampHosts,
      ...campAliases,
      ...hostAliases,
      event.location.name,
      event.location.area,
      event.location.gridSquare,
      ...gridTerms,
      event.location.notes,
      ...event.tags.flatMap(getSearchableTagTerms)
    ],
    [event.description]
  );
}

function compareSuggestedEvents(a: FestivalEvent, b: FestivalEvent, searchQuery: SearchQuery): number {
  const rankDifference = getSuggestionRank(getEventSearchIndex(a), searchQuery) - getSuggestionRank(getEventSearchIndex(b), searchQuery);
  if (rankDifference !== 0) {
    return rankDifference;
  }

  return compareEventsByDateTimeTitle(a, b);
}

function getSuggestionRank(index: SearchIndex, searchQuery: SearchQuery): number {
  if (index.primary.text.startsWith(searchQuery.exact) || index.primary.text.includes(searchQuery.exact)) {
    return 0;
  }

  if (matchesSearchField(index.primary, searchQuery)) {
    return 1;
  }

  if (matchesSearchField(index.secondary, searchQuery)) {
    return 2;
  }

  if (matchesSearchField(index.description, searchQuery)) {
    return 3;
  }

  return 4;
}

function createSearchQuery(value: string): SearchQuery {
  const exact = normalizeSearch(value);
  return {
    exact,
    terms: getExpandedSearchTerms(value)
  };
}

function createSearchIndex(
  primaryParts: (string | undefined)[],
  secondaryParts: (string | undefined)[] = [],
  descriptionParts: (string | undefined)[] = []
): SearchIndex {
  const primary = createSearchFieldIndex(primaryParts);
  const secondary = createSearchFieldIndex(secondaryParts);
  const description = createSearchFieldIndex(descriptionParts);

  return {
    primary,
    secondary,
    description,
    full: createSearchFieldIndex([...primaryParts, ...secondaryParts, ...descriptionParts])
  };
}

function createSearchFieldIndex(parts: (string | undefined)[]): SearchFieldIndex {
  const normalizedParts = compactDefinedStrings(parts);
  const text = normalizeSearch(normalizedParts.join(" "));
  return {
    text,
    terms: getExpandedSearchTerms(normalizedParts.join(" "))
  };
}

function getExpandedSearchTerms(value: string): string[] {
  const normalized = normalizeSearch(value);
  if (!normalized) {
    return [];
  }

  const baseTokens = normalized.split(" ").filter(Boolean);
  const terms = new Set(baseTokens);

  for (const run of getSingleLetterRuns(baseTokens)) {
    for (let start = 0; start < run.length; start += 1) {
      for (let end = start + 2; end <= run.length; end += 1) {
        terms.add(run.slice(start, end).join(""));
      }
    }
  }

  return Array.from(terms);
}

function getSingleLetterRuns(tokens: string[]): string[][] {
  const runs: string[][] = [];
  let currentRun: string[] = [];

  for (const token of tokens) {
    if (/^[a-z]$/.test(token)) {
      currentRun.push(token);
      continue;
    }

    if (currentRun.length > 1) {
      runs.push(currentRun);
    }
    currentRun = [];
  }

  if (currentRun.length > 1) {
    runs.push(currentRun);
  }

  return runs;
}

function matchesSearchIndex(index: SearchIndex, searchQuery: SearchQuery): boolean {
  if (!searchQuery.exact) {
    return true;
  }

  if (index.full.text.includes(searchQuery.exact)) {
    return true;
  }

  return searchQuery.terms.every((term) => index.full.terms.includes(term));
}

function matchesSearchField(field: SearchFieldIndex, searchQuery: SearchQuery): boolean {
  if (!searchQuery.exact) {
    return true;
  }

  if (field.text.includes(searchQuery.exact)) {
    return true;
  }

  return searchQuery.terms.every((term) => field.terms.includes(term));
}

function compareEventsByDateTimeTitle(a: FestivalEvent, b: FestivalEvent): number {
  if (a.date !== b.date) {
    return a.date.localeCompare(b.date);
  }

  if (a.time.start !== b.time.start) {
    return a.time.start.localeCompare(b.time.start);
  }

  return a.title.localeCompare(b.title);
}

function isDefinedString(value: string | undefined): value is string {
  return Boolean(value);
}

function compactDefinedStrings(values: (string | undefined)[]): string[] {
  return values.filter(isDefinedString);
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
