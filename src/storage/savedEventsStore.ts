import type { FestivalEventId, SavedCampState, SavedEventState } from "@/models/schedule";
import { localStorageAdapter } from "@/storage/localStorageAdapter";

const STORAGE_KEY = "jomo-2.saved-events";

export async function loadSavedEventState(): Promise<SavedEventState> {
  const fallback = createEmptyState();
  const rawValue = await localStorageAdapter.getItem(STORAGE_KEY);

  if (!rawValue) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SavedEventState> & {
      savedCampHosts?: unknown;
    };
    const savedEventIds = Array.isArray(parsed.savedEventIds)
      ? parsed.savedEventIds.filter((id): id is FestivalEventId => typeof id === "string")
      : [];
    const savedCamps = parseSavedCamps(parsed);
    const hiddenEventIds = Array.isArray(parsed.hiddenEventIds)
      ? parsed.hiddenEventIds.filter((id): id is FestivalEventId => typeof id === "string")
      : [];

    return createSavedEventState({
      hiddenEventIds,
      savedCamps,
      savedEventIds,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt
    });
  } catch {
    return fallback;
  }
}

export async function saveSavedEventState(state: SavedEventState): Promise<void> {
  await localStorageAdapter.setItem(STORAGE_KEY, JSON.stringify(state));
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

function parseSavedCamps(parsed: Partial<SavedEventState> & { savedCampHosts?: unknown }): SavedCampState[] {
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
