import type { FestivalEventId, SavedCampState, SavedEventState } from "@/models/schedule";
import { getCanonicalCampHost } from "@/lib/scheduleQueries";
import { localStorageAdapter } from "@/storage/localStorageAdapter";

const STORAGE_KEY = "jomo-2.saved-events";

export async function loadSavedEventState(): Promise<SavedEventState> {
  const fallback = createEmptyState();
  const rawValue = await localStorageAdapter.getItem(STORAGE_KEY);

  if (!rawValue) {
    return fallback;
  }

  try {
    return sanitizeSavedEventState(JSON.parse(rawValue), fallback.updatedAt);
  } catch {
    return fallback;
  }
}

export async function saveSavedEventState(state: SavedEventState): Promise<void> {
  await localStorageAdapter.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function parseSavedEventStateJson(rawValue: string): SavedEventState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error("Saved schedule file is not valid JSON.");
  }

  if (!isSavedEventStateInput(parsed)) {
    throw new Error("Saved schedule file does not match the expected format.");
  }

  return sanitizeSavedEventState(parsed);
}

export function mergeSavedEventStates(currentState: SavedEventState, importedState: SavedEventState): SavedEventState {
  const savedCampsByHost = new Map<string, SavedCampState>();

  for (const savedCamp of [...currentState.savedCamps, ...importedState.savedCamps]) {
    const canonicalCampHost = getCanonicalCampHost(savedCamp.campHost);
    const existing = savedCampsByHost.get(canonicalCampHost);

    savedCampsByHost.set(canonicalCampHost, {
      campHost: canonicalCampHost,
      includeEvents: Boolean(existing?.includeEvents || savedCamp.includeEvents)
    });
  }

  return createSavedEventState({
    hiddenEventIds: [...currentState.hiddenEventIds, ...importedState.hiddenEventIds],
    savedCamps: Array.from(savedCampsByHost.values()),
    savedEventIds: [...currentState.savedEventIds, ...importedState.savedEventIds],
    updatedAt: new Date().toISOString()
  });
}

export function createSavedEventState({
  hiddenEventIds = [],
  savedCamps = [],
  savedEventIds = [],
  updatedAt = new Date().toISOString()
}: Partial<SavedEventState> = {}): SavedEventState {
  return {
    hiddenEventIds: Array.from(new Set(hiddenEventIds)),
    savedCamps: dedupeSavedCamps(savedCamps),
    savedEventIds: Array.from(new Set(savedEventIds)),
    updatedAt
  };
}

function createEmptyState(): SavedEventState {
  return {
    hiddenEventIds: [],
    savedCamps: [],
    savedEventIds: [],
    updatedAt: new Date(0).toISOString()
  };
}

function sanitizeSavedEventState(input: SavedEventStateInput, fallbackUpdatedAt = new Date(0).toISOString()): SavedEventState {
  const savedEventIds = Array.isArray(input.savedEventIds)
    ? input.savedEventIds.filter((id): id is FestivalEventId => typeof id === "string")
    : [];
  const savedCamps = parseSavedCamps(input).map((savedCamp) => ({
    ...savedCamp,
    campHost: getCanonicalCampHost(savedCamp.campHost)
  }));
  const hiddenEventIds = Array.isArray(input.hiddenEventIds)
    ? input.hiddenEventIds.filter((id): id is FestivalEventId => typeof id === "string")
    : [];

  return createSavedEventState({
    hiddenEventIds,
    savedCamps,
    savedEventIds,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : fallbackUpdatedAt
  });
}

type SavedEventStateInput = Partial<SavedEventState> & {
  savedCampHosts?: unknown;
};

function parseSavedCamps(parsed: SavedEventStateInput): SavedCampState[] {
  if (Array.isArray(parsed.savedCamps)) {
    return parsed.savedCamps.filter(isSavedCampState);
  }

  if (Array.isArray(parsed.savedCampHosts)) {
    return parsed.savedCampHosts
      .filter((campHost): campHost is string => typeof campHost === "string")
      .map((campHost) => ({
        campHost,
        includeEvents: true
      }));
  }

  return [];
}

function isSavedEventStateInput(value: unknown): value is SavedEventStateInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "savedEventIds" in value ||
    "savedCamps" in value ||
    "savedCampHosts" in value ||
    "hiddenEventIds" in value ||
    "updatedAt" in value
  );
}

function dedupeSavedCamps(savedCamps: SavedCampState[]): SavedCampState[] {
  const byCampHost = new Map<string, SavedCampState>();

  for (const savedCamp of savedCamps) {
    byCampHost.set(savedCamp.campHost, savedCamp);
  }

  return Array.from(byCampHost.values());
}

function isSavedCampState(value: unknown): value is SavedCampState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SavedCampState>;
  return typeof candidate.campHost === "string" && typeof candidate.includeEvents === "boolean";
}
