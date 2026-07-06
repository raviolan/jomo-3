import { useCallback, useEffect, useMemo, useState } from "react";

import type { FestivalEvent, FestivalEventId, SavedEventState } from "@/models/schedule";
import { getCampHostGroups, getCanonicalCampHost, getEventById } from "@/lib/scheduleQueries";
import {
  createSavedEventState,
  loadSavedEventState,
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
              savedCampHosts: state.savedCampHosts.map(getCanonicalCampHost)
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
  const savedCampHostSet = useMemo(() => new Set(savedState.savedCampHosts), [savedState.savedCampHosts]);
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
      Boolean(event.campHost && getCampHostGroups(event.campHost).some((campHost) => savedCampHostSet.has(campHost))),
    [savedCampHostSet]
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

  const toggleSavedCamp = useCallback(
    (campHost: string) => {
      const canonicalCampHost = getCanonicalCampHost(campHost);
      const previousState = savedState;

      if (savedCampHostSet.has(canonicalCampHost)) {
        commitState(
          {
            ...savedState,
            savedCampHosts: savedState.savedCampHosts.filter((item) => item !== canonicalCampHost)
          },
          { label: "Camp removed", state: previousState }
        );
        return;
      }

      commitState({
        ...savedState,
        savedCampHosts: [...savedState.savedCampHosts, canonicalCampHost]
      });
    },
    [commitState, savedCampHostSet, savedState]
  );

  const savedCampEvents = useCallback(
    (campHost: string, events: FestivalEvent[]) => {
      const canonicalCampHost = getCanonicalCampHost(campHost);

      return events.filter((event) =>
        event.campHost ? getCampHostGroups(event.campHost).includes(canonicalCampHost) : false
      );
    },
    []
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

  return {
    isHydrating,
    storageError,
    hiddenEventIds: savedState.hiddenEventIds,
    savedCampHosts: savedState.savedCampHosts,
    savedEventIds: savedState.savedEventIds,
    undoLabel: undoState?.label,
    clearUndo,
    isCampSaved,
    isSaved,
    savedCampEvents,
    savedEvents,
    toggleSaved,
    toggleSavedCamp,
    undoLastAction
  };
}
