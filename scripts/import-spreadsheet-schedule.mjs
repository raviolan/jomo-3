import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import generatedSchedule from "../src/data/generatedSchedule.ts";
import {
  applyKnownVenueLocation,
  buildDays,
  buildScheduleFromPdf,
  cleanTitle,
  computeEventGridSquares,
  createDayId,
  extractGridSquareRefsFromText,
  getCanonicalCampLabel,
  normalizeTime,
  parseLocation,
  pdfPath,
  slugify,
  sourcePdf
} from "./import-pdf-schedule.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputPath = path.join(rootDir, "src/data/generatedSchedule.ts");

const sheetId = "1g4EQzlX2hg0TLq2WOUgSIbY4WyCzDTtizdw7eRB7XR0";
const spreadsheetSource = `spreadsheet:${sheetId}`;
const publishedTabs = {
  events: 1641296636,
  destinations: 1926215512,
  placement: 925400118
};

const supportedTags = [
  "Kids friendly",
  "Adults only",
  "Sex positive",
  "Sober",
  "Sensory content",
  "Triggering themes",
  "Queer-inclusive",
  "Queer-focused"
];

const spreadsheetCategoryMap = new Map([
  ["Art/Installation", "Art/Installation"],
  ["Care/Support/Pampering", "Care/Support/Pampering"],
  ["Pampering/Care", "Care/Support/Pampering"],
  ["Crafting/Pimping/Arting", "Crafting/Pimping/Arting"],
  ["Crafting/Arting", "Crafting/Pimping/Arting"],
  ["Food/Drinks", "Food/Drinks"],
  ["Dating", "Games/Play"],
  ["Games/Play", "Games/Play"],
  ["Music/Performance/Show", "Music/Performance/Show"],
  ["Music/Show", "Music/Performance/Show"],
  ["Party/Gathering", "Party/Gathering"],
  ["Ritual/Ceremony", "Ritual/Ceremony"],
  ["Workshop/Class", "Workshop/Class"],
  ["Yoga/Movement/Bodywork", "Yoga/Movement/Bodywork"],
  ["Movement/Bodywork", "Yoga/Movement/Bodywork"],
  ["Weird shit/Other", "Weird shit/Other"]
]);

const explicitConflictTitles = new Set([
  normalizeComparableText("confess!"),
  normalizeComparableText("gay speed dating"),
  normalizeComparableText("lucifer's sock wrestling tournament extravaganza")
]);

const tagDefinitions = [
  {
    canonical: "Kids friendly",
    aliases: ["Kids friendly", "Kid-friendly", "Kid friendly", "KID FRIENDLY", "🐵", "🐒"]
  },
  {
    canonical: "Adults only",
    aliases: ["Adults only", "Adult only", "ADULT ONLY", "🦍"]
  },
  {
    canonical: "Sex positive",
    aliases: ["Sex positive", "Sex-positive", "SEX POSITIVE", "🖤"]
  },
  {
    canonical: "Sober",
    aliases: ["Sober", "SOBER ONLY", "😇"]
  },
  {
    canonical: "Sensory content",
    aliases: ["Sensory content", "Warning: Sensory content", "💥"]
  },
  {
    canonical: "Triggering themes",
    aliases: ["Triggering themes", "Warning: Triggering", "🚨", "🚩"]
  },
  {
    canonical: "Queer-inclusive",
    aliases: ["Queer-inclusive", "Queer inclusive", "QUEER INCLUSIVE", "🌈", "🏳️‍🌈"]
  },
  {
    canonical: "Queer-focused",
    aliases: ["Queer-focused", "Queer focused", "🌈🌈"]
  }
];

const canonicalTagSet = new Set(supportedTags);
const tagAliasLookup = new Map(
  tagDefinitions.flatMap(({ canonical, aliases }) =>
    aliases.map((alias) => [normalizeComparableText(alias), canonical])
  )
);

async function main() {
  const { schedule, audit } = await buildScheduleFromSpreadsheet();
  await writeGeneratedSchedule(schedule);

  if (audit.idPreservationWarning) {
    console.warn(audit.idPreservationWarning);
  }

  console.log(
    JSON.stringify(
      {
        source: spreadsheetSource,
        generatedAt: schedule.generatedAt,
        events: {
          total: schedule.events.length,
          matched: audit.events.matchedCount,
          new: audit.events.newCount,
          deletedBaseline: audit.events.deletedBaselineCount,
          preservedIds: audit.events.preservedIdCount
        },
        campListings: {
          total: schedule.campListings.length,
          matched: audit.campListings.matchedCount,
          new: audit.campListings.newCount,
          deletedBaseline: audit.campListings.deletedBaselineCount,
          preservedIds: audit.campListings.preservedIdCount
        },
        locationConflicts: audit.locationConflicts.length,
        unknownCategories: audit.categoryUnknowns.length,
        unknownTags: audit.tagUnknowns.length
      },
      null,
      2
    )
  );
}

export async function buildScheduleFromSpreadsheet(options = {}) {
  const baselineSchedule = options.baselineSchedule ?? (await loadBaselineSchedule());
  const sheets = await fetchPublishedSheets();
  const placementIndex = buildPlacementIndex(sheets.placementRows);
  const unknownCategories = new Map();
  const unknownTags = new Map();
  const knownCampNames = buildKnownCampNames(baselineSchedule, placementIndex);

  const normalizedEvents = sheets.eventRows
    .map((row, rowIndex) =>
      normalizeSpreadsheetEvent(row, {
        rowIndex,
        baselineSchedule,
        placementIndex,
        unknownCategories,
        unknownTags,
        knownCampNames
      })
    )
    .filter(Boolean);

  const normalizedCampListings = sheets.destinationRows
    .map((row, rowIndex) =>
      normalizeSpreadsheetDestination(row, {
        rowIndex,
        baselineSchedule,
        placementIndex,
        unknownCategories,
        unknownTags
      })
    )
    .filter(Boolean);

  const matchedEvents = preserveEventIds(normalizedEvents, baselineSchedule.events);
  const matchedCampListings = preserveCampListingIds(normalizedCampListings, baselineSchedule.campListings);

  const schedule = {
    generatedAt: new Date().toISOString(),
    sourcePdf: `${spreadsheetSource}+${sourcePdf}`,
    days: buildDays(matchedEvents.entries),
    events: matchedEvents.entries,
    campListings: matchedCampListings.entries
  };

  const audit = buildImportAudit({
    baselineSchedule,
    matchedEvents,
    matchedCampListings,
    categoryUnknowns: formatUnknownMap(unknownCategories),
    tagUnknowns: formatUnknownMap(unknownTags)
  });

  return {
    schedule,
    audit
  };
}

async function loadBaselineSchedule() {
  if (generatedSchedule?.events?.length) {
    return generatedSchedule;
  }

  const { schedule } = await buildScheduleFromPdf(pdfPath);
  return schedule;
}

async function fetchPublishedSheets() {
  const [eventsCsv, destinationsCsv, placementCsv] = await Promise.all([
    fetchSheetCsv(publishedTabs.events),
    fetchSheetCsv(publishedTabs.destinations),
    fetchSheetCsv(publishedTabs.placement)
  ]);

  return {
    eventRows: parseCsv(eventsCsv),
    destinationRows: parseCsv(destinationsCsv),
    placementRows: parseCsv(placementCsv)
  };
}

async function fetchSheetCsv(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet tab ${gid}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseCsv(csvText) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const next = csvText[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }

      row.push(current);
      current = "";
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += character;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((value) => value.trim());

  return dataRows.map((dataRow) =>
    headers.reduce((entry, header, index) => {
      entry[header] = (dataRow[index] ?? "").trim();
      return entry;
    }, {})
  );
}

function normalizeSpreadsheetEvent(row, context) {
  const title = cleanTitle(stripDecorativeEmoji(row.Title ?? ""));
  const date = parseSpreadsheetDay(row.Day ?? "");
  const start = normalizeTime(row.Start ?? "");
  const end = normalizeTime(row.End ?? "");

  if (!title || !date || !isTimeLike(start)) {
    return undefined;
  }

  const resolvedEnd = isTimeLike(end) ? end : start;

  const normalizedCategory = normalizeSpreadsheetCategory(row.Category ?? "", context.unknownCategories);
  if (!normalizedCategory) {
    return undefined;
  }

  const association = parseAssociationField(row["Facilitator/\nHost camp"] ?? row["Facilitator/Host camp"] ?? "", context);
  const locationLabel = resolveSpreadsheetLocation(row.Location ?? "", title, context.placementIndex);
  const location = parseLocation(locationLabel);
  const gridSquares = computeEventGridSquares(
    {
      host: association.host,
      hosts: association.hosts,
      campHost: association.campHost,
      campHosts: association.campHosts,
      location,
      description: row.Description ?? ""
    },
    extractGridSquareRefsFromText(locationLabel, { allowBare: true })
  );

  return applyKnownVenueLocation({
    id: "",
    title,
    dayId: createDayId(date),
    date,
    time: {
      start,
      end: resolvedEnd,
      crossesMidnight: resolvedEnd < start,
      display: `${start} - ${resolvedEnd}`
    },
    category: normalizedCategory,
    ...(association.hosts.length > 0 ? { hosts: association.hosts } : {}),
    ...(association.host ? { host: association.host } : {}),
    ...(association.campHosts.length > 0 ? { campHosts: association.campHosts } : {}),
    ...(association.campHost ? { campHost: association.campHost } : {}),
    location,
    ...(gridSquares?.length ? { gridSquares } : {}),
    tags: parseTagsFromEventRow(row, context.unknownTags),
    description: cleanMultilineText(row.Description ?? ""),
    source: {
      pdf: spreadsheetSource,
      page: 0
    }
  });
}

function normalizeSpreadsheetDestination(row, context) {
  const name = cleanTitle(stripDecorativeEmoji(row.Title ?? ""));
  if (!name) {
    return undefined;
  }

  const type = normalizeSpreadsheetListingType(row.Category ?? "", context.unknownCategories);
  const locationLabel = resolveSpreadsheetLocation(row.Location ?? "", name, context.placementIndex);
  const location = parseLocation(locationLabel);
  const gridSquares = extractGridSquareRefsFromText(location.name, { allowBare: true });

  return applyKnownVenueLocation({
    id: "",
    name,
    type,
    location,
    ...(gridSquares.length > 0 ? { gridSquares } : {}),
    tags: parseTagsFromText(row.Tags ?? "", context.unknownTags),
    description: cleanMultilineText(row.Description ?? ""),
    source: {
      pdf: spreadsheetSource,
      page: 0
    }
  });
}

function preserveEventIds(nextEvents, baselineEvents) {
  const baselineState = createBaselineState(baselineEvents, buildEventCandidateKeys);
  const idCounts = new Map();
  const matches = [];
  const unmatchedNew = [];
  const locationConflicts = [];

  const entries = nextEvents.map((event) => {
    const baselineMatch = takeBaselineMatch(event, baselineState, buildEventCandidateKeys, compareEventLocationScore);

    if (baselineMatch) {
      matches.push({
        next: event,
        baseline: baselineMatch
      });

      if (hasLocationConflict(event, baselineMatch)) {
        locationConflicts.push(buildLocationConflict(event, baselineMatch));
      }

      return {
        ...event,
        id: baselineMatch.id
      };
    }

    unmatchedNew.push(event);
    return {
      ...event,
      id: mintStableEventId(event, idCounts)
    };
  });

  return {
    entries,
    matches,
    unmatchedNew,
    unmatchedBaseline: Array.from(baselineState.unused.values()),
    locationConflicts,
    possibleConflicts: findProbableEventConflicts(unmatchedNew, Array.from(baselineState.unused.values()))
  };
}

function preserveCampListingIds(nextListings, baselineListings) {
  const baselineState = createBaselineState(baselineListings, buildCampListingCandidateKeys);
  const idCounts = new Map();
  const matches = [];
  const unmatchedNew = [];

  const entries = nextListings.map((listing) => {
    const baselineMatch = takeBaselineMatch(listing, baselineState, buildCampListingCandidateKeys, compareCampListingLocationScore);

    if (baselineMatch) {
      matches.push({
        next: listing,
        baseline: baselineMatch
      });

      return {
        ...listing,
        id: baselineMatch.id
      };
    }

    unmatchedNew.push(listing);
    return {
      ...listing,
      id: mintStableCampListingId(listing, idCounts)
    };
  });

  return {
    entries,
    matches,
    unmatchedNew,
    unmatchedBaseline: Array.from(baselineState.unused.values())
  };
}

function createBaselineState(entries, buildKeys) {
  const byKey = new Map();
  const unused = new Map(entries.map((entry) => [entry.id, entry]));

  for (const entry of entries) {
    for (const key of buildKeys(entry)) {
      const existing = byKey.get(key) ?? [];
      existing.push(entry);
      byKey.set(key, existing);
    }
  }

  return {
    byKey,
    unused
  };
}

function takeBaselineMatch(entry, baselineState, buildKeys, rankMatch) {
  for (const key of buildKeys(entry)) {
    const candidates = (baselineState.byKey.get(key) ?? []).filter((candidate) => baselineState.unused.has(candidate.id));
    if (candidates.length === 0) {
      continue;
    }

    const [best] = [...candidates].sort((left, right) => rankMatch(entry, right) - rankMatch(entry, left));
    baselineState.unused.delete(best.id);
    return best;
  }

  return undefined;
}

function buildEventCandidateKeys(event) {
  const titleKey = normalizeComparableText(event.title);
  const locationKey = normalizeComparableText(event.location.name);
  const gridKey = event.gridSquares?.[0]?.label ?? event.location.gridSquare ?? "";

  return [
    `title-date-start:${titleKey}|${event.date}|${event.time.start}`,
    `title-date-start-grid:${titleKey}|${event.date}|${event.time.start}|${gridKey}`,
    `title-date-location:${titleKey}|${event.date}|${locationKey}`
  ];
}

function buildCampListingCandidateKeys(listing) {
  const nameKey = normalizeComparableText(listing.name);
  const locationKey = normalizeComparableText(listing.location.name);
  const gridKey = listing.gridSquares?.[0]?.label ?? listing.location.gridSquare ?? "";

  return [
    `name-grid:${nameKey}|${gridKey}`,
    `name-location:${nameKey}|${locationKey}`,
    `canonical-name:${normalizeComparableText(getCanonicalCampLabel(listing.name))}`
  ];
}

function compareEventLocationScore(next, baseline) {
  let score = 0;
  if (normalizeComparableText(next.location.name) === normalizeComparableText(baseline.location.name)) {
    score += 3;
  }
  if ((next.gridSquares?.[0]?.label ?? "") === (baseline.gridSquares?.[0]?.label ?? "")) {
    score += 2;
  }
  if (normalizeComparableText(next.category) === normalizeComparableText(baseline.category)) {
    score += 1;
  }
  return score;
}

function compareCampListingLocationScore(next, baseline) {
  let score = 0;
  if (normalizeComparableText(next.location.name) === normalizeComparableText(baseline.location.name)) {
    score += 2;
  }
  if ((next.gridSquares?.[0]?.label ?? "") === (baseline.gridSquares?.[0]?.label ?? "")) {
    score += 2;
  }
  if (normalizeComparableText(next.type) === normalizeComparableText(baseline.type)) {
    score += 1;
  }
  return score;
}

function hasLocationConflict(next, baseline) {
  const nextGrid = next.gridSquares?.[0]?.label ?? next.location.gridSquare ?? "";
  const baselineGrid = baseline.gridSquares?.[0]?.label ?? baseline.location.gridSquare ?? "";

  return Boolean(nextGrid && baselineGrid && nextGrid !== baselineGrid);
}

function buildLocationConflict(next, baseline) {
  return {
    title: next.title,
    date: next.date,
    start: next.time.start,
    eventId: baseline.id,
    spreadsheetLocation: next.location.name,
        spreadsheetGrid: next.gridSquares?.[0]?.label ?? next.location.gridSquare ?? null,
        baselineLocation: baseline.location.name,
        baselineGrid: baseline.gridSquares?.[0]?.label ?? baseline.location.gridSquare ?? null,
        explicitlyFlagged: explicitConflictTitles.has(normalizeComparableText(next.title))
  };
}

function mintStableEventId(event, idCounts) {
  const baseId = slugify([event.date, event.time.start, event.location.name, event.title].join(" "));
  return dedupeMintedId(baseId, idCounts);
}

function mintStableCampListingId(listing, idCounts) {
  const baseId = slugify([listing.name, listing.location.name, listing.type].join(" "));
  return dedupeMintedId(baseId, idCounts);
}

function dedupeMintedId(baseId, idCounts) {
  const duplicateCount = idCounts.get(baseId) ?? 0;
  idCounts.set(baseId, duplicateCount + 1);
  return duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount + 1}`;
}

function parseTagsFromEventRow(row, unknownTags) {
  const values = [row.Vibes ?? ""];
  for (const [key, value] of Object.entries(row)) {
    if (value === "TRUE") {
      values.push(key);
    }
  }
  return parseTagsFromText(values.join(" · "), unknownTags);
}

function parseTagsFromText(value, unknownTags) {
  const found = [];
  const seen = new Set();
  const cleanedValue = value.replace(/\s+/g, " ").trim();

  for (const token of cleanedValue.split(/[·\n]/).map((entry) => entry.trim()).filter(Boolean)) {
    const normalizedToken = normalizeComparableText(token);
    const canonical = tagAliasLookup.get(normalizedToken);
    if (canonical) {
      if (!seen.has(canonical)) {
        seen.add(canonical);
        found.push(canonical);
      }
      continue;
    }

    const matchedByInclusion = matchTagByInclusion(token);
    if (matchedByInclusion) {
      if (!seen.has(matchedByInclusion)) {
        seen.add(matchedByInclusion);
        found.push(matchedByInclusion);
      }
      continue;
    }

    if (normalizedToken && !isKnownNonCanonicalTag(token)) {
      addUnknown(unknownTags, token);
    }
  }

  return found.filter((tag) => canonicalTagSet.has(tag));
}

function matchTagByInclusion(value) {
  const normalized = normalizeComparableText(value);
  for (const { canonical, aliases } of tagDefinitions) {
    if (aliases.some((alias) => normalized.includes(normalizeComparableText(alias)))) {
      return canonical;
    }
  }
  return undefined;
}

function isKnownNonCanonicalTag(value) {
  const normalized = normalizeComparableText(value);
  return [
    "body positive",
    "pet friendly",
    "vibes",
    "tags"
  ].some((known) => normalized === known);
}

function normalizeSpreadsheetCategory(value, unknownCategories) {
  const cleaned = stripCategoryEmoji(value);
  if (!cleaned) {
    addUnknown(unknownCategories, value || "(empty)");
    return undefined;
  }

  const mapped = spreadsheetCategoryMap.get(cleaned);
  if (!mapped) {
    addUnknown(unknownCategories, cleaned);
    return undefined;
  }

  return mapped;
}

function normalizeSpreadsheetListingType(value, unknownCategories) {
  const cleaned = stripCategoryEmoji(value);
  if (!cleaned) {
    return "Camp";
  }

  const mapped = spreadsheetCategoryMap.get(cleaned);
  if (!mapped) {
    addUnknown(unknownCategories, cleaned);
    return "Camp";
  }

  return mapped;
}

function stripCategoryEmoji(value) {
  return cleanTitle(
    value
      .replace(/^[^\p{L}\p{N}]+/gu, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function resolveSpreadsheetLocation(locationValue, name, placementIndex) {
  const cleanedLocation = cleanMultilineText(locationValue);
  if (cleanedLocation && !/^n\/?a$/i.test(cleanedLocation)) {
    return cleanedLocation;
  }

  const placementMatch = placementIndex.get(normalizeComparableText(name));
  if (placementMatch?.howToFind) {
    return placementMatch.howToFind;
  }

  if (placementMatch?.grid) {
    return placementMatch.grid;
  }

  return "Location to be confirmed";
}

function buildPlacementIndex(rows) {
  const index = new Map();

  for (const row of rows) {
    const name = cleanTitle(row.Name ?? "");
    if (!name) {
      continue;
    }

    index.set(normalizeComparableText(name), {
      name,
      grid: cleanTitle(row.Grid ?? ""),
      neighbourhood: cleanTitle(row.Neighbourhood ?? ""),
      howToFind: cleanMultilineText(row["How to find"] ?? row["How to find "] ?? ""),
      category: cleanTitle(row.Category ?? "")
    });
  }

  return index;
}

function parseSpreadsheetDay(value) {
  const normalized = normalizeComparableText(value)
    .replace(/^sat /, "saturday ")
    .replace(/^sun /, "sunday ")
    .replace(/^mon /, "monday ")
    .replace(/^tue /, "tuesday ")
    .replace(/^wed /, "wednesday ")
    .replace(/^thu /, "thursday ")
    .replace(/^fri /, "friday ");

  const match = normalized.match(/(\d{1,2}) july/);
  if (!match) {
    return undefined;
  }

  return `2026-07-${String(Number(match[1])).padStart(2, "0")}`;
}

function parseAssociationField(value, context) {
  const cleaned = cleanMultilineText(value);
  if (!cleaned) {
    return { hosts: [], campHosts: [] };
  }

  const slashParts = cleaned.split(/\s*\/\s*/).map((part) => cleanTitle(part)).filter(Boolean);
  if (slashParts.length >= 2) {
    const hosts = splitAssociationNames(slashParts[0], "host");
    const campHosts = splitAssociationNames(slashParts.slice(1).join(" / "), "camp");
    return {
      hosts,
      host: hosts[0],
      campHosts,
      campHost: campHosts[0]
    };
  }

  const names = splitAssociationNames(cleaned, "host");
  if (looksLikeCampName(cleaned, context.knownCampNames)) {
    return {
      hosts: [],
      campHosts: [cleaned],
      campHost: cleaned
    };
  }

  return {
    hosts: names,
    host: names[0],
    campHosts: [],
    campHost: undefined
  };
}

function splitAssociationNames(value, type) {
  const delimiters = type === "camp"
    ? [/\s+in collab with\s+/i, /\s*&\s*/i, /\s+and\s+/i]
    : [/\s*&\s*/i, /\s+and\s+/i, /\s*,\s*/];

  for (const delimiter of delimiters) {
    const parts = value.split(delimiter).map((entry) => cleanTitle(entry)).filter(Boolean);
    if (parts.length > 1) {
      return dedupeStrings(parts);
    }
  }

  return value ? [cleanTitle(value)] : [];
}

function looksLikeCampName(value, knownCampNames) {
  const normalized = normalizeComparableText(value);
  return knownCampNames.has(normalized) || knownCampNames.has(normalizeComparableText(getCanonicalCampLabel(value)));
}

function buildKnownCampNames(baselineSchedule, placementIndex) {
  return new Set([
    ...baselineSchedule.campListings.map((listing) => normalizeComparableText(listing.name)),
    ...baselineSchedule.events.flatMap((event) => (event.campHosts ?? []).map((campHost) => normalizeComparableText(campHost))),
    ...Array.from(placementIndex.keys())
  ]);
}

function buildImportAudit({ baselineSchedule, matchedEvents, matchedCampListings, categoryUnknowns, tagUnknowns }) {
  const preservedIdCount = matchedEvents.matches.length;
  const baselineEventCount = baselineSchedule.events.length;
  const preservationRatio = baselineEventCount === 0 ? 1 : preservedIdCount / baselineEventCount;

  return {
    events: {
      matchedCount: matchedEvents.matches.length,
      newCount: matchedEvents.unmatchedNew.length,
      deletedBaselineCount: matchedEvents.unmatchedBaseline.length,
      preservedIdCount,
      changedIds: []
    },
    campListings: {
      matchedCount: matchedCampListings.matches.length,
      newCount: matchedCampListings.unmatchedNew.length,
      deletedBaselineCount: matchedCampListings.unmatchedBaseline.length,
      preservedIdCount: matchedCampListings.matches.length
    },
    locationConflicts: matchedEvents.locationConflicts,
    possibleEventConflicts: matchedEvents.possibleConflicts,
    explicitReviewConflicts: findExplicitReviewConflicts(matchedEvents.unmatchedNew, baselineSchedule.events),
    categoryUnknowns,
    tagUnknowns,
    destinationSummary: {
      newCount: matchedCampListings.unmatchedNew.length,
      missingBaselineCount: matchedCampListings.unmatchedBaseline.length
    },
    idPreservationWarning:
      preservationRatio < 0.7
        ? `Warning: only ${preservedIdCount}/${baselineEventCount} baseline event IDs were preserved during spreadsheet import.`
        : undefined
  };
}

function findProbableEventConflicts(unmatchedNewEvents, unmatchedBaselineEvents) {
  return unmatchedNewEvents.flatMap((nextEvent) => {
    const candidate = unmatchedBaselineEvents
      .map((baselineEvent) => ({
        baselineEvent,
        score: scoreProbableEventConflict(nextEvent, baselineEvent)
      }))
      .filter(({ score }) => score >= 3)
      .sort((left, right) => right.score - left.score)[0];

    if (!candidate) {
      return [];
    }

    return [
      {
        title: nextEvent.title,
        date: nextEvent.date,
        start: nextEvent.time.start,
        spreadsheetLocation: nextEvent.location.name,
        baselineTitle: candidate.baselineEvent.title,
        baselineId: candidate.baselineEvent.id,
        baselineDate: candidate.baselineEvent.date,
        baselineStart: candidate.baselineEvent.time.start,
        baselineLocation: candidate.baselineEvent.location.name,
        score: candidate.score,
        explicitlyFlagged: explicitConflictTitles.has(normalizeComparableText(nextEvent.title))
      }
    ];
  });
}

function findExplicitReviewConflicts(unmatchedNewEvents, baselineEvents) {
  return unmatchedNewEvents.flatMap((nextEvent) => {
    if (!explicitConflictTitles.has(normalizeComparableText(nextEvent.title))) {
      return [];
    }

    const candidate = baselineEvents
      .map((baselineEvent) => ({
        baselineEvent,
        score: scoreProbableEventConflict(nextEvent, baselineEvent)
      }))
      .filter(({ score }) => score >= 2)
      .sort((left, right) => right.score - left.score)[0];

    if (!candidate) {
      return [];
    }

    return [
      {
        title: nextEvent.title,
        date: nextEvent.date,
        start: nextEvent.time.start,
        spreadsheetLocation: nextEvent.location.name,
        baselineTitle: candidate.baselineEvent.title,
        baselineId: candidate.baselineEvent.id,
        baselineDate: candidate.baselineEvent.date,
        baselineStart: candidate.baselineEvent.time.start,
        baselineLocation: candidate.baselineEvent.location.name,
        score: candidate.score
      }
    ];
  });
}

function scoreProbableEventConflict(nextEvent, baselineEvent) {
  if (nextEvent.date !== baselineEvent.date) {
    return 0;
  }

  let score = 0;
  const sharedTitleTokens = countSharedTitleTokens(nextEvent.title, baselineEvent.title);
  const timeDifference = Math.abs(toMinutes(nextEvent.time.start) - toMinutes(baselineEvent.time.start));
  const gridMatches = (nextEvent.gridSquares?.[0]?.label ?? "") === (baselineEvent.gridSquares?.[0]?.label ?? "");

  score += sharedTitleTokens * 2;
  if (timeDifference <= 90) {
    score += 1;
  }
  if (gridMatches) {
    score += 1;
  }

  return score;
}

function countSharedTitleTokens(left, right) {
  const leftTokens = new Set(normalizeComparableText(left).split(" ").filter((token) => token.length >= 4));
  const rightTokens = new Set(normalizeComparableText(right).split(" ").filter((token) => token.length >= 4));
  let shared = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }

  return shared;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

async function writeGeneratedSchedule(schedule) {
  await fs.writeFile(
    outputPath,
    `import type { NormalizedSchedule } from "@/models/schedule";\n\nconst generatedSchedule: NormalizedSchedule = ${JSON.stringify(
      schedule,
      null,
      2
    )};\n\nexport default generatedSchedule;\n`,
    "utf8"
  );
}

function cleanMultilineText(value) {
  return cleanTitle(value.replace(/\r?\n+/g, " ").replace(/\s+/g, " "));
}

function stripDecorativeEmoji(value) {
  return value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/\s+/g, " ").trim();
}

function isTimeLike(value) {
  return /^\d{2}:\d{2}$/.test(value);
}

function normalizeComparableText(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function addUnknown(map, rawValue) {
  const cleaned = cleanMultilineText(String(rawValue ?? ""));
  if (!cleaned) {
    return;
  }

  const key = normalizeComparableText(cleaned);
  const existing = map.get(key) ?? { value: cleaned, count: 0 };
  existing.count += 1;
  map.set(key, existing);
}

function formatUnknownMap(map) {
  return Array.from(map.values())
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
    .map(({ value, count }) => ({ value, count }));
}

function dedupeStrings(values) {
  return Array.from(new Set(values.map((value) => cleanTitle(value)).filter(Boolean)));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
