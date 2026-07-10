import generatedSchedule from "../src/data/generatedSchedule.ts";
import { buildScheduleFromPdf, pdfPath, sourcePdf } from "./import-pdf-schedule.mjs";
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
  (spreadsheetBuild.audit.locationConflicts.length > 0 ||
    spreadsheetBuild.audit.categoryUnknowns.length > 0 ||
    spreadsheetBuild.audit.tagUnknowns.length > 0 ||
    spreadsheetBuild.audit.idPreservationWarning)
) {
  process.exitCode = 1;
}
