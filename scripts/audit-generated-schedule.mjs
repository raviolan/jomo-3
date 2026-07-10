import generatedSchedule from "../src/data/generatedSchedule.ts";
import { buildScheduleFromPdf, isLucifersPitReference, pdfPath, sourcePdf } from "./import-pdf-schedule.mjs";
import { buildScheduleFromSpreadsheet } from "./import-spreadsheet-schedule.mjs";

const failOnSuspicious = process.argv.includes("--fail-on-suspicious");

const pdfBaseline = await buildScheduleFromPdf(pdfPath);
const spreadsheetBuild = await buildScheduleFromSpreadsheet({
  baselineSchedule: pdfBaseline.schedule
});

const summary = {
  baseline: {
    sourcePdf,
    events: pdfBaseline.schedule.events.length,
    campListings: pdfBaseline.schedule.campListings.length
  },
  generated: {
    sourcePdf: generatedSchedule.sourcePdf,
    generatedAt: generatedSchedule.generatedAt,
    events: generatedSchedule.events.length,
    campListings: generatedSchedule.campListings.length
  },
  lucifersPitNormalization: collectLucifersPitNormalizationIssues(generatedSchedule),
  importAudit: spreadsheetBuild.audit,
  generatedMatchesFreshSpreadsheetBuild: {
    eventCount: generatedSchedule.events.length === spreadsheetBuild.schedule.events.length,
    campListingCount: generatedSchedule.campListings.length === spreadsheetBuild.schedule.campListings.length,
    eventIdsPresent: spreadsheetBuild.schedule.events.every((event) => generatedSchedule.events.some((item) => item.id === event.id)),
    campListingIdsPresent: spreadsheetBuild.schedule.campListings.every((listing) =>
      generatedSchedule.campListings.some((item) => item.id === listing.id)
    )
  }
};

console.log(JSON.stringify(summary, null, 2));

if (
  failOnSuspicious &&
  (summary.lucifersPitNormalization.events.length > 0 ||
    summary.lucifersPitNormalization.campListings.length > 0 ||
    spreadsheetBuild.audit.locationConflicts.length > 0 ||
    spreadsheetBuild.audit.categoryUnknowns.length > 0 ||
    spreadsheetBuild.audit.tagUnknowns.length > 0 ||
    spreadsheetBuild.audit.idPreservationWarning)
) {
  process.exitCode = 1;
}

function collectLucifersPitNormalizationIssues(schedule) {
  return {
    events: schedule.events
      .filter((event) =>
        isLucifersPitReference([
          event.title,
          event.location.name,
          event.host,
          ...(event.hosts ?? []),
          event.campHost,
          ...(event.campHosts ?? []),
          event.description
        ])
      )
      .filter((event) => !hasExactK19(event))
      .map((event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time.display,
        location: event.location.name,
        gridSquare: event.location.gridSquare,
        gridSquares: event.gridSquares?.map((square) => square.label) ?? []
      })),
    campListings: schedule.campListings
      .filter((listing) =>
        isLucifersPitReference([listing.name, listing.location.name, listing.description])
      )
      .filter((listing) => !hasExactK19(listing))
      .map((listing) => ({
        id: listing.id,
        name: listing.name,
        location: listing.location.name,
        gridSquare: listing.location.gridSquare,
        gridSquares: listing.gridSquares?.map((square) => square.label) ?? []
      }))
  };
}

function hasExactK19(entry) {
  return entry.location.gridSquare === "K19" && (entry.gridSquares?.length ?? 0) === 1 && entry.gridSquares?.[0]?.label === "K19";
}
