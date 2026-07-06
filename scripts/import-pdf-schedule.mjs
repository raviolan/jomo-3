import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PDFParser from "pdf2json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourcePdf = "guide_A4_preview.pdf";
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

const metadataFlagAliases = [
  ...tags,
  "Queer inclusive",
  "Queer-focused",
  "Queer focused"
];

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

async function main() {
  await fs.access(pdfPath);
  const pages = await parsePdf(pdfPath);
  const lines = flattenLines(pages);
  const dayRanges = buildDayRanges(lines);
  const eventStarts = findEventStarts(lines);
  const events = buildEvents(lines, eventStarts, dayRanges);
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

function findDayForIndex(dayRanges, index) {
  return dayRanges.find((day) => index > day.startIndex && index < day.endIndex);
}

function parseBody(lines) {
  const foundTags = [];
  const metadata = [];
  const description = [];
  let locationIndex = -1;

  lines.forEach((line, index) => {
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

  const safeLocationIndex = locationIndex === -1 ? Math.min(1, lines.length) : locationIndex;

  for (let index = 0; index < safeLocationIndex; index += 1) {
    const cleaned = removeTags(lines[index]).trim();
    if (cleaned) {
      metadata.push(cleaned);
    }
  }

  const locationLines = lines.slice(safeLocationIndex, safeLocationIndex + 1);
  const descriptionLines = lines.slice(safeLocationIndex + 1);
  description.push(...descriptionLines);

  const parsedMetadata = parseEventMetadata(metadata.join(" "));

  return {
    host: parsedMetadata.host,
    campHost: parsedMetadata.campHost,
    tags: foundTags,
    location: parseLocation(locationLines.join(" ")),
    description: description.join(" ").replace(/\s+/g, " ").trim()
  };
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

  return {
    host: parts.slice(0, -1).join(" / "),
    campHost: parts[parts.length - 1]
  };
}

function cleanMetadata(value) {
  return metadataFlagAliases
    .reduce((next, tag) => next.replaceAll(tag, ""), value)
    .replace(/\s+/g, " ")
    .replace(/(?:\s*[·-]\s*)+$/g, "")
    .trim();
}

function extractTags(value) {
  return tags.filter((tag) => value.includes(tag));
}

function removeTags(value) {
  return tags.reduce((next, tag) => next.replace(tag, ""), value).replace(/[·-]\s*$/g, "");
}

function isLocationLine(value) {
  const lower = value.toLowerCase();
  return (
    areaNames.some((area) => value.startsWith(area)) ||
    lower.includes("grid square") ||
    lower.startsWith("mystery location") ||
    lower.startsWith("in the ") ||
    lower.startsWith("at the ") ||
    lower.startsWith("by the ")
  );
}

function parseLocation(value) {
  const cleanValue = value.replace(/\s+/g, " ").trim() || "Location to be confirmed";
  const gridMatch = cleanValue.match(/grid square\s+([A-Z]\d{1,2})/i);
  const area = areaNames.find((name) => cleanValue.startsWith(name));

  return {
    name: cleanValue,
    area,
    gridSquare: gridMatch?.[1]?.toUpperCase(),
    notes: area ? cleanValue.replace(area, "").replace(/^,\s*/, "").trim() || undefined : undefined
  };
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
