import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import PDFParser from "pdf2json";
import aliasDefinitions from "../src/data/campAliases.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
export const sourcePdf = "JOMO26_A4.pdf";
export const pdfPath = path.join(rootDir, sourcePdf);
const outputPath = path.join(rootDir, "src/data/generatedSchedule.ts");

const categories = [
  "Art/Installation",
  "Care/Support/Pampering",
  "Crafting/Pimping/Arting",
  "Food/Drinks",
  "Games/Play",
  "Music/Performance/Show",
  "Weird shit/Other",
  "Party/Gathering",
  "Ritual/Ceremony",
  "Workshop/Class",
  "Yoga/Movement/Bodywork"
];

const tags = [
  "Adults only",
  "Queer-inclusive",
  "Sensory content",
  "Sex positive",
  "Sober",
  "Triggering themes"
];

const tagAliases = {
  "Adults only": ["Adult only", "Adults"],
  "Queer-inclusive": ["Queer inclusive", "Queer-focused", "Queer focused"],
  "Sensory content": ["Sensory", "Sensory warning", "Sensory warnings"],
  "Sex positive": ["Sex-positive", "Sexpositive"],
  Sober: [],
  "Triggering themes": ["Triggering", "Trigger warning", "Trigger warnings"]
};

const tagAliasEntries = Object.entries(tagAliases).flatMap(([tag, aliases]) => [
  [tag, tag],
  ...aliases.map((alias) => [alias, tag])
]);

const metadataFlagAliases = [
  ...tags,
  ...Object.values(tagAliases).flat(),
  "Kid-friendly",
  "Body-positive",
  "Body positive",
  "Pet-friendly",
  "Pet friendly"
];
const metadataFlagAliasEntries = metadataFlagAliases.map((alias) => [alias, alias]);
const metadataFlagKeySet = new Set(metadataFlagAliases.map(normalizeMetadataFlagKey));

const areaNames = [
  "Arctic chill",
  "Bison - North",
  "Bison - South",
  "Downtown",
  "Eastern Slope",
  "Everywhere",
  "Highlands",
  "Lowlands",
  "Sunny Hills",
  "Swamp",
  "The Heart"
];

const dayNameToDate = new Map([
  ["SATURDAY 18/7 (BUILD)", "2026-07-18"],
  ["SUNDAY 19/7", "2026-07-19"],
  ["MONDAY 20/7", "2026-07-20"],
  ["TUESDAY 21/7", "2026-07-21"],
  ["WEDNESDAY 22/7", "2026-07-22"],
  ["THURSDAY 23/7", "2026-07-23"],
  ["FRIDAY 24/7", "2026-07-24"],
  ["SATURDAY 25/7", "2026-07-25"],
  ["SUNDAY 26/7", "2026-07-26"],
  ["MONDAY 27/7 (STRIKE)", "2026-07-27"]
]);

const categorySet = new Set(categories);
const tagSet = new Set(tags);
const timePattern = /^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})$/;
const campListingSectionLabelPattern =
  /^(?:ART\/INSTALLATION|CARE\/SUPPORT\/PAMPERING|CRAFTING(?:\/PIMPING)?\/ARTING|FOOD\/DRINKS|GAMES\/PLAY|MUSIC\/PERFORMANCE\/SHOW|PARTY\/GATHERING|RITUAL\/CEREMONY|WORKSHOP\/CLASS|YOGA\/MOVEMENT\/BODYWORK|WEIRD SHIT\/OTHER)$/i;
const gridColumns = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const gridColumnSet = new Set(gridColumns);
const gridRowSet = new Set(Array.from({ length: 27 }, (_, index) => index + 1));
const contextualGridPattern =
  /\b(?:grid\s*squares?|maybe\s+square|square)\s+((?:[A-Z]\s*0?\d{1,2})(?:\s*(?:[,/&+]|\band\b|\bor\b)\s*(?:[A-Z]\s*0?\d{1,2}))*)/gi;
const gridTokenPattern = /([A-Z])\s*(0?\d{1,2})/gi;
const bareGridPattern = /(?:^|[^A-Z0-9])([A-Z])\s*(0?\d{1,2})(?=$|[^A-Z0-9])/gi;
const phonePattern = /\+\d(?:[\d\s()-]{6,}\d)/;
const lucifersPitCanonicalLocation =
  "Downtown, grid square K19. Upstairs in the barn, around the silo, and inside the sheep barn";
const campHostAliases = aliasDefinitions.campAliases;
const hostAliases = aliasDefinitions.hostAliases;
const metadataSuffixes = [
  ...metadataFlagAliases,
  "Queer",
  "Queer-inclusive",
  "Queer inclusive",
  "Queer - inclusive"
];
const normalizedMetadataSuffixes = metadataSuffixes
  .map((suffix) => normalizeComparableText(suffix))
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

export async function buildScheduleFromPdf(filePath = pdfPath) {
  await fs.access(filePath);
  const pages = await parsePdf(filePath);
  const lines = flattenLines(pages);
  const dayRanges = buildDayRanges(lines);
  const eventStarts = findEventStarts(lines);
  const eventTitleStartIndexes = new Set(eventStarts.map((start) => start.titleStart));
  const maxScheduleEventPage = Math.max(...eventStarts.map((start) => lines[start.categoryIndex]?.page ?? 0));
  const scheduleEndIndex = lines.findIndex((line) => line.page > maxScheduleEventPage);
  const extractedEvents = buildEvents(lines, eventStarts, dayRanges, scheduleEndIndex === -1 ? lines.length : scheduleEndIndex);
  const { campListings, ignoredCampListingCandidates, rawCampListingCandidates } = buildCampListings(
    lines,
    eventTitleStartIndexes,
    maxScheduleEventPage
  );
  const events = normalizeExtractedEvents(extractedEvents);
  const days = buildDays(events);

  if (events.length === 0) {
    throw new Error("No events were extracted from the PDF.");
  }

  const schedule = {
    generatedAt: new Date().toISOString(),
    sourcePdf,
    days,
    events,
    campListings
  };

  return {
    schedule,
    lines,
    dayRanges,
    eventStarts,
    maxScheduleEventPage,
    rawEventCandidates: extractedEvents,
    rawCampListingCandidates,
    ignoredCampListingCandidates
  };
}

async function main() {
  const { schedule } = await buildScheduleFromPdf();

  await fs.writeFile(
    outputPath,
    `import type { NormalizedSchedule } from "@/models/schedule";\n\nconst generatedSchedule: NormalizedSchedule = ${JSON.stringify(
      schedule,
      null,
      2
    )};\n\nexport default generatedSchedule;\n`,
    "utf8"
  );

  console.log(`Imported ${schedule.events.length} events across ${schedule.days.length} days from ${sourcePdf}.`);
}

export function parsePdf(filePath) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1);

    parser.on("pdfParser_dataError", (error) => reject(error.parserError ?? error));
    parser.on("pdfParser_dataReady", (data) => resolve(data.Pages));
    parser.loadPDF(filePath);
  });
}

export function flattenLines(pages) {
  return pages.flatMap((page, pageIndex) =>
    page.Texts.map((text) => ({
      page: pageIndex + 1,
      value: decodeURIComponent(text.R.map((run) => run.T).join(""))
        .replace(/\s+/g, " ")
        .trim()
    })).filter((line) => line.value.length > 0 && !isPageNumberLine(line.value))
  );
}

export function buildDayRanges(lines) {
  const headers = lines
    .map((line, index) => ({ ...line, index }))
    .filter((line) => dayNameToDate.has(line.value.toUpperCase()));

  return headers.map((header, index) => {
    const label = header.value.toUpperCase();
    const date = dayNameToDate.get(label);
    return {
      id: createDayId(date),
      label,
      date,
      startIndex: header.index,
      endIndex: headers[index + 1]?.index ?? lines.length
    };
  });
}

export function findEventStarts(lines) {
  return lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => categorySet.has(line.value))
    .map(({ index }) => {
      const titleStart = findTitleStart(lines, index);
      return { titleStart, categoryIndex: index };
    })
    .filter((start) => start.titleStart < start.categoryIndex);
}

function findTitleStart(lines, categoryIndex) {
  let index = categoryIndex - 1;

  while (index >= 0 && isTitleSeparatorLine(lines[index].value)) {
    index -= 1;
  }

  while (index >= 0 && isTitleFragmentLine(lines[index].value)) {
    index -= 1;
  }

  return index + 1;
}

function isTitleSeparatorLine(value) {
  return /^[-–—]+$/.test(value.trim());
}

function isTitleFragmentLine(value) {
  return isTitleLine(value) || isShortTitleContinuationLine(value);
}

function isShortTitleContinuationLine(value) {
  const trimmed = value.trim();
  const letters = Array.from(trimmed).filter((character) => /\p{L}/u.test(character)).join("");
  return letters.length > 0 && letters.length <= 3 && /^[\p{Lu}\d][\p{L}\d'’* -]*$/u.test(trimmed);
}

function isTitleLine(value) {
  if (dayNameToDate.has(value.toUpperCase()) || categorySet.has(value) || timePattern.test(value)) {
    return false;
  }

  const letters = Array.from(value).filter((character) => /\p{L}/u.test(character)).join("");
  if (letters.length < 2) {
    return false;
  }

  const upperLetters = Array.from(letters).filter((character) => /\p{Lu}/u.test(character)).join("");
  return upperLetters.length / letters.length > 0.8;
}

export function buildEvents(lines, eventStarts, dayRanges, scheduleEndIndex) {
  const idCounts = new Map();

  return eventStarts
    .map((start, index) => {
      const nextStart = eventStarts[index + 1]?.titleStart ?? scheduleEndIndex;
      const bodyEndIndex = Math.min(nextStart, scheduleEndIndex);
      const title = lines
        .slice(start.titleStart, start.categoryIndex)
        .map((line) => line.value)
        .filter((value) => !isTitleSeparatorLine(value))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const category = normalizeCategory(lines[start.categoryIndex].value);
      const timeLine = lines[start.categoryIndex + 1]?.value ?? "";
      const timeMatch = timeLine.match(timePattern);

      if (!title || !timeMatch) {
        return null;
      }

      const day = findDayForIndex(dayRanges, start.titleStart);
      if (!day) {
        return null;
      }

      const bodyLines = lines
        .slice(start.categoryIndex + 2, bodyEndIndex)
        .filter((line) => !dayNameToDate.has(line.value.toUpperCase()))
        .map((line) => line.value);
      const parsedBody = parseBody(bodyLines);
      const gridSquares = extractEventGridSquares(parsedBody);
      const baseId = slugify([day.date, timeMatch[1], parsedBody.location.name, title].join(" "));
      const duplicateCount = idCounts.get(baseId) ?? 0;
      idCounts.set(baseId, duplicateCount + 1);

      return {
        id: duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount + 1}`,
        title: cleanTitle(title),
        dayId: day.id,
        date: day.date,
        time: {
          start: normalizeTime(timeMatch[1]),
          end: normalizeTime(timeMatch[2]),
          crossesMidnight: normalizeTime(timeMatch[2]) < normalizeTime(timeMatch[1]),
          display: `${normalizeTime(timeMatch[1])} - ${normalizeTime(timeMatch[2])}`
        },
        category,
        ...(parsedBody.hosts.length > 0 ? { hosts: parsedBody.hosts } : {}),
        host: parsedBody.host,
        ...(parsedBody.campHosts.length > 0 ? { campHosts: parsedBody.campHosts } : {}),
        campHost: parsedBody.campHost,
        location: parsedBody.location,
        ...(gridSquares.length > 0 ? { gridSquares } : {}),
        tags: parsedBody.tags,
        description: parsedBody.description,
        source: {
          pdf: sourcePdf,
          page: lines[start.categoryIndex].page
        }
      };
    })
    .filter(Boolean);
}

export function buildCampListings(lines, eventTitleStartIndexes, minPage) {
  const listings = [];
  const rawCampListingCandidates = [];
  const ignoredCampListingCandidates = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].page <= minPage) {
      continue;
    }

    const rawBlockInfo = getPotentialCampListingBlockInfo(lines, index, eventTitleStartIndexes);
    const blockInfo = getCampListingBlockInfo(lines, index, eventTitleStartIndexes, rawBlockInfo);
    if (rawBlockInfo && !blockInfo) {
      ignoredCampListingCandidates.push({
        page: lines[index].page,
        title: lines[rawBlockInfo.titleIndex]?.value ?? "",
        location: lines[rawBlockInfo.locationIndex]?.value ?? "",
        reason: getIgnoredCampListingReason(lines[rawBlockInfo.titleIndex]?.value ?? "")
      });
    }
    if (!blockInfo) {
      continue;
    }

    const nextIndex = findNextBlockBoundary(lines, blockInfo.locationIndex + 1, eventTitleStartIndexes);
    const bodyLines = lines.slice(blockInfo.locationIndex + 1, nextIndex).map((line) => line.value);
    const parsedListing = parseCampListing(lines[blockInfo.titleIndex].value, lines[blockInfo.locationIndex].value, bodyLines);
    const listingName = cleanTitle(lines[blockInfo.titleIndex].value);
    const listingLocation = parseLocation(parsedListing.location);
    const listing = {
      id: slugify([listingName, listingLocation.name, lines[blockInfo.titleIndex].page].join(" ")),
      name: listingName,
      type: blockInfo.type,
      location: listingLocation,
      ...(parsedListing.gridSquares.length > 0 ? { gridSquares: parsedListing.gridSquares } : {}),
      tags: parsedListing.tags,
      description: parsedListing.description,
      source: {
        pdf: sourcePdf,
        page: lines[blockInfo.titleIndex].page
      }
    };

    listings.push(listing);
    rawCampListingCandidates.push(listing);

    index = nextIndex - 1;
  }

  return {
    campListings: listings,
    rawCampListingCandidates,
    ignoredCampListingCandidates
  };
}

function normalizeExtractedEvents(events) {
  const campLocationIndex = buildLocationIndex(events, {
    getKeys: (event) => getCampLocationKeys(event.campHosts ?? (event.campHost ? [event.campHost] : [])),
    allowEvent: (event) => Boolean(event.campHosts?.length || event.campHost)
  });
  const hostLocationIndex = buildLocationIndex(events, {
    getKeys: (event) => getHostLocationKeys(event.hosts ?? (event.host ? [event.host] : [])),
    allowEvent: (event) => Boolean(event.hosts?.length || event.host)
  });

  return events.map((event) => normalizeEventLocation(event, campLocationIndex, hostLocationIndex));
}

function buildLocationIndex(events, options) {
  const index = new Map();

  for (const event of events) {
    if (!hasConcreteMappedLocation(event) || !options.allowEvent(event)) {
      continue;
    }

    const keys = options.getKeys(event);
    for (const key of keys) {
      const existing = index.get(key) ?? new Map();
      existing.set(createLocationSignature(event.location.name, event.gridSquares ?? []), {
        name: event.location.name,
        gridSquares: event.gridSquares ?? []
      });
      index.set(key, existing);
    }
  }

  return index;
}

function normalizeEventLocation(event, campLocationIndex, hostLocationIndex) {
  const mappedCampLocation = resolveMappedLocation(
    campLocationIndex,
    getCampLocationKeys(event.campHosts ?? (event.campHost ? [event.campHost] : []))
  );
  const mappedHostLocation = !mappedCampLocation && !(event.campHosts?.length || event.campHost)
    ? resolveMappedLocation(hostLocationIndex, getHostLocationKeys(event.hosts ?? (event.host ? [event.host] : [])))
    : undefined;
  const replacementLocation = mappedCampLocation ?? mappedHostLocation;

  if (replacementLocation) {
    const updatedLocation = parseLocation(replacementLocation.name);
    const updatedEvent = {
      ...event,
      location: updatedLocation
    };

    return {
      ...updatedEvent,
      gridSquares: computeEventGridSquares(updatedEvent, replacementLocation.gridSquares)
    };
  }

  if (event.location.name === "Location to be confirmed") {
    const fallbackLabel = getBestLocationLabelFallback(event);
    if (fallbackLabel) {
      const updatedLocation = parseLocation(fallbackLabel);
      const updatedEvent = {
        ...event,
        location: updatedLocation
      };

      return {
        ...updatedEvent,
        gridSquares: computeEventGridSquares(updatedEvent)
      };
    }
  }

  return {
    ...event,
    gridSquares: computeEventGridSquares(event)
  };
}

function hasConcreteMappedLocation(event) {
  return Boolean(event.gridSquares?.length) && !isUnresolvedLocationName(event.location.name);
}

function resolveMappedLocation(index, keys) {
  for (const key of keys) {
    const matches = index.get(key);
    if (matches && matches.size === 1) {
      return Array.from(matches.values())[0];
    }
  }

  return undefined;
}

function getBestLocationLabelFallback(event) {
  const campLabel = getPreferredCampLabel(event.campHosts ?? (event.campHost ? [event.campHost] : []));
  if (campLabel) {
    return campLabel;
  }

  return getPreferredHostLabel(event.hosts ?? (event.host ? [event.host] : []));
}

function getCampLocationKeys(values) {
  return values.flatMap((value) => {
    const canonical = getCanonicalCampLabel(value);
    return canonical ? [normalizeComparableText(canonical)] : [];
  });
}

function getHostLocationKeys(values) {
  return values.flatMap((value) => {
    const canonical = getCanonicalHostLabel(value);
    return canonical ? [normalizeComparableText(canonical)] : [];
  });
}

function getPreferredCampLabel(values) {
  return values.map(getCanonicalCampLabel).find(Boolean);
}

function getPreferredHostLabel(values) {
  return values.map(getCanonicalHostLabel).find(Boolean);
}

export function getCanonicalCampLabel(value) {
  const trimmedValue = stripTrailingMetadataFlags(value.trim());
  const normalizedValue = normalizeComparableText(trimmedValue);
  for (const [canonical, aliases] of Object.entries(campHostAliases)) {
    const normalizedCanonical = normalizeComparableText(canonical);
    if (normalizedValue === normalizedCanonical || aliases.some((alias) => normalizeComparableText(alias) === normalizedValue)) {
      return canonical;
    }
  }

  return trimmedValue;
}

export function getCanonicalHostLabel(value) {
  const trimmedValue = stripTrailingMetadataFlags(value.trim());
  const normalizedValue = normalizeComparableText(trimmedValue);
  for (const [canonical, aliases] of Object.entries(hostAliases)) {
    const normalizedCanonical = normalizeComparableText(canonical);
    if (normalizedValue === normalizedCanonical || aliases.some((alias) => normalizeComparableText(alias) === normalizedValue)) {
      return canonical;
    }
  }

  return trimmedValue;
}

function stripTrailingMetadataFlags(value) {
  let current = value.trim();
  let next = stripOneMetadataSuffix(current);

  while (next && next !== current) {
    current = next;
    next = stripOneMetadataSuffix(current);
  }

  return current || value.trim();
}

function stripOneMetadataSuffix(value) {
  const normalizedValue = normalizeComparableText(value);
  const matchingSuffix = normalizedMetadataSuffixes.find(
    (suffix) => normalizedValue === suffix || normalizedValue.endsWith(` ${suffix}`)
  );

  if (!matchingSuffix) {
    return value.trim();
  }

  const suffixPattern = metadataSuffixes
    .map((suffix) => escapeRegExp(suffix).replace(/\s+/g, "\\s*[-–—]?\\s*"))
    .join("|");

  return value.replace(new RegExp(`(?:\\s*[·,/|-]?\\s*)(?:${suffixPattern})\\s*$`, "i"), "").trim();
}

function createLocationSignature(locationName, gridSquares) {
  return `${normalizeComparableText(locationName)}::${gridSquares.map((square) => square.key).sort().join(",")}`;
}

function findDayForIndex(dayRanges, index) {
  return dayRanges.find((day) => index > day.startIndex && index < day.endIndex);
}

function parseBody(lines) {
  const normalizedLines = mergeBrokenMetadataLines(lines);
  const foundTags = [];
  const metadata = [];
  let locationIndex = -1;

  normalizedLines.forEach((line, index) => {
    const lineTags = extractTags(line);
    for (const tag of lineTags) {
      if (!foundTags.includes(tag)) {
        foundTags.push(tag);
      }
    }

    if (locationIndex === -1 && isLocationLine(line)) {
      locationIndex = index;
    }
  });

  const metadataEndIndex = locationIndex === -1 ? findMetadataEndIndex(normalizedLines) : locationIndex;

  for (let index = 0; index < metadataEndIndex; index += 1) {
    const cleaned = removeMetadataFlags(normalizedLines[index]).trim();
    if (cleaned) {
      metadata.push(cleaned);
    }
  }

  const locationLines = locationIndex === -1 ? [] : normalizedLines.slice(locationIndex, locationIndex + 1);
  let descriptionLines =
    locationIndex === -1 ? normalizedLines.slice(metadataEndIndex) : normalizedLines.slice(locationIndex + 1);
  let metadataValue = metadata.join(" ");

  if (!metadataValue && hasEmbeddedMetadata(descriptionLines[0])) {
    metadataValue = descriptionLines[0];
    descriptionLines = descriptionLines.slice(1);
  }

  const parsedMetadata = parseEventMetadata(metadataValue);
  const trailingLocation = parsedMetadata.trailingLocation
    ? consumeLocationContinuation(parsedMetadata.trailingLocation, descriptionLines)
    : undefined;
  if (trailingLocation) {
    descriptionLines = trailingLocation.remainingLines;
  }

  const implicitLocation = deriveImplicitLocation({
    locationLines,
    descriptionLines,
    parsedMetadata: trailingLocation
      ? {
          ...parsedMetadata,
          trailingLocation: trailingLocation.location
        }
      : parsedMetadata
  });
  const correctedLocation = correctKnownLocation({
    explicitLocation: locationLines.join(" "),
    implicitLocation: implicitLocation.locationValue,
    parsedMetadata
  });
  const description = stripLeadingLocationText(descriptionLines, correctedLocation, implicitLocation.locationValue);
  const normalizedMetadata = normalizeParsedMetadata(parsedMetadata, correctedLocation);

  return {
    hosts: normalizedMetadata.hosts,
    host: normalizedMetadata.host,
    campHosts: normalizedMetadata.campHosts,
    campHost: normalizedMetadata.campHost,
    tags: foundTags,
    location: parseLocation(correctedLocation),
    description: description.join(" ").replace(/\s+/g, " ").trim()
  };
}

function parseCampListing(title, baseLocation, lines) {
  const normalizedLines = mergeBrokenMetadataLines(lines);
  const { location, remainingLines } = consumeLocationContinuation(baseLocation, normalizedLines);
  const foundTags = [];
  const descriptionLines = [];

  for (const line of remainingLines) {
    const lineTags = extractTags(line);
    for (const tag of lineTags) {
      if (!foundTags.includes(tag)) {
        foundTags.push(tag);
      }
    }

    const cleaned = removeMetadataFlags(removeTags(line)).trim();
    if (cleaned) {
      descriptionLines.push(cleaned);
    }
  }

  return {
    location,
    gridSquares: extractGridSquareRefsFromText(location, { allowBare: true }),
    tags: foundTags,
    description: descriptionLines.join(" ").replace(/\s+/g, " ").trim()
  };
}

function deriveImplicitLocation({ locationLines, descriptionLines, parsedMetadata }) {
  if (locationLines.length > 0) {
    return { locationValue: locationLines.join(" ") };
  }

  const firstDescriptionLine = descriptionLines[0]?.trim() ?? "";
  if (firstDescriptionLine && isLikelyImplicitLocationLine(firstDescriptionLine)) {
    return { locationValue: firstDescriptionLine };
  }

  if (parsedMetadata.trailingLocation) {
    return { locationValue: parsedMetadata.trailingLocation };
  }

  return { locationValue: "" };
}

function normalizeParsedMetadata(parsedMetadata, locationValue) {
  const normalizedLocation = normalizeComparableText(locationValue);
  const hosts = (parsedMetadata.hosts ?? [])
    .filter((host) => !isLikelyMetadataLocation(host, normalizedLocation))
    .map((host) => host.trim());
  const campHosts = (parsedMetadata.campHosts ?? [])
    .filter((campHost) => !isLikelyMetadataLocation(campHost, normalizedLocation))
    .map((campHost) => campHost.trim());

  return {
    hosts,
    host:
      parsedMetadata.host && isLikelyMetadataLocation(parsedMetadata.host, normalizedLocation)
        ? undefined
        : hosts[0] ?? parsedMetadata.host,
    campHosts,
    campHost:
      parsedMetadata.campHost && isLikelyMetadataLocation(parsedMetadata.campHost, normalizedLocation)
        ? undefined
        : campHosts[0] ?? parsedMetadata.campHost
  };
}

function hasEmbeddedMetadata(value) {
  return Boolean(value) && value.includes(" / ") && !isLikelyImplicitLocationLine(value);
}

function isLikelyMetadataLocation(value, normalizedLocation) {
  const normalizedValue = normalizeComparableText(value);
  return Boolean(normalizedValue) && (normalizedValue === normalizedLocation || isLikelyImplicitLocationLine(value));
}

function stripLeadingLocationText(descriptionLines, locationValue, implicitLocationValue) {
  const lines = [...descriptionLines];
  const firstLine = lines[0]?.trim() ?? "";
  const normalizedFirstLine = normalizeComparableText(firstLine);
  const normalizedLocation = normalizeComparableText(locationValue);
  const normalizedImplicitLocation = normalizeComparableText(implicitLocationValue);

  if (!firstLine) {
    return lines;
  }

  if (
    (normalizedImplicitLocation && normalizedFirstLine === normalizedImplicitLocation) ||
    (normalizedLocation && normalizedFirstLine === normalizedLocation)
  ) {
    lines.shift();
    return lines;
  }

  if (locationValue && firstLine.toLowerCase().startsWith(locationValue.toLowerCase())) {
    lines[0] = firstLine.slice(locationValue.length).trim();
  } else if (implicitLocationValue && firstLine.toLowerCase().startsWith(implicitLocationValue.toLowerCase())) {
    lines[0] = firstLine.slice(implicitLocationValue.length).trim();
  }

  return lines.filter(Boolean);
}

function correctKnownLocation({ explicitLocation, implicitLocation, parsedMetadata }) {
  const combinedLocationContext = [explicitLocation, implicitLocation, parsedMetadata.trailingLocation].filter(Boolean).join(" ");

  if (containsKnownVenueReference(combinedLocationContext)) {
    return lucifersPitCanonicalLocation;
  }

  return explicitLocation || implicitLocation || "";
}

function mergeBrokenMetadataLines(lines) {
  const mergedLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];
    const merged = next ? `${current} ${next}` : current;

    if (next && metadataFlagKeySet.has(normalizeMetadataFlagKey(merged))) {
      mergedLines.push(merged);
      index += 1;
      continue;
    }

    if (next && shouldMergeWrappedContinuation(current, next)) {
      mergedLines.push(merged);
      index += 1;
      continue;
    }

    mergedLines.push(current);
  }

  return mergedLines;
}

function shouldMergeWrappedContinuation(current, next) {
  if (current.includes("/") && isLocationLine(next)) {
    return false;
  }

  const nextStartsLikeContinuation = /^[a-z(]/.test(next);
  if (!nextStartsLikeContinuation) {
    return false;
  }

  return current.includes("/") || isLikelyImplicitLocationLine(current) || isLocationLine(current);
}

function findMetadataEndIndex(lines) {
  let index = 0;

  if (
    lines.length > 1 &&
    !isMetadataOnlyLine(lines[0]) &&
    (isMetadataOnlyLine(lines[1]) || isLocationLine(lines[1]))
  ) {
    index = 1;
  }

  while (index < lines.length && isMetadataOnlyLine(lines[index])) {
    index += 1;
  }

  return index;
}

function parseEventMetadata(value) {
  const cleaned = cleanMetadata(value);
  if (!cleaned) {
    return {};
  }

  const parts = cleaned
    .split("/")
    .map((part) => cleanMetadata(part))
    .filter(Boolean);
  const splitLastPart = splitMetadataLocationPart(parts[parts.length - 1]);
  if (splitLastPart) {
    parts[parts.length - 1] = splitLastPart.value;
  }

  if (parts.length < 2) {
    const hosts = parseAssociatedNames(splitLastPart?.value ?? cleaned, "host");
    return {
      ...(hosts.length > 0 ? { hosts, host: hosts[0] } : {}),
      ...(splitLastPart?.trailingLocation ? { trailingLocation: splitLastPart.trailingLocation } : {})
    };
  }

  if (
    parts.length >= 3 &&
    (isLikelyImplicitLocationLine(parts[parts.length - 1]) || Boolean(splitLastPart?.trailingLocation))
  ) {
    const hosts = parseAssociatedNames(parts.slice(0, -2), "host");
    const campHosts = parseAssociatedNames(parts[parts.length - 2], "camp");
    return {
      ...(hosts.length > 0 ? { hosts, host: hosts[0] } : {}),
      ...(campHosts.length > 0 ? { campHosts, campHost: campHosts[0] } : {}),
      trailingLocation: splitLastPart?.trailingLocation ?? parts[parts.length - 1]
    };
  }

  const hosts = parseAssociatedNames(parts.slice(0, -1), "host");
  const campHosts = parseAssociatedNames(parts[parts.length - 1], "camp");
  return {
    ...(hosts.length > 0 ? { hosts, host: hosts[0] } : {}),
    ...(campHosts.length > 0 ? { campHosts, campHost: campHosts[0] } : {}),
    ...(splitLastPart?.trailingLocation ? { trailingLocation: splitLastPart.trailingLocation } : {})
  };
}

function parseAssociatedNames(value, type) {
  const parts = Array.isArray(value) ? value : [value];
  const names = parts.flatMap((part) => splitAssociatedNameValue(part, type)).map((part) => part.trim()).filter(Boolean);
  const uniqueNames = [];
  const seen = new Set();

  for (const name of names) {
    const key = normalizeComparableText(name);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueNames.push(name);
  }

  return uniqueNames;
}

function splitAssociatedNameValue(value, type) {
  const cleaned = cleanMetadata(value);
  if (!cleaned) {
    return [];
  }

  const delimiters = type === "camp"
    ? [/\s+in collab with\s+/i, /\s*&\s*/i, /\s+and\s+/i, /\s+with\s+/i]
    : [/\s*&\s*/i, /\s+and\s+/i, /\s+with\s+/i];

  for (const delimiter of delimiters) {
    const parts = cleaned.split(delimiter).map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1 && parts.every((part) => isLikelyAssociatedNamePart(part, type))) {
      return parts;
    }
  }

  const commaParts = cleaned.split(/\s*,\s*/).map((part) => part.trim()).filter(Boolean);
  if (commaParts.length > 1 && commaParts.every((part) => isLikelyAssociatedNamePart(part, type))) {
    return commaParts;
  }

  return [cleaned];
}

function isLikelyAssociatedNamePart(value, type) {
  if (!value) {
    return false;
  }

  if (type === "camp") {
    return !/\b(?:people|grid square|exact location|look for|follow|go to|next to|somewhere)\b/i.test(value);
  }

  return !/\b(?:grid square|look for|follow|go to|somewhere|location)\b/i.test(value);
}

function splitMetadataLocationPart(value) {
  if (!value) {
    return undefined;
  }

  const boundaryIndex = findLocationBoundaryIndex(value);
  if (boundaryIndex <= 0) {
    return undefined;
  }

  const metadataValue = value.slice(0, boundaryIndex).trim();
  const trailingLocation = value.slice(boundaryIndex).trim();
  if (!metadataValue || !trailingLocation) {
    return undefined;
  }

  return {
    value: metadataValue,
    trailingLocation
  };
}

function cleanMetadata(value) {
  return metadataFlagAliases
    .reduce((next, tag) => removeTagAlias(next, tag), value)
    .replace(/\s+/g, " ")
    .replace(/(?:\s*[·-]\s*)+$/g, "")
    .trim();
}

function extractTags(value) {
  return tagAliasEntries
    .filter(([alias]) => hasTagAlias(value, alias))
    .map(([, tag]) => tag);
}

function removeTags(value) {
  return tagAliasEntries
    .reduce((next, [alias]) => removeTagAlias(next, alias), value)
    .replace(/[·-]\s*$/g, "");
}

function removeMetadataFlags(value) {
  return metadataFlagAliasEntries
    .reduce((next, [alias]) => removeTagAlias(next, alias), value)
    .replace(/[·-]\s*$/g, "")
    .trim();
}

function hasTagAlias(value, alias) {
  return createTagAliasPattern(alias).test(value);
}

function removeTagAlias(value, alias) {
  return value.replace(createTagAliasPattern(alias), "");
}

function createTagAliasPattern(alias) {
  return new RegExp(`(^|\\b)${escapeRegExp(alias)}(?=$|\\b)`, "gi");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isLocationLine(value) {
  const lower = value.toLowerCase();
  return (
    areaNames.some((area) => value.startsWith(area)) ||
    containsKnownVenueReference(value) ||
    extractGridSquareRefsFromText(value, { allowBare: true }).length > 0 ||
    lower.includes("grid square") ||
    lower.startsWith("mystery location") ||
    /^(?:in|at|by|around|near|outside|inside|under|behind|next to|look for|find us|meet at)\b/.test(lower)
  );
}

function isPageNumberLine(value) {
  return /^\d{1,3}$/.test(value.trim());
}

function normalizeCategory(value) {
  return value === "Weird shit/Other" ? "Other" : value;
}

function isMetadataOnlyLine(value) {
  return removeMetadataFlags(value).length === 0;
}

function normalizeMetadataFlagKey(value) {
  return value
    .toLowerCase()
    .replace(/[·.,:;!?'’"()\-–—/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyImplicitLocationLine(value) {
  const lower = value.toLowerCase();
  return (
    isLocationLine(value) ||
    phonePattern.test(value) ||
    /^(?:anywhere|everywhere|somewhere|better just call|call\/text|call text|text or whatsapp|we'?re not placed yet|we show up|exact location|find a campfire|to find|when walking|follow the|search for|look for|find me|find them)\b/.test(
      lower
    )
  );
}

function findLocationBoundaryIndex(value) {
  const areaMatchIndexes = areaNames
    .map((area) => value.indexOf(area))
    .filter((index) => index > 0);
  const keywordMatches = [
    value.search(/\bgrid square\b/i),
    value.search(/\b(?:in|at|by|around|near|outside|inside|under|behind|next to|look for|find us|meet at)\b/i)
  ].filter((index) => index > 0);
  const indexes = [...areaMatchIndexes, ...keywordMatches].filter((index) => index > 0);

  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function consumeLocationContinuation(baseLocation, lines) {
  const locationParts = [baseLocation.trim()];
  let index = 0;

  while (index < lines.length && isLocationContinuationLine(lines[index], locationParts[locationParts.length - 1])) {
    locationParts.push(lines[index].trim());
    index += 1;
  }

  return {
    location: locationParts.join(" ").replace(/\s+/g, " ").trim(),
    remainingLines: lines.slice(index)
  };
}

function isLocationContinuationLine(value, previousLocationPart = "") {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const previousLower = previousLocationPart.toLowerCase().trim();

  if (/^[a-z]/.test(trimmed) || /^to\b/.test(lower)) {
    return true;
  }

  return (
    /(?:next to|close to|behind|under|inside|outside|around|near|at|in)$/.test(previousLower) &&
    /^[A-ZÀ-ÖØ-Þ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9'’* -]*$/u.test(trimmed) &&
    !/[.!?]$/.test(trimmed)
  );
}

function isCapacityLine(value) {
  return /\bpeople\b/i.test(value);
}

function getPotentialCampListingBlockInfo(lines, index, eventTitleStartIndexes) {
  const directListing = getCampListingLocationIndex(lines, index);
  if (directListing !== -1) {
    return {
      startIndex: index,
      titleIndex: index,
      locationIndex: directListing,
      type: "Camp"
    };
  }

  if (
    campListingSectionLabelPattern.test(lines[index]?.value ?? "") &&
    !eventTitleStartIndexes.has(index + 1) &&
    isTitleLine(lines[index + 1]?.value ?? "")
  ) {
    const categorizedListingLocation = getCampListingLocationIndex(lines, index + 1);
    if (categorizedListingLocation !== -1) {
      return {
        startIndex: index,
        titleIndex: index + 1,
        locationIndex: categorizedListingLocation,
        type: normalizeCampListingType(lines[index].value)
      };
    }
  }

  return undefined;
}

function getCampListingBlockInfo(lines, index, eventTitleStartIndexes, potentialBlockInfo = undefined) {
  const blockInfo = potentialBlockInfo ?? getPotentialCampListingBlockInfo(lines, index, eventTitleStartIndexes);
  if (!blockInfo) {
    return undefined;
  }

  return isLikelyCampListingTitleLine(lines[blockInfo.titleIndex]?.value ?? "") ? blockInfo : undefined;
}

function isLikelyCampListingTitleLine(value) {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (
    isMetadataOnlyLine(trimmed) ||
    isCapacityLine(trimmed) ||
    isPageNumberLine(trimmed) ||
    timePattern.test(trimmed) ||
    categorySet.has(trimmed) ||
    dayNameToDate.has(trimmed.toUpperCase()) ||
    /^[a-z]/.test(trimmed)
  ) {
    return false;
  }

  return isTitleLine(trimmed) || isHeadlineStyleTitleLine(trimmed);
}

function isHeadlineStyleTitleLine(value) {
  if (/[.,:]$/.test(value) || /\b(?:find|between|inside|located|returns|serving|glow|brought|built|gather)\b/i.test(value)) {
    return false;
  }

  const words = value.match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9'’*]+/g) ?? [];
  if (words.length === 0) {
    return false;
  }

  const lowercaseContentWords = words.filter(
    (word) =>
      /^[a-zà-öø-ÿ]/.test(word) &&
      word.length > 3 &&
      !new Set(["and", "the", "with", "from", "into", "over", "under"]).has(word.toLowerCase())
  );
  const leadingUppercaseWords = words.filter((word) => /^[A-ZÀ-ÖØ-Þ0-9]/.test(word));

  return lowercaseContentWords.length <= 1 && leadingUppercaseWords.length / words.length >= 0.6;
}

function getIgnoredCampListingReason(value) {
  if (isMetadataOnlyLine(value)) {
    return "metadata-only title line";
  }

  if (/^[a-z]/.test(value.trim())) {
    return "description continuation treated as title";
  }

  return "invalid listing title";
}

function getCampListingLocationIndex(lines, titleIndex) {
  const firstCandidate = titleIndex + 1;
  const secondCandidate = titleIndex + 2;

  if (lines[firstCandidate] && isCampListingLocationLine(lines[firstCandidate].value)) {
    return firstCandidate;
  }

  if (
    lines[firstCandidate] &&
    isCapacityLine(lines[firstCandidate].value) &&
    lines[secondCandidate] &&
    isCampListingLocationLine(lines[secondCandidate].value)
  ) {
    return secondCandidate;
  }

  return -1;
}

function isCampListingLocationLine(value) {
  const lower = value.toLowerCase();
  return (
    areaNames.some((area) => value.startsWith(area)) ||
    containsKnownVenueReference(value) ||
    extractRawGridLabelsFromText(value, { allowBare: true }).length > 0 ||
    lower.includes("grid square") ||
    /^(?:look for|follow|go to|go towards|go toward|right next to|close to|everywhere|orange van)\b/.test(lower)
  );
}

function normalizeCampListingType(value) {
  return value === "WEIRD SHIT/OTHER" ? "Other" : titleCaseCategory(value);
}

function titleCaseCategory(value) {
  const normalizedValue = value.trim();
  const exactCategory = categories.find((category) => category.toUpperCase() === normalizedValue.toUpperCase());
  return exactCategory ? normalizeCategory(exactCategory) : "Camp";
}

function isCampListingStart(lines, index, eventTitleStartIndexes) {
  const value = lines[index]?.value ?? "";
  const previousValue = lines[index - 1]?.value ?? "";

  if (
    !value ||
    eventTitleStartIndexes.has(index) ||
    dayNameToDate.has(value.toUpperCase()) ||
    categorySet.has(value) ||
    timePattern.test(value) ||
    isPageNumberLine(value)
  ) {
    return false;
  }

  if (categorySet.has(previousValue) || timePattern.test(previousValue) || dayNameToDate.has(previousValue.toUpperCase())) {
    return false;
  }

  return Boolean(getCampListingBlockInfo(lines, index, eventTitleStartIndexes));
}

function findNextCampListingStart(lines, startIndex, endIndex, eventTitleStartIndexes) {
  for (let index = startIndex; index < endIndex; index += 1) {
    if (isCampListingStart(lines, index, eventTitleStartIndexes)) {
      return index;
    }
  }

  return undefined;
}

function findNextBlockBoundary(lines, startIndex, eventTitleStartIndexes) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const value = lines[index].value;
    if (
      dayNameToDate.has(value.toUpperCase()) ||
      eventTitleStartIndexes.has(index) ||
      isCampListingStart(lines, index, eventTitleStartIndexes)
    ) {
      return index;
    }
  }

  return lines.length;
}

function containsKnownVenueReference(value) {
  return /lucifer[’']?s pit/i.test(value);
}

function normalizeComparableText(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function parseLocation(value) {
  const cleanValue = value.replace(/\s+/g, " ").trim() || "Location to be confirmed";
  const gridSquares = extractGridSquareRefsFromText(cleanValue, { allowBare: true });
  const rawGridLabels = extractRawGridLabelsFromText(cleanValue, { allowBare: true });
  const area = areaNames.find((name) => cleanValue.startsWith(name));

  return {
    name: cleanValue,
    area,
    gridSquare: gridSquares[0]?.label ?? rawGridLabels[0],
    notes: area ? cleanValue.replace(area, "").replace(/^,\s*/, "").trim() || undefined : undefined
  };
}

function computeEventGridSquares(event, resolvedGridSquares) {
  const extractedGridSquares =
    resolvedGridSquares && resolvedGridSquares.length > 0
      ? dedupeGridSquareRefs(resolvedGridSquares)
      : extractEventGridSquares({
          host: event.host,
          campHost: event.campHost,
          location: event.location,
          description: event.description
        });

  return extractedGridSquares.length > 0 ? extractedGridSquares : undefined;
}

function extractEventGridSquares(parsedBody) {
  const locationSquares = extractGridSquareRefsFromText(parsedBody.location.name, { allowBare: true });
  const metadataSquares = extractGridSquareRefsFromText(
    [parsedBody.host, parsedBody.campHost, ...(parsedBody.hosts ?? []), ...(parsedBody.campHosts ?? [])]
      .filter(Boolean)
      .join(" "),
    { allowBare: false }
  );
  const descriptionSquares =
    locationSquares.length === 0
      ? extractGridSquareRefsFromText(parsedBody.description, { allowBare: false })
      : [];

  return dedupeGridSquareRefs([...locationSquares, ...metadataSquares, ...descriptionSquares]);
}

function isUnresolvedLocationName(value) {
  return value === "Location to be confirmed" || /mystery location/i.test(value) || /not decided/i.test(value);
}

function extractGridSquareRefsFromText(value, options = {}) {
  const allowBare = options.allowBare ?? false;
  const refs = [];
  const text = value.toUpperCase();

  for (const match of text.matchAll(contextualGridPattern)) {
    const gridList = match[1] ?? "";
    for (const tokenMatch of gridList.matchAll(gridTokenPattern)) {
      const ref = createGridSquareRef(tokenMatch[1], tokenMatch[2]);
      if (ref) {
        refs.push(ref);
      }
    }
  }

  if (allowBare) {
    for (const match of text.matchAll(bareGridPattern)) {
      const ref = createGridSquareRef(match[1], match[2]);
      if (ref) {
        refs.push(ref);
      }
    }
  }

  return dedupeGridSquareRefs(refs);
}

export function extractRawGridLabelsFromText(value, options = {}) {
  const allowBare = options.allowBare ?? false;
  const labels = [];
  const text = value.toUpperCase();

  for (const match of text.matchAll(contextualGridPattern)) {
    const gridList = match[1] ?? "";
    for (const tokenMatch of gridList.matchAll(gridTokenPattern)) {
      labels.push(`${tokenMatch[1]}${String(Number(tokenMatch[2])).padStart(2, "0")}`);
    }
  }

  if (allowBare) {
    for (const match of text.matchAll(bareGridPattern)) {
      labels.push(`${match[1]}${String(Number(match[2])).padStart(2, "0")}`);
    }
  }

  return Array.from(new Set(labels));
}

function createGridSquareRef(columnValue, rowValue) {
  const column = columnValue.toUpperCase();
  const row = Number(rowValue);

  if (!gridColumnSet.has(column) || !gridRowSet.has(row)) {
    return undefined;
  }

  return {
    column,
    row,
    key: `${column}${row}`,
    label: `${column}${String(row).padStart(2, "0")}`
  };
}

function dedupeGridSquareRefs(refs) {
  const byKey = new Map();

  for (const ref of refs) {
    if (!byKey.has(ref.key)) {
      byKey.set(ref.key, ref);
    }
  }

  return Array.from(byKey.values());
}

function buildDays(events) {
  const daysById = new Map();

  for (const event of events) {
    if (!daysById.has(event.dayId)) {
      daysById.set(event.dayId, {
        id: event.dayId,
        label: formatDayLabel(event.date),
        date: event.date,
        sortKey: event.date
      });
    }
  }

  return Array.from(daysById.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function formatDayLabel(date) {
  const sourceLabel = Array.from(dayNameToDate.entries()).find(([, value]) => value === date)?.[0];
  return sourceLabel
    ? sourceLabel.charAt(0) + sourceLabel.slice(1).toLowerCase()
    : date;
}

function createDayId(date) {
  return `day-${date}`;
}

function normalizeTime(value) {
  const [hour, minute] = value.split(":");
  return `${hour.padStart(2, "0")}:${minute}`;
}

function cleanTitle(value) {
  return value.replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
