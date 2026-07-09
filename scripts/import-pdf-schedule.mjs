import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PDFParser from "pdf2json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourcePdf = "JOMO26_A4.pdf";
const pdfPath = path.join(rootDir, sourcePdf);
const outputPath = path.join(rootDir, "src/data/generatedSchedule.ts");

const categories = [
  "Art/Installation",
  "Care/Support/Pampering",
  "Crafting/Pimping/Arting",
  "Food/Drinks",
  "Games/Play",
  "Music/Performance/Show",
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
const campHostAliases = {
  "The secret outpost": ["The secret outpost!", "the secret outpost"],
  Heliotropes: ["Heliotropes Queer- inclusive"],
  "The Divine Dough Sanctuary": ["The Divine Dough"],
  "Free camp": ["Free camping"],
  "Lucifer's Pit": ["Lucifer's Pit · content"]
};
const hostAliases = {
  God: ["GOd"]
};

async function main() {
  await fs.access(pdfPath);
  const pages = await parsePdf(pdfPath);
  const lines = flattenLines(pages);
  const dayRanges = buildDayRanges(lines);
  const eventStarts = findEventStarts(lines);
  const extractedEvents = buildEvents(lines, eventStarts, dayRanges);
  const events = normalizeExtractedEvents(extractedEvents);
  const days = buildDays(events);

  if (events.length === 0) {
    throw new Error("No events were extracted from the PDF.");
  }

  const schedule = {
    generatedAt: new Date().toISOString(),
    sourcePdf,
    days,
    events
  };

  await fs.writeFile(
    outputPath,
    `import type { NormalizedSchedule } from "@/models/schedule";\n\nconst generatedSchedule: NormalizedSchedule = ${JSON.stringify(
      schedule,
      null,
      2
    )};\n\nexport default generatedSchedule;\n`,
    "utf8"
  );

  console.log(`Imported ${events.length} events across ${days.length} days from ${sourcePdf}.`);
}

function parsePdf(filePath) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1);

    parser.on("pdfParser_dataError", (error) => reject(error.parserError ?? error));
    parser.on("pdfParser_dataReady", (data) => resolve(data.Pages));
    parser.loadPDF(filePath);
  });
}

function flattenLines(pages) {
  return pages.flatMap((page, pageIndex) =>
    page.Texts.map((text) => ({
      page: pageIndex + 1,
      value: decodeURIComponent(text.R.map((run) => run.T).join(""))
        .replace(/\s+/g, " ")
        .trim()
    })).filter((line) => line.value.length > 0)
  );
}

function buildDayRanges(lines) {
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

function findEventStarts(lines) {
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

  while (index >= 0 && isTitleLine(lines[index].value)) {
    index -= 1;
  }

  return index + 1;
}

function isTitleLine(value) {
  if (dayNameToDate.has(value.toUpperCase()) || categorySet.has(value) || timePattern.test(value)) {
    return false;
  }

  const letters = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  if (letters.length < 2) {
    return false;
  }

  const upperLetters = letters.replace(/[a-zà-öø-ÿ]/g, "");
  return upperLetters.length / letters.length > 0.8;
}

function buildEvents(lines, eventStarts, dayRanges) {
  const idCounts = new Map();

  return eventStarts
    .map((start, index) => {
      const nextStart = eventStarts[index + 1]?.titleStart ?? lines.length;
      const title = lines
        .slice(start.titleStart, start.categoryIndex)
        .map((line) => line.value)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const category = lines[start.categoryIndex].value;
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
        .slice(start.categoryIndex + 2, nextStart)
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
        host: parsedBody.host,
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

function normalizeExtractedEvents(events) {
  const campLocationIndex = buildLocationIndex(events, {
    getKeys: (event) => getCampLocationKeys(event.campHost),
    allowEvent: (event) => Boolean(event.campHost)
  });
  const hostLocationIndex = buildLocationIndex(events, {
    getKeys: (event) => getHostLocationKeys(event.host),
    allowEvent: (event) => Boolean(event.host)
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
  const mappedCampLocation = resolveMappedLocation(campLocationIndex, getCampLocationKeys(event.campHost));
  const mappedHostLocation = !mappedCampLocation && !event.campHost
    ? resolveMappedLocation(hostLocationIndex, getHostLocationKeys(event.host))
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
  const campLabel = getPreferredCampLabel(event.campHost);
  if (campLabel) {
    return campLabel;
  }

  return getPreferredHostLabel(event.host);
}

function getCampLocationKeys(value) {
  if (!value) {
    return [];
  }

  const canonical = getCanonicalCampLabel(value);
  return canonical ? [normalizeComparableText(canonical)] : [];
}

function getHostLocationKeys(value) {
  if (!value) {
    return [];
  }

  const canonical = getCanonicalHostLabel(value);
  return canonical ? [normalizeComparableText(canonical)] : [];
}

function getPreferredCampLabel(value) {
  return value ? getCanonicalCampLabel(value) : undefined;
}

function getPreferredHostLabel(value) {
  return value ? getCanonicalHostLabel(value) : undefined;
}

function getCanonicalCampLabel(value) {
  const normalizedValue = normalizeComparableText(value);
  for (const [canonical, aliases] of Object.entries(campHostAliases)) {
    const normalizedCanonical = normalizeComparableText(canonical);
    if (normalizedValue === normalizedCanonical || aliases.some((alias) => normalizeComparableText(alias) === normalizedValue)) {
      return canonical;
    }
  }

  return value.trim();
}

function getCanonicalHostLabel(value) {
  const normalizedValue = normalizeComparableText(value);
  for (const [canonical, aliases] of Object.entries(hostAliases)) {
    const normalizedCanonical = normalizeComparableText(canonical);
    if (normalizedValue === normalizedCanonical || aliases.some((alias) => normalizeComparableText(alias) === normalizedValue)) {
      return canonical;
    }
  }

  return value.trim();
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
  const implicitLocation = deriveImplicitLocation({
    locationLines,
    descriptionLines,
    parsedMetadata
  });
  const correctedLocation = correctKnownLocation({
    explicitLocation: locationLines.join(" "),
    implicitLocation: implicitLocation.locationValue,
    parsedMetadata
  });
  const description = stripLeadingLocationText(descriptionLines, correctedLocation, implicitLocation.locationValue);
  const normalizedMetadata = normalizeParsedMetadata(parsedMetadata, correctedLocation);

  return {
    host: normalizedMetadata.host,
    campHost: normalizedMetadata.campHost,
    tags: foundTags,
    location: parseLocation(correctedLocation),
    description: description.join(" ").replace(/\s+/g, " ").trim()
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

  return {
    host:
      parsedMetadata.host && isLikelyMetadataLocation(parsedMetadata.host, normalizedLocation)
        ? undefined
        : parsedMetadata.host,
    campHost:
      parsedMetadata.campHost && isLikelyMetadataLocation(parsedMetadata.campHost, normalizedLocation)
        ? undefined
        : parsedMetadata.campHost
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

  if (parts.length < 2) {
    return { host: cleaned };
  }

  if (parts.length >= 3 && isLikelyImplicitLocationLine(parts[parts.length - 1])) {
    return {
      host: parts.slice(0, -2).join(" / ") || undefined,
      campHost: parts[parts.length - 2],
      trailingLocation: parts[parts.length - 1]
    };
  }

  return {
    host: parts.slice(0, -1).join(" / "),
    campHost: parts[parts.length - 1]
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
  const area = areaNames.find((name) => cleanValue.startsWith(name));

  return {
    name: cleanValue,
    area,
    gridSquare: gridSquares[0]?.label,
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
  const metadataSquares = extractGridSquareRefsFromText([parsedBody.host, parsedBody.campHost].filter(Boolean).join(" "), {
    allowBare: false
  });
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
