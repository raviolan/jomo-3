import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { DayTabs } from "@/components/DayTabs";
import { EmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { subscribeToScrollToTop } from "@/lib/scrollToTopEvents";
import {
  campHostMatchesQuery,
  getCampHosts,
  getCanonicalCampHost,
  getCategories,
  getDefaultScheduleDayId,
  getEventEndTime,
  getScheduleDays,
  searchEvents
} from "@/lib/scheduleQueries";
import type { FestivalCategory, FestivalEvent } from "@/models/schedule";
import { theme } from "@/theme/theme";

interface CampEventDayGroup {
  dayId: string;
  label: string;
  events: FestivalEvent[];
}

export default function ScheduleScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const isCampMode = params.view === "camps";
  const scrollViewRef = useRef<ScrollView>(null);
  const days = getScheduleDays();
  const categories = useMemo(() => getCategories(), []);
  const campHosts = useMemo(() => getCampHosts(), []);
  const [scheduleNow] = useState(() => new Date());
  const defaultDayId = useMemo(() => getDefaultScheduleDayId(scheduleNow), [scheduleNow]);
  const [selectedDayId, setSelectedDayId] = useState(() => getDefaultScheduleDayId(scheduleNow));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FestivalCategory | "all">("all");
  const [selectedCampHosts, setSelectedCampHosts] = useState<string[]>([]);
  const [collapsedCampDayIds, setCollapsedCampDayIds] = useState<string[]>([]);
  const [isPastEventsExpanded, setIsPastEventsExpanded] = useState(false);
  const saved = useSavedEvents();
  const hasActiveFilters = isCampMode
    ? query.trim().length > 0 || selectedCampHosts.length > 0
    : query.trim().length > 0 || category !== "all" || selectedDayId !== defaultDayId;
  const campSuggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (normalizedQuery.length < 2) {
      return [];
    }

    return campHosts
      .filter((campHost) => !selectedCampHosts.includes(campHost))
      .filter((campHost) => campHostMatchesQuery(campHost, normalizedQuery))
      .slice(0, 8);
  }, [campHosts, query, selectedCampHosts]);

  const events = useMemo(
    () =>
      searchEvents(
        {
          dayId: isCampMode ? undefined : selectedDayId,
          category: isCampMode ? "all" : category,
          query: isCampMode ? "" : query,
          campHostsOnly: isCampMode,
          campHosts: isCampMode ? selectedCampHosts : undefined
        },
        scheduleNow
      ),
    [category, isCampMode, query, scheduleNow, selectedCampHosts, selectedDayId]
  );
  const campEventSections = useMemo(
    () => (isCampMode ? buildCampEventSections(events, days, scheduleNow) : { upcomingGroups: [], pastGroups: [] }),
    [days, events, isCampMode, scheduleNow]
  );

  useEffect(
    () =>
      subscribeToScrollToTop(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }),
    []
  );

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setSelectedCampHosts([]);
    setCollapsedCampDayIds([]);
    setIsPastEventsExpanded(false);
    if (!isCampMode) {
      setSelectedDayId(defaultDayId);
    }
  }

  function addCampHost(campHost: string) {
    setSelectedCampHosts((current) => (current.includes(campHost) ? current : [...current, campHost]));
    setQuery("");
  }

  function removeCampHost(campHost: string) {
    setSelectedCampHosts((current) => current.filter((item) => item !== campHost));
  }

  function toggleCampDay(dayId: string) {
    setCollapsedCampDayIds((current) =>
      current.includes(dayId) ? current.filter((item) => item !== dayId) : [...current, dayId]
    );
  }

  return (
    <ScrollView ref={scrollViewRef} style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>{isCampMode ? "Camp schedule" : "Offline schedule"}</Text>
          <Text style={styles.title}>{isCampMode ? "Camps" : "JOMO 2.0"}</Text>
          <Text style={styles.subtitle}>
            {events.length} {isCampMode ? "camp-hosted" : ""} events shown from bundled festival data.
          </Text>
        </View>
      </View>

      {saved.storageError ? <Text style={styles.warning}>{saved.storageError}</Text> : null}

      <TextInput
        accessibilityLabel={isCampMode ? "Search camps" : "Search events"}
        onChangeText={setQuery}
        placeholder={isCampMode ? "Search camps" : "Search title, host, place, category"}
        placeholderTextColor={theme.colors.textMuted}
        style={styles.search}
        value={query}
      />

      {isCampMode && campSuggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {campSuggestions.map((campHost) => (
            <Pressable
              accessibilityRole="button"
              key={campHost}
              onPress={() => addCampHost(campHost)}
              style={styles.suggestionButton}
            >
              <Text style={styles.suggestionText}>{campHost}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {hasActiveFilters ? (
        <View style={styles.resetRow}>
          <Text style={styles.filterSummary}>Filters active</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={resetFilters} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </Pressable>
        </View>
      ) : null}

      {!isCampMode ? <DayTabs days={days} selectedDayId={selectedDayId} onSelectDay={setSelectedDayId} /> : null}

      {isCampMode && selectedCampHosts.length > 0 ? (
        <View style={styles.selectedCamps}>
          {selectedCampHosts.map((campHost) => (
            <Pressable
              accessibilityLabel={`Remove ${campHost}`}
              accessibilityRole="button"
              key={campHost}
              onPress={() => removeCampHost(campHost)}
              style={styles.selectedCampChip}
            >
              <Text style={styles.selectedCampText}>{campHost}</Text>
              <Text style={styles.selectedCampRemove}>x</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isCampMode && query.trim().length >= 2 && campSuggestions.length === 0 ? (
        <View style={styles.resetRow}>
          <Text style={styles.filterSummary}>No matching camps</Text>
        </View>
      ) : null}

      {!isCampMode ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Pressable
            onPress={() => setCategory("all")}
            style={[styles.filterChip, category === "all" && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, category === "all" && styles.filterTextActive]}>All</Text>
          </Pressable>
          {categories.map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[styles.filterChip, category === item && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, category === item && styles.filterTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {isCampMode ? (
        <CampEventList
          collapsedDayIds={collapsedCampDayIds}
          isPastEventsExpanded={isPastEventsExpanded}
          isSaved={saved.isSaved}
          onTogglePastEvents={() => setIsPastEventsExpanded((current) => !current)}
          onToggleSaved={saved.toggleSaved}
          onToggleDay={toggleCampDay}
          pastGroups={campEventSections.pastGroups}
          upcomingGroups={campEventSections.upcomingGroups}
        />
      ) : (
        <View style={styles.list}>
          {events.length === 0 ? (
            <EmptyState title="No events found" body="Try a different day, category, or search term." />
          ) : (
            events.map((event) => (
              <EventCard
                event={event}
                isSaved={saved.isSaved(event.id)}
                key={event.id}
                onToggleSaved={saved.toggleSaved}
              />
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function CampEventList({
  collapsedDayIds,
  isPastEventsExpanded,
  isSaved,
  onToggleDay,
  onTogglePastEvents,
  onToggleSaved,
  pastGroups,
  upcomingGroups
}: {
  collapsedDayIds: string[];
  isPastEventsExpanded: boolean;
  isSaved: (eventId: string) => boolean;
  onToggleDay: (dayId: string) => void;
  onTogglePastEvents: () => void;
  onToggleSaved: (eventId: string) => void;
  pastGroups: CampEventDayGroup[];
  upcomingGroups: CampEventDayGroup[];
}) {
  const pastEventCount = pastGroups.reduce((count, group) => count + group.events.length, 0);

  if (upcomingGroups.length === 0 && pastEventCount === 0) {
    return (
      <View style={styles.list}>
        <EmptyState title="No events found" body="Try another selected camp." />
      </View>
    );
  }

  return (
    <View style={styles.campFlow}>
      {upcomingGroups.map((group) => (
        <CampDaySection
          group={group}
          isCollapsed={collapsedDayIds.includes(group.dayId)}
          isSaved={isSaved}
          key={group.dayId}
          onToggleDay={onToggleDay}
          onToggleSaved={onToggleSaved}
        />
      ))}

      {pastEventCount > 0 ? (
        <View style={styles.pastSection}>
          <Pressable accessibilityRole="button" onPress={onTogglePastEvents} style={styles.dayHeader}>
            <View style={styles.dayHeaderText}>
              <Text style={styles.dayEyebrow}>Past events</Text>
              <Text style={styles.dayTitle}>{pastEventCount} events</Text>
            </View>
            <Text style={styles.dayToggle}>{isPastEventsExpanded ? "-" : "+"}</Text>
          </Pressable>

          {isPastEventsExpanded ? (
            <View style={styles.pastGroups}>
              {pastGroups.map((group) => (
                <View key={group.dayId} style={styles.pastGroup}>
                  <Text style={styles.pastGroupTitle}>{group.label}</Text>
                  <View style={styles.list}>
                    {group.events.map((event) => (
                      <EventCard
                        event={event}
                        campHostLabel={event.campHost ? getCanonicalCampHost(event.campHost) : undefined}
                        isSaved={isSaved(event.id)}
                        key={event.id}
                        onToggleSaved={onToggleSaved}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function CampDaySection({
  group,
  isCollapsed,
  isSaved,
  onToggleDay,
  onToggleSaved
}: {
  group: CampEventDayGroup;
  isCollapsed: boolean;
  isSaved: (eventId: string) => boolean;
  onToggleDay: (dayId: string) => void;
  onToggleSaved: (eventId: string) => void;
}) {
  return (
    <View style={styles.daySection}>
      <Pressable accessibilityRole="button" onPress={() => onToggleDay(group.dayId)} style={styles.dayHeader}>
        <View style={styles.dayHeaderText}>
          <Text style={styles.dayEyebrow}>{group.events.length} events</Text>
          <Text style={styles.dayTitle}>{group.label}</Text>
        </View>
        <Text style={styles.dayToggle}>{isCollapsed ? "+" : "-"}</Text>
      </Pressable>

      {!isCollapsed ? (
        <View style={styles.list}>
          {group.events.map((event) => (
            <EventCard
              campHostLabel={event.campHost ? getCanonicalCampHost(event.campHost) : undefined}
              event={event}
              isSaved={isSaved(event.id)}
              key={event.id}
              onToggleSaved={onToggleSaved}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function buildCampEventSections(
  events: FestivalEvent[],
  days: ReturnType<typeof getScheduleDays>,
  now: Date
): { upcomingGroups: CampEventDayGroup[]; pastGroups: CampEventDayGroup[] } {
  const nowTime = now.getTime();
  const upcomingEvents: FestivalEvent[] = [];
  const pastEvents: FestivalEvent[] = [];

  for (const event of events) {
    if (getEventEndTime(event) <= nowTime) {
      pastEvents.push(event);
    } else {
      upcomingEvents.push(event);
    }
  }

  return {
    upcomingGroups: groupEventsByDay(upcomingEvents, days),
    pastGroups: groupEventsByDay(pastEvents, days)
  };
}

function groupEventsByDay(events: FestivalEvent[], days: ReturnType<typeof getScheduleDays>): CampEventDayGroup[] {
  const daysById = new Map(days.map((day) => [day.id, day]));
  const groups = new Map<string, FestivalEvent[]>();

  for (const event of events) {
    groups.set(event.dayId, [...(groups.get(event.dayId) ?? []), event]);
  }

  return Array.from(groups.entries()).map(([dayId, groupEvents]) => ({
    dayId,
    label: daysById.get(dayId)?.label ?? groupEvents[0]?.date ?? dayId,
    events: groupEvents
  }));
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    marginHorizontal: "auto",
    maxWidth: 760,
    paddingBottom: theme.spacing.bottomNavPadding,
    paddingTop: 18,
    width: "100%"
  },
  campFlow: {
    gap: 14
  },
  dayEyebrow: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  dayHeader: {
    alignItems: "center",
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginHorizontal: theme.spacing.screenX,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  dayHeaderText: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  daySection: {
    gap: 10
  },
  dayTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  dayToggle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    minWidth: 18,
    textAlign: "center"
  },
  eyebrow: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  filterChip: {
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  filterChipActive: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brand
  },
  filterText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  filterTextActive: {
    color: theme.colors.textOnDark
  },
  filters: {
    gap: 8,
    paddingHorizontal: theme.spacing.screenX
  },
  hero: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.screenX
  },
  heroText: {
    flex: 1,
    minWidth: 0
  },
  list: {
    gap: 12,
    paddingHorizontal: theme.spacing.screenX
  },
  pastGroup: {
    gap: 8
  },
  pastGroups: {
    gap: 12
  },
  pastGroupTitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
    marginHorizontal: theme.spacing.screenX,
    textTransform: "uppercase"
  },
  pastSection: {
    gap: 10
  },
  screen: {
    backgroundColor: "transparent",
    flex: 1
  },
  search: {
    backgroundColor: theme.surfaces.input,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: 16,
    marginHorizontal: theme.spacing.screenX,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  selectedCampChip: {
    alignItems: "center",
    backgroundColor: theme.colors.brand,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  selectedCampRemove: {
    color: theme.colors.textOnDark,
    fontSize: 12,
    fontWeight: "900"
  },
  selectedCampText: {
    color: theme.colors.textOnDark,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800"
  },
  selectedCamps: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: theme.spacing.screenX
  },
  suggestionButton: {
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  suggestions: {
    gap: 6,
    marginHorizontal: theme.spacing.screenX
  },
  suggestionText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  filterSummary: {
    color: theme.colors.textMuted,
    flex: 1,
    fontSize: 12,
    fontWeight: "800"
  },
  resetButton: {
    alignItems: "center"
  },
  resetButtonText: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "900",
    textDecorationLine: "underline"
  },
  resetRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: theme.spacing.screenX
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 21
  },
  title: {
    color: theme.colors.text,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 0
  },
  warning: {
    backgroundColor: theme.colors.warningBackground,
    borderColor: theme.colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.colors.warningText,
    marginHorizontal: theme.spacing.screenX,
    padding: 12
  }
});
