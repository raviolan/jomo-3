import schedule from "../src/data/generatedSchedule.ts";

const tagOnlyLocations = new Set([
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

const events = schedule.events;
const days = schedule.days;
const perDayCounts = days.map((day) => ({
  date: day.date,
  label: day.label,
  events: events.filter((event) => event.dayId === day.id).length
}));

const unresolvedLocations = events.filter(
  (event) =>
    event.location.name === "Location to be confirmed" ||
    /mystery location/i.test(event.location.name) ||
    /not decided/i.test(event.location.name)
);

const duplicateGroups = Array.from(
  events.reduce((map, event) => {
    const key = [event.title, event.date, event.time.start, event.time.end].join(" | ");
    const existing = map.get(key) ?? [];
    existing.push(event);
    map.set(key, existing);
    return map;
  }, new Map())
)
  .filter(([, groupedEvents]) => groupedEvents.length > 1)
  .map(([key, groupedEvents]) => ({
    key,
    count: groupedEvents.length,
    ids: groupedEvents.map((event) => event.id)
  }))
  .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

const descriptionDuplicates = events
  .filter((event) => {
    const location = event.location.name.trim().toLowerCase();
    const description = event.description.trim().toLowerCase();
    return Boolean(location) && Boolean(description) && description.startsWith(location);
  })
  .map((event) => ({
    id: event.id,
    title: event.title,
    date: event.date,
    location: event.location.name
  }));

const summary = {
  sourcePdf: schedule.sourcePdf,
  generatedAt: schedule.generatedAt,
  totals: {
    days: days.length,
    events: events.length,
    gridSquaresCoverage: ratio(events.filter((event) => event.gridSquares?.length).length, events.length),
    campHostCoverage: ratio(events.filter((event) => event.campHost).length, events.length)
  },
  perDayCounts,
  unresolvedLocations: unresolvedLocations.map((event) => ({
    title: event.title,
    date: event.date,
    time: event.time.display,
    location: event.location.name,
    host: event.host,
    campHost: event.campHost,
    page: event.source.page
  })),
  tagOnlyLocations: events
    .filter((event) => tagOnlyLocations.has(event.location.name))
    .map((event) => ({
      title: event.title,
      date: event.date,
      location: event.location.name,
      page: event.source.page
    })),
  duplicateTitleDateTimeEntries: duplicateGroups,
  duplicatedLocationAtDescriptionStart: descriptionDuplicates
};

console.log(JSON.stringify(summary, null, 2));

function ratio(count, total) {
  return {
    count,
    total,
    percentage: total === 0 ? 0 : Number(((count / total) * 100).toFixed(1))
  };
}
