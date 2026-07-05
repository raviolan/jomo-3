import { useCallback, useEffect, useMemo, useState } from "react";

import type { FestivalEvent, FestivalEventId } from "@/models/schedule";
import {
  createSavedEventState,
  loadSavedEventState,
  saveSavedEventState
} from "@/storage/savedEventsStore";

export function useSavedEvents() {
  const [savedEventIds, setSavedEventIds] = useState<FestivalEventId[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadSavedEventState()
      .then((state) => {
        if (isMounted) {
          setSavedEventIds(state.savedEventIds);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStorageError("Saved events are unavailable in this browser session.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsHydrating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const savedEventIdSet = useMemo(() => new Set(savedEventIds), [savedEventIds]);

  const persist = useCallback(async (nextIds: FestivalEventId[]) => {
    const state = createSavedEventState(nextIds);
    setSavedEventIds(state.savedEventIds);

    try {
      await saveSavedEventState(state);
      setStorageError(null);
    } catch {
      setStorageError("Saved events could not be stored in this browser session.");
    }
  }, []);

  const toggleSaved = useCallback(
    (eventId: FestivalEventId) => {
      const nextIds = savedEventIdSet.has(eventId)
        ? savedEventIds.filter((id) => id !== eventId)
        : [...savedEventIds, eventId];

      void persist(nextIds);
    },
    [persist, savedEventIdSet, savedEventIds]
  );

  const isSaved = useCallback(
    (eventId: FestivalEventId) => savedEventIdSet.has(eventId),
    [savedEventIdSet]
  );

  const savedEvents = useCallback(
    (events: FestivalEvent[]) => events.filter((event) => savedEventIdSet.has(event.id)),
    [savedEventIdSet]
  );

  return {
    isHydrating,
    storageError,
    savedEventIds,
    isSaved,
    savedEvents,
    toggleSaved
  };
}
