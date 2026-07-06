import type { FestivalEventId, SavedEventState } from "@/models/schedule";
import { localStorageAdapter } from "@/storage/localStorageAdapter";

const STORAGE_KEY = "jomo-2.saved-events";

export async function loadSavedEventState(): Promise<SavedEventState> {
  const fallback = createEmptyState();
  const rawValue = await localStorageAdapter.getItem(STORAGE_KEY);

  if (!rawValue) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SavedEventState>;
    const savedEventIds = Array.isArray(parsed.savedEventIds)
      ? parsed.savedEventIds.filter((id): id is FestivalEventId => typeof id === "string")
      : [];
    const savedCampHosts = Array.isArray(parsed.savedCampHosts)
      ? parsed.savedCampHosts.filter((campHost): campHost is string => typeof campHost === "string")
      : [];
    const hiddenEventIds = Array.isArray(parsed.hiddenEventIds)
      ? parsed.hiddenEventIds.filter((id): id is FestivalEventId => typeof id === "string")
      : [];

    return createSavedEventState({
      hiddenEventIds,
      savedCampHosts,
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
  savedCampHosts = [],
  savedEventIds = [],
  updatedAt = new Date().toISOString()
}: Partial<SavedEventState> = {}): SavedEventState {
  return {
    hiddenEventIds: Array.from(new Set(hiddenEventIds)),
    savedCampHosts: Array.from(new Set(savedCampHosts)),
    savedEventIds: Array.from(new Set(savedEventIds)),
    updatedAt
  };
}

function createEmptyState(): SavedEventState {
  return {
    hiddenEventIds: [],
    savedCampHosts: [],
    savedEventIds: [],
    updatedAt: new Date(0).toISOString()
  };
}
