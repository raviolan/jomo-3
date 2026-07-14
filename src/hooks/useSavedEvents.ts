import { useCallback, useEffect, useMemo, useState } from "react";

import type { FestivalEvent, FestivalEventId, SavedCampState, SavedEventState } from "@/models/schedule";
import { getCanonicalCampHost, getEventById, getEventCampHosts } from "@/lib/scheduleQueries";
import {
  createSavedEventState,
  loadSavedEventState,
  parseSavedEventStateJson,
  saveSavedEventState
} from "@/storage/savedEventsStore";

interface UndoState {
  label: string;
  state: SavedEventState;
}

export function useSavedEvents() {
  const [savedState, setSavedState] = useState<SavedEventState>(() => createSavedEventState());
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadSavedEventState()
      .then((state) => {
        if (isMounted) {
          setSavedState(
            createSavedEventState({
              ...state,
              savedCamps: state.savedCamps.map((savedCamp) => ({
                ...savedCamp,
                campHost: getCanonicalCampHost(savedCamp.campHost)
              }))
            })
          );
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

  useEffect(() => {
    if (!undoState) {
      return;
    }

    const timeout = setTimeout(() => {
      setUndoState(null);
    }, 6000);

    return () => clearTimeout(timeout);
  }, [undoState]);

  const savedEventIdSet = useMemo(() => new Set(savedState.savedEventIds), [savedState.savedEventIds]);
  const savedCampStateByHost = useMemo(
    () => new Map(savedState.savedCamps.map((savedCamp) => [savedCamp.campHost, savedCamp])),
    [savedState.savedCamps]
  );
  const savedCampHostSet = useMemo(() => new Set(savedState.savedCamps.map((savedCamp) => savedCamp.campHost)), [savedState.savedCamps]);
  const savedCampHostsWithEventsSet = useMemo(
    () =>
      new Set(
        savedState.savedCamps.filter((savedCamp) => savedCamp.includeEvents).map((savedCamp) => savedCamp.campHost)
      ),
    [savedState.savedCamps]
  );
  const hiddenEventIdSet = useMemo(() => new Set(savedState.hiddenEventIds), [savedState.hiddenEventIds]);

  const persist = useCallback(async (nextState: SavedEventState, undo?: UndoState) => {
    setSavedState(nextState);
    setUndoState(undo ?? null);

    try {
      await saveSavedEventState(nextState);
      setStorageError(null);
    } catch {
      setStorageError("Saved events could not be stored in this browser session.");
    }
  }, []);

  const commitState = useCallback(
    (nextState: Partial<SavedEventState>, undo?: UndoState) => {
      const state = createSavedEventState({
        ...nextState,
        updatedAt: new Date().toISOString()
      });

      void persist(state, undo);
    },
    [persist]
  );

  const isEventSavedByCamp = useCallback(
    (event: FestivalEvent) =>
      getEventCampHosts(event).some((campHost) => savedCampHostsWithEventsSet.has(campHost)),
    [savedCampHostsWithEventsSet]
  );

  const isEventSaved = useCallback(
    (event: FestivalEvent) =>
      savedEventIdSet.has(event.id) || (isEventSavedByCamp(event) && !hiddenEventIdSet.has(event.id)),
    [hiddenEventIdSet, isEventSavedByCamp, savedEventIdSet]
  );

  const toggleSaved = useCallback(
    (eventId: FestivalEventId) => {
      const event = getEventById(eventId);
      const wasExplicitlySaved = savedEventIdSet.has(eventId);
      const wasSavedByCamp = event ? isEventSavedByCamp(event) : false;
      const wasHidden = hiddenEventIdSet.has(eventId);
      const previousState = savedState;

      if (wasExplicitlySaved) {
        commitState(
          {
            ...savedState,
            savedEventIds: savedState.savedEventIds.filter((id) => id !== eventId)
          },
          { label: "Event removed", state: previousState }
        );
        return;
      }

      if (wasSavedByCamp && !wasHidden) {
        commitState(
          {
            ...savedState,
            hiddenEventIds: [...savedState.hiddenEventIds, eventId]
          },
          { label: "Event hidden", state: previousState }
        );
        return;
      }

      commitState({
        ...savedState,
        hiddenEventIds: savedState.hiddenEventIds.filter((id) => id !== eventId),
        savedEventIds: [...savedState.savedEventIds, eventId]
      });
    },
    [commitState, hiddenEventIdSet, isEventSavedByCamp, savedEventIdSet, savedState]
  );

  const isSaved = useCallback(
    (eventId: FestivalEventId) => {
      const event = getEventById(eventId);

      return event ? isEventSaved(event) : savedEventIdSet.has(eventId);
    },
    [isEventSaved, savedEventIdSet]
  );

  const savedEvents = useCallback(
    (events: FestivalEvent[]) => events.filter(isEventSaved),
    [isEventSaved]
  );

  const isCampSaved = useCallback(
    (campHost: string) => savedCampHostSet.has(getCanonicalCampHost(campHost)),
    [savedCampHostSet]
  );

  const getSavedCamp = useCallback(
    (campHost: string): SavedCampState | undefined => savedCampStateByHost.get(getCanonicalCampHost(campHost)),
    [savedCampStateByHost]
  );

  const isCampSavedWithEvents = useCallback(
    (campHost: string) => Boolean(getSavedCamp(campHost)?.includeEvents),
    [getSavedCamp]
  );

  const saveCamp = useCallback(
    (campHost: string, includeEvents: boolean) => {
      const canonicalCampHost = getCanonicalCampHost(campHost);

      commitState({
        ...savedState,
        savedCamps: [
          ...savedState.savedCamps.filter((savedCamp) => savedCamp.campHost !== canonicalCampHost),
          {
            campHost: canonicalCampHost,
            includeEvents
          }
        ]
      });
    },
    [commitState, savedState]
  );

  const toggleSavedCamp = useCallback(
    (campHost: string) => {
      const canonicalCampHost = getCanonicalCampHost(campHost);
      const previousState = savedState;

      if (savedCampHostSet.has(canonicalCampHost)) {
        commitState(
          {
            ...savedState,
            savedCamps: savedState.savedCamps.filter((savedCamp) => savedCamp.campHost !== canonicalCampHost)
          },
          { label: "Camp removed", state: previousState }
        );
        return;
      }
    },
    [commitState, savedCampHostSet, savedState]
  );

  const savedCampEvents = useCallback(
    (campHost: string, events: FestivalEvent[]) => {
      const canonicalCampHost = getCanonicalCampHost(campHost);
      const savedCamp = savedCampStateByHost.get(canonicalCampHost);

      if (!savedCamp?.includeEvents) {
        return [];
      }

      return events.filter((event) => getEventCampHosts(event).includes(canonicalCampHost));
    },
    [savedCampStateByHost]
  );

  const undoLastAction = useCallback(() => {
    if (!undoState) {
      return;
    }

    void persist(undoState.state);
  }, [persist, undoState]);

  const clearUndo = useCallback(() => {
    setUndoState(null);
  }, []
  );

  const exportSavedState = useCallback(() => createSavedEventState(savedState), [savedState]);

  const importSavedState = useCallback(
    async (rawValue: string) => {
      const nextState = createSavedEventState(parseSavedEventStateJson(rawValue));
      await persist(nextState);
      return nextState;
    },
    [persist]
  );

  return {
    isHydrating,
    storageError,
    hiddenEventIds: savedState.hiddenEventIds,
    savedCampHosts: savedState.savedCamps.map((savedCamp) => savedCamp.campHost),
    savedCamps: savedState.savedCamps,
    savedEventIds: savedState.savedEventIds,
    undoLabel: undoState?.label,
    clearUndo,
    getSavedCamp,
    exportSavedState,
    importSavedState,
    isCampSaved,
    isCampSavedWithEvents,
    isSaved,
    saveCamp,
    savedCampEvents,
    savedEvents,
    toggleSaved,
    toggleSavedCamp,
    undoLastAction
  };
}
