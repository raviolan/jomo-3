import generatedSchedule from "../src/data/generatedSchedule.ts";
import {
  buildScheduleFromPdf,
  extractRawGridLabelsFromText,
  getCanonicalCampLabel,
  pdfPath,
  sourcePdf
} from "./import-pdf-schedule.mjs";

const failOnSuspicious = process.argv.includes("--fail-on-suspicious");
const requiredCampListings = [
  "T H E M O O N - HYPERSTITION",
  "LUCIFER'S PIT",
  "SOCIALEN",
  "THE SWEET SPOT",
  "HOUSE OF SIN",
  "KISHMASTLE SPACESTATION"
];
const metadataOnlyNames = new Set([
  "Adults only",
  "Queer-inclusive",
  "Sensory content",
  "Sex positive",
  "Sober",
  "Triggering themes",
  "Kid-friendly",
  "Body-positive",
  "Pet-friendly"
]);
const embeddedCategoryHeaderPattern =
  /\b(?:ART\/INSTALLATION|CARE\/SUPPORT\/PAMPERING|CRAFTING(?:\/PIMPING)?\/ARTING|FOOD\/DRINKS|GAMES\/PLAY|MUSIC\/PERFORMANCE\/SHOW|PARTY\/GATHERING|RITUAL\/CEREMONY|WORKSHOP\/CLASS|YOGA\/MOVEMENT\/BODYWORK|WEIRD SHIT\/OTHER)\b/i;

const coverage = await buildScheduleFromPdf(pdfPath);
const currentSchedule = generatedSchedule;
const rawSchedule = coverage.schedule;

const eventCoverage = compareCandidates(
  coverage.rawEventCandidates,
  currentSchedule.events,
  (event) => [event.date, event.time.start, event.time.end, normalizeKey(event.title)].join("|"),
  (event) => ({
    title: event.title,
    date: event.date,
    time: event.time.display,
    page: event.source.page
  })
);
const campListingCoverage = compareCandidates(
  coverage.rawCampListingCandidates,
  currentSchedule.campListings,
  (listing) => [listing.source.page, normalizeKey(listing.name)].join("|"),
  (listing) => ({
    name: listing.name,
    page: listing.source.page,
    location: listing.location.name
  })
);

const unresolvedLocations = currentSchedule.events.filter(
  (event) =>
    event.location.name === "Location to be confirmed" ||
    /mystery location/i.test(event.location.name) ||
    /not decided/i.test(event.location.name)
);
const suspiciousDescriptions = {
  embeddedCategoryHeaders: collectSuspiciousEvents((event) => embeddedCategoryHeaderPattern.test(event.description)),
  manyGridSquares: collectSuspiciousEvents((event) => (event.description.match(/\bgrid square\b/gi) ?? []).length >= 3),
  directoryLikeCampListings: collectSuspiciousEvents(
    (event) => /\b\d{1,3}(?:-\d{1,3}|\([^)]*\))?\s+people\b/i.test(event.description) && /grid square/i.test(event.description)
  ),
  pageHeaderFragments: collectSuspiciousEvents(
    (event) => /\b\d{2,3}\s+(?:ART\/INSTALLATION|CRAFTING(?:\/PIMPING)?\/ARTING|WEIRD SHIT\/OTHER)\b/i.test(event.description)
  )
};
const malformedListingNames = currentSchedule.campListings.filter((listing) => isMalformedListingName(listing.name)).map(formatListing);
const listingsWithoutLocation = currentSchedule.campListings
  .filter((listing) => !listing.location?.name || listing.location.name === "Location to be confirmed")
  .map(formatListing);
const listingsWithoutMapCompatibleGrid = currentSchedule.campListings
  .filter((listing) => !listing.gridSquares?.length)
  .map((listing) => ({
    ...formatListing(listing),
    rawGridRefs: extractRawGridLabelsFromText(listing.location.name, { allowBare: true })
  }));
const outOfMapGridRefs = [
  ...collectOutOfMapGridRefs(currentSchedule.events, "event"),
  ...collectOutOfMapGridRefs(currentSchedule.campListings, "campListing")
];
const missingRequiredCampListings = requiredCampListings.filter(
  (name) => !currentSchedule.campListings.some((listing) => normalizeKey(listing.name) === normalizeKey(name))
);
const duplicateEventGroups = collectDuplicates(
  currentSchedule.events,
  (event) => [event.title, event.date, event.time.start, event.time.end].join(" | "),
  (groupKey, entries) => ({ key: groupKey, count: entries.length, ids: entries.map((event) => event.id) })
);
const mysEventLabels = Array.from(
  new Set(
    currentSchedule.events
      .flatMap((event) => [...(event.campHosts ?? []), ...(event.campHost ? [event.campHost] : [])])
      .filter((label) => getCanonicalCampLabel(label) === "MŸS")
  )
).sort((a, b) => a.localeCompare(b));
const mysListingLabels = Array.from(
  new Set(currentSchedule.campListings.map((listing) => listing.name).filter((label) => getCanonicalCampLabel(label) === "MŸS"))
).sort((a, b) => a.localeCompare(b));
const canonicalCampNames = new Set([
  ...currentSchedule.events.flatMap((event) => [...(event.campHosts ?? []), ...(event.campHost ? [event.campHost] : [])].map(getCanonicalCampLabel)),
  ...currentSchedule.campListings.map((listing) => getCanonicalCampLabel(listing.name))
]);

const summary = {
  sourcePdf,
  generatedSourcePdf: currentSchedule.sourcePdf,
  generatedAt: currentSchedule.generatedAt,
  importMatchesCurrentPdf:
    currentSchedule.events.length === rawSchedule.events.length &&
    currentSchedule.campListings.length === rawSchedule.campListings.length &&
    currentSchedule.days.length === rawSchedule.days.length,
  totals: {
    days: currentSchedule.days.length,
    events: currentSchedule.events.length,
    campListings: currentSchedule.campListings.length,
    gridSquaresCoverage: ratio(currentSchedule.events.filter((event) => event.gridSquares?.length).length, currentSchedule.events.length),
    campHostCoverage: ratio(currentSchedule.events.filter((event) => event.campHost).length, currentSchedule.events.length)
  },
  rawPdfCoverage: {
    events: eventCoverage,
    campListings: campListingCoverage,
    ignoredCampListingCandidates: coverage.ignoredCampListingCandidates
  },
  unresolvedLocations: unresolvedLocations.map((event) => ({
    title: event.title,
    date: event.date,
    time: event.time.display,
    location: event.location.name,
    host: event.host,
    campHost: event.campHost,
    page: event.source.page
  })),
  suspiciousDescriptions,
  malformedListingNames,
  listingsWithoutLocation,
  listingsWithoutMapCompatibleGrid,
  outOfMapGridRefs,
  missingRequiredCampListings,
  duplicateTitleDateTimeEntries: duplicateEventGroups,
  canonicalizationSamples: {
    mys: {
      canonicalName: "MŸS",
      campListIncludesCanonical: canonicalCampNames.has("MŸS"),
      rawEventLabels: mysEventLabels,
      rawListingLabels: mysListingLabels
    }
  }
};

console.log(JSON.stringify(summary, null, 2));

const suspiciousDescriptionCount = Object.values(suspiciousDescriptions).reduce((count, entries) => count + entries.length, 0);
if (
  failOnSuspicious &&
  (suspiciousDescriptionCount > 0 ||
    eventCoverage.missing.length > 0 ||
    campListingCoverage.missing.length > 0 ||
    missingRequiredCampListings.length > 0)
) {
  process.exitCode = 1;
}

function compareCandidates(rawCandidates, generatedCandidates, buildKey, formatEntry) {
  const rawGroups = groupBy(rawCandidates, buildKey);
  const generatedGroups = groupBy(generatedCandidates, buildKey);
  const allKeys = new Set([...rawGroups.keys(), ...generatedGroups.keys()]);
  const missing = [];
  const generatedOnly = [];
  let matched = 0;

  for (const key of allKeys) {
    const rawEntries = rawGroups.get(key) ?? [];
    const generatedEntries = generatedGroups.get(key) ?? [];
    matched += Math.min(rawEntries.length, generatedEntries.length);

    if (rawEntries.length > generatedEntries.length) {
      missing.push(...rawEntries.slice(generatedEntries.length).map(formatEntry));
    }

    if (generatedEntries.length > rawEntries.length) {
      generatedOnly.push(...generatedEntries.slice(rawEntries.length).map(formatEntry));
    }
  }

  return {
    rawCount: rawCandidates.length,
    generatedCount: generatedCandidates.length,
    matched,
    missing,
    generatedOnly,
    duplicateRawCandidates: collectDuplicates(rawCandidates, buildKey, (key, entries) => ({
      key,
      count: entries.length,
      samples: entries.slice(0, 3).map(formatEntry)
    })),
    duplicateGeneratedCandidates: collectDuplicates(generatedCandidates, buildKey, (key, entries) => ({
      key,
      count: entries.length,
      samples: entries.slice(0, 3).map(formatEntry)
    }))
  };
}

function groupBy(entries, buildKey) {
  return entries.reduce((map, entry) => {
    const key = buildKey(entry);
    const existing = map.get(key) ?? [];
    existing.push(entry);
    map.set(key, existing);
    return map;
  }, new Map());
}

function collectDuplicates(entries, buildKey, formatGroup) {
  return Array.from(groupBy(entries, buildKey).entries())
    .filter(([, groupedEntries]) => groupedEntries.length > 1)
    .map(([key, groupedEntries]) => formatGroup(key, groupedEntries))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function ratio(count, total) {
  return {
    count,
    total,
    percentage: total === 0 ? 0 : Number(((count / total) * 100).toFixed(1))
  };
}

function collectSuspiciousEvents(predicate) {
  return currentSchedule.events.filter(predicate).map((event) => ({
    id: event.id,
    title: event.title,
    date: event.date,
    page: event.source.page,
    description: event.description.slice(0, 240)
  }));
}

function isMalformedListingName(name) {
  return (
    metadataOnlyNames.has(name) ||
    /^[a-z]/.test(name) ||
    /^table for quiet creating/i.test(name) ||
    /^inside you\./i.test(name) ||
    /\b(?:people|grid square)\b/i.test(name)
  );
}

function formatListing(listing) {
  return {
    name: listing.name,
    page: listing.source.page,
    location: listing.location.name,
    type: listing.type
  };
}

function normalizeKey(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function collectOutOfMapGridRefs(entries, entityType) {
  return entries.flatMap((entry) => {
    const rawGridRefs = extractRawGridLabelsFromText(entry.location.name, { allowBare: true }).filter(
      (label) => !isMapCompatibleGridLabel(label)
    );

    if (rawGridRefs.length === 0) {
      return [];
    }

    return [
      {
        type: entityType,
        title: entry.title ?? entry.name,
        page: entry.source.page,
        location: entry.location.name,
        rawGridRefs
      }
    ];
  });
}

function isMapCompatibleGridLabel(value) {
  const match = value.match(/^([A-Z])(\d{2})$/);
  if (!match) {
    return false;
  }

  const row = Number(match[2]);
  return row >= 1 && row <= 27;
}
