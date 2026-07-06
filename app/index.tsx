import { Children, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { DayTabs } from "@/components/DayTabs";
import { EmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { HeartIcon } from "@/components/HeartIcon";
import { UndoNotice } from "@/components/UndoNotice";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { clearReturnContext, getReturnContext, setReturnContext } from "@/lib/returnNavigation";
import { subscribeToScrollToTop } from "@/lib/scrollToTopEvents";
import {
  campHostMatchesQuery,
  getCampHosts,
  getCanonicalCampHost,
  getCategories,
  getDefaultHomeDayId,
  getEventEndTime,
  getEventTitleSuggestions,
  getScheduleDays,
  getTags,
  searchEvents,
  tagMatchesQuery
} from "@/lib/scheduleQueries";
import type { FestivalCategory, FestivalEvent, FestivalTag } from "@/models/schedule";
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
  const scrollYRef = useRef(0);
  const campIndexScrollYRef = useRef(0);
  const days = getScheduleDays();
  const categories = useMemo(() => getCategories(), []);
  const campHosts = useMemo(() => getCampHosts(), []);
  const tags = useMemo(() => getTags(), []);
  const [scheduleNow] = useState(() => new Date());
  const defaultHomeDayId = useMemo(() => getDefaultHomeDayId(scheduleNow), [scheduleNow]);
  const [selectedDayId, setSelectedDayId] = useState<string | undefined>(() => getDefaultHomeDayId(scheduleNow));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FestivalCategory | "all">("all");
  const [selectedCampHosts, setSelectedCampHosts] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<FestivalTag[]>([]);
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState(false);
  const [collapsedCampDayIds, setCollapsedCampDayIds] = useState<string[]>([]);
  const [isPastEventsExpanded, setIsPastEventsExpanded] = useState(false);
  const [pendingRestoreScrollY, setPendingRestoreScrollY] = useState<number | undefined>();
  const saved = useSavedEvents();
  const hasActiveFilters = isCampMode
    ? query.trim().length > 0 || selectedCampHosts.length > 0
    : query.trim().length > 0 ||
      category !== "all" ||
      selectedDayId !== defaultHomeDayId ||
      selectedTags.length > 0;
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
  const homeSuggestions = useMemo(() => {
    const normalizedQuery = query.trim();
    if (isCampMode || normalizedQuery.length < 2) {
      return { camps: [], events: [], tags: [] };
    }

    return {
      camps: campHosts
        .filter((campHost) => campHostMatchesQuery(campHost, normalizedQuery))
        .slice(0, 5),
      events: getEventTitleSuggestions(normalizedQuery, 5, selectedDayId),
      tags: tags
        .filter((tag) => !selectedTags.includes(tag))
        .filter((tag) => tagMatchesQuery(tag, normalizedQuery))
        .slice(0, 5)
    };
  }, [campHosts, isCampMode, query, selectedDayId, selectedTags, tags]);
  const hasHomeSuggestions =
    homeSuggestions.camps.length > 0 || homeSuggestions.tags.length > 0 || homeSuggestions.events.length > 0;
  const isCampIndexVisible = isCampMode && selectedCampHosts.length === 0;

  const events = useMemo(
    () =>
      searchEvents(
        {
          dayId: isCampMode ? undefined : selectedDayId,
          category: isCampMode ? "all" : category,
          query: isCampMode ? "" : query,
          campHostsOnly: isCampMode,
          campHosts: isCampMode ? selectedCampHosts : undefined,
          tags: isCampMode ? undefined : selectedTags
        },
        scheduleNow
      ),
    [category, isCampMode, query, scheduleNow, selectedCampHosts, selectedDayId, selectedTags]
  );
  const campEventSections = useMemo(
    () => (isCampMode ? buildCampEventSections(events, days, scheduleNow) : { upcomingGroups: [], pastGroups: [] }),
    [days, events, isCampMode, scheduleNow]
  );
  const homeEventGroups = useMemo(
    () => (!isCampMode && !selectedDayId ? groupEventsByDay(events, days) : []),
    [days, events, isCampMode, selectedDayId]
  );
  const selectedDayIndex = selectedDayId ? days.findIndex((day) => day.id === selectedDayId) : -1;
  const previousDay = selectedDayIndex > 0 ? days[selectedDayIndex - 1] : undefined;
  const nextDay =
    selectedDayIndex >= 0
      ? days[selectedDayIndex + 1]
      : selectedDayId === undefined
        ? days[0]
        : undefined;

  useEffect(
    () =>
      subscribeToScrollToTop(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }),
    []
  );

  useFocusEffect(
    useCallback(() => {
      const context = getReturnContext();
      if (!context) {
        return;
      }

      if (!isCampMode && context.route === "home") {
        setQuery(context.query);
        setCategory(context.category);
        setSelectedDayId(context.selectedDayId);
        setSelectedTags(context.selectedTags);
        setIsFilterPanelExpanded(context.isFilterPanelExpanded);
        setPendingRestoreScrollY(context.scrollY);
        return;
      }

      if (isCampMode && context.route === "camps") {
        setQuery(context.query);
        setCategory("all");
        setSelectedTags([]);
        setSelectedCampHosts(context.mode === "selected" ? context.selectedCampHosts : []);
        setCollapsedCampDayIds(context.mode === "selected" ? context.collapsedDayIds : []);
        setIsPastEventsExpanded(context.mode === "selected" ? context.isPastEventsExpanded : false);
        campIndexScrollYRef.current = context.mode === "selected" ? context.campIndexScrollY : context.scrollY;
        setPendingRestoreScrollY(context.scrollY);
      }
    }, [isCampMode])
  );

  useEffect(() => {
    if (pendingRestoreScrollY === undefined) {
      return;
    }

    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: pendingRestoreScrollY, animated: false });
      scrollYRef.current = pendingRestoreScrollY;
      setPendingRestoreScrollY(undefined);
      clearReturnContext();
    }, 0);

    return () => clearTimeout(timeout);
  }, [events.length, isCampIndexVisible, pendingRestoreScrollY, selectedCampHosts]);

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setSelectedCampHosts([]);
    setSelectedTags([]);
    setCollapsedCampDayIds([]);
    setIsFilterPanelExpanded(false);
    setIsPastEventsExpanded(false);
    if (!isCampMode) {
      setSelectedDayId(defaultHomeDayId);
    }
  }

  function addCampHost(campHost: string) {
    setSelectedCampHosts((current) => (current.includes(campHost) ? current : [...current, campHost]));
    setQuery("");
  }

  function openCampHost(campHost: string) {
    campIndexScrollYRef.current = scrollYRef.current;
    setReturnContext({ mode: "index", query, route: "camps", scrollY: scrollYRef.current });
    setSelectedCampHosts([campHost]);
    setQuery("");
    setCollapsedCampDayIds([]);
    setIsPastEventsExpanded(false);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    scrollYRef.current = 0;
  }

  function removeCampHost(campHost: string) {
    const nextCampHosts = selectedCampHosts.filter((item) => item !== campHost);
    setSelectedCampHosts(nextCampHosts);
    if (isCampMode && nextCampHosts.length === 0) {
      setPendingRestoreScrollY(campIndexScrollYRef.current);
    }
  }

  function addTag(tag: FestivalTag) {
    setSelectedTags((current) => (current.includes(tag) ? current : [...current, tag]));
    setQuery("");
  }

  function removeTag(tag: FestivalTag) {
    setSelectedTags((current) => current.filter((item) => item !== tag));
  }

  function toggleCampDay(dayId: string) {
    setCollapsedCampDayIds((current) =>
      current.includes(dayId) ? current.filter((item) => item !== dayId) : [...current, dayId]
    );
  }

  function captureEventReturnContext() {
    if (isCampMode) {
      setReturnContext({
        campIndexScrollY: campIndexScrollYRef.current,
        collapsedDayIds: collapsedCampDayIds,
        isPastEventsExpanded,
        mode: "selected",
        query,
        route: "camps",
        scrollY: scrollYRef.current,
        selectedCampHosts
      });
      return;
    }

    setReturnContext({
      category,
      isFilterPanelExpanded,
      query,
      route: "home",
      scrollY: scrollYRef.current,
      selectedDayId,
      selectedTags
    });
  }

  function returnToCampIndex() {
    const context = getReturnContext();
    const scrollY = context?.route === "camps" && context.mode === "index" ? context.scrollY : campIndexScrollYRef.current;
    setSelectedCampHosts([]);
    setQuery("");
    setCollapsedCampDayIds([]);
    setIsPastEventsExpanded(false);
    setPendingRestoreScrollY(scrollY);
  }

  function selectHomeDay(dayId: string) {
    setSelectedDayId(dayId);
    scrollViewRef.current?.scrollTo({ y: 96, animated: true });
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      onScroll={(event) => {
        scrollYRef.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>{isCampMode ? "Camp schedule" : "Offline schedule"}</Text>
          <Text style={styles.title}>{isCampMode ? "Camps" : "JOMO 2.0"}</Text>
          <Text style={styles.subtitle}>
            {isCampIndexVisible
              ? `${campHosts.length} camps from bundled festival data.`
              : `${events.length} ${isCampMode ? "camp-hosted" : ""} events shown from bundled festival data.`}
          </Text>
        </View>
      </View>

      {saved.storageError ? <Text style={styles.warning}>{saved.storageError}</Text> : null}
      <UndoNotice label={saved.undoLabel} onUndo={saved.undoLastAction} />

      <TextInput
        accessibilityLabel={isCampMode ? "Search camps" : "Search events"}
        onChangeText={setQuery}
        placeholder={isCampMode ? "Search camps" : "Search events, camps, or tags"}
        placeholderTextColor={theme.colors.textMuted}
        style={styles.search}
        value={query}
      />

      {isCampMode && selectedCampHosts.length > 0 && campSuggestions.length > 0 ? (
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

      {!isCampMode && hasHomeSuggestions ? (
        <View style={styles.suggestions}>
          <SuggestionGroup title="Camps">
            {homeSuggestions.camps.map((campHost) => (
              <SuggestionButton key={campHost} label={campHost} onPress={() => setQuery(campHost)} />
            ))}
          </SuggestionGroup>
          <SuggestionGroup title="Tags">
            {homeSuggestions.tags.map((tag) => (
              <SuggestionButton key={tag} label={tag} onPress={() => addTag(tag)} />
            ))}
          </SuggestionGroup>
          <SuggestionGroup title="Events">
            {homeSuggestions.events.map((title) => (
              <SuggestionButton key={title} label={title} onPress={() => setQuery(title)} />
            ))}
          </SuggestionGroup>
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

      {!isCampMode ? (
        <View style={styles.filterPanel}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsFilterPanelExpanded((current) => !current)}
            style={styles.filterPanelHeader}
          >
            <Text style={styles.filterPanelTitle}>Filters</Text>
            <Text style={styles.dayToggle}>{isFilterPanelExpanded ? "-" : "+"}</Text>
          </Pressable>

          {selectedTags.length > 0 ? (
            <View style={styles.selectedCamps}>
              {selectedTags.map((tag) => (
                <FilterPill key={tag} label={tag} onRemove={() => removeTag(tag)} />
              ))}
            </View>
          ) : null}

          {isFilterPanelExpanded ? (
            <View style={styles.filterPanelBody}>
              <View style={styles.tagGrid}>
                {tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={tag}
                      onPress={() => (isSelected ? removeTag(tag) : addTag(tag))}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.filterSectionTitle}>Categories</Text>
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
            </View>
          ) : null}
        </View>
      ) : null}

      {isCampMode && selectedCampHosts.length > 0 ? (
        <View style={styles.selectedCampArea}>
          <Pressable accessibilityRole="button" onPress={returnToCampIndex} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to camps</Text>
          </Pressable>
          <View style={styles.campSaveControls}>
            {selectedCampHosts.map((campHost) => {
              const isSaved = saved.isCampSaved(campHost);

              return (
                <Pressable
                  accessibilityRole="button"
                  key={campHost}
                  onPress={() => saved.toggleSavedCamp(campHost)}
                  style={[styles.campSaveButton, isSaved && styles.campSaveButtonActive]}
                >
                  <Text style={[styles.campSaveButtonText, isSaved && styles.campSaveButtonTextActive]}>
                    {isSaved ? "Saved camp" : "Save camp"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
        </View>
      ) : null}

      {isCampMode && selectedCampHosts.length > 0 && query.trim().length >= 2 && campSuggestions.length === 0 ? (
        <View style={styles.resetRow}>
          <Text style={styles.filterSummary}>No matching camps</Text>
        </View>
      ) : null}

      {isCampIndexVisible ? (
        <CampIndex
          campHosts={campHosts}
          isCampSaved={saved.isCampSaved}
          onSelectCamp={openCampHost}
          onToggleSavedCamp={saved.toggleSavedCamp}
          query={query}
        />
      ) : isCampMode ? (
        <CampEventList
          collapsedDayIds={collapsedCampDayIds}
          isPastEventsExpanded={isPastEventsExpanded}
          isSaved={saved.isSaved}
          onBeforeEventNavigate={captureEventReturnContext}
          onTogglePastEvents={() => setIsPastEventsExpanded((current) => !current)}
          onToggleSaved={saved.toggleSaved}
          onToggleDay={toggleCampDay}
          pastGroups={campEventSections.pastGroups}
          upcomingGroups={campEventSections.upcomingGroups}
        />
      ) : (
        <>
          <View style={styles.list}>
            {events.length === 0 ? (
              <EmptyState title="No events found" body="Try a different day, category, or search term." />
            ) : !selectedDayId ? (
              homeEventGroups.map((group) => (
                <View key={group.dayId} style={styles.homeDayGroup}>
                  <HomeDayDivider label={group.label} />
                  {group.events.map((event) => (
                    <EventCard
                      event={event}
                      isSaved={saved.isSaved(event.id)}
                      key={event.id}
                      onBeforeNavigate={captureEventReturnContext}
                      onToggleSaved={saved.toggleSaved}
                    />
                  ))}
                </View>
              ))
            ) : (
              events.map((event) => (
                <EventCard
                  event={event}
                  isSaved={saved.isSaved(event.id)}
                  key={event.id}
                  onBeforeNavigate={captureEventReturnContext}
                  onToggleSaved={saved.toggleSaved}
                />
              ))
            )}
          </View>

          <View style={styles.dayNavigation}>
            {previousDay ? (
              <Pressable accessibilityRole="button" onPress={() => selectHomeDay(previousDay.id)} style={styles.dayNavButton}>
                <Text style={styles.dayNavButtonText}>Previous day</Text>
                <Text style={styles.dayNavButtonMeta}>{shortDayLabel(previousDay.label)}</Text>
              </Pressable>
            ) : null}
            {nextDay ? (
              <Pressable accessibilityRole="button" onPress={() => selectHomeDay(nextDay.id)} style={styles.dayNavButton}>
                <Text style={styles.dayNavButtonText}>{selectedDayId ? "Next day" : "View first day"}</Text>
                <Text style={styles.dayNavButtonMeta}>{shortDayLabel(nextDay.label)}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function SuggestionGroup({ children, title }: { children: ReactNode; title: string }) {
  if (Children.count(children) === 0) {
    return null;
  }

  return (
    <View style={styles.suggestionGroup}>
      <Text style={styles.suggestionGroupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SuggestionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.suggestionButton}>
      <Text style={styles.suggestionText}>{label}</Text>
    </Pressable>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Pressable accessibilityLabel={`Remove ${label}`} accessibilityRole="button" onPress={onRemove} style={styles.selectedCampChip}>
      <Text style={styles.selectedCampText}>{label}</Text>
      <Text style={styles.selectedCampRemove}>x</Text>
    </Pressable>
  );
}

function HomeDayDivider({ label }: { label: string }) {
  return (
    <View style={styles.homeDayDivider}>
      <View style={styles.homeDayDividerLine} />
      <Text style={styles.homeDayDividerText}>{shortDayLabel(label).split(/\s+/)[0]}</Text>
      <View style={styles.homeDayDividerLine} />
    </View>
  );
}

function CampIndex({
  campHosts,
  isCampSaved,
  onSelectCamp,
  onToggleSavedCamp,
  query
}: {
  campHosts: string[];
  isCampSaved: (campHost: string) => boolean;
  onSelectCamp: (campHost: string) => void;
  onToggleSavedCamp: (campHost: string) => void;
  query: string;
}) {
  const trimmedQuery = query.trim();
  const visibleCampHosts = trimmedQuery
    ? campHosts.filter((campHost) => campHostMatchesQuery(campHost, trimmedQuery))
    : campHosts;

  if (visibleCampHosts.length === 0) {
    return (
      <View style={styles.list}>
        <EmptyState title="No camps found" body="Try another camp search." />
      </View>
    );
  }

  return (
    <View style={styles.campIndex}>
      {visibleCampHosts.map((campHost) => {
        const isSaved = isCampSaved(campHost);

        return (
          <Pressable
            accessibilityLabel={`Open ${campHost}`}
            accessibilityRole="button"
            key={campHost}
            onPress={() => onSelectCamp(campHost)}
            style={styles.campIndexRow}
          >
            <Text style={styles.campIndexName}>{campHost}</Text>
            <Pressable
              accessibilityLabel={isSaved ? "Unsave camp" : "Save camp"}
              accessibilityRole="button"
              onPress={(pressEvent) => {
                pressEvent.stopPropagation();
                onToggleSavedCamp(campHost);
              }}
              style={styles.campIndexHeartButton}
            >
              <HeartIcon color={theme.colors.brandDark} filled={isSaved} size={21} />
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

function CampEventList({
  collapsedDayIds,
  isPastEventsExpanded,
  isSaved,
  onBeforeEventNavigate,
  onToggleDay,
  onTogglePastEvents,
  onToggleSaved,
  pastGroups,
  upcomingGroups
}: {
  collapsedDayIds: string[];
  isPastEventsExpanded: boolean;
  isSaved: (eventId: string) => boolean;
  onBeforeEventNavigate: () => void;
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
          onBeforeEventNavigate={onBeforeEventNavigate}
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
                        onBeforeNavigate={onBeforeEventNavigate}
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
  onBeforeEventNavigate,
  onToggleDay,
  onToggleSaved
}: {
  group: CampEventDayGroup;
  isCollapsed: boolean;
  isSaved: (eventId: string) => boolean;
  onBeforeEventNavigate: () => void;
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
              onBeforeNavigate={onBeforeEventNavigate}
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

function shortDayLabel(label: string): string {
  return label.replace(" 2026", "").replace(" (build)", "").replace(" (strike)", "");
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    marginHorizontal: theme.spacing.screenX,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
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
  campIndex: {
    gap: 8,
    paddingHorizontal: theme.spacing.screenX
  },
  campIndexHeartButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40
  },
  campIndexName: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 0
  },
  campIndexRow: {
    alignItems: "center",
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  campSaveButton: {
    alignItems: "center",
    backgroundColor: theme.surfaces.input,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  campSaveButtonActive: {
    backgroundColor: theme.colors.brandDark,
    borderColor: theme.colors.brandDark
  },
  campSaveButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  campSaveButtonTextActive: {
    color: theme.colors.textOnDark
  },
  campSaveControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: theme.spacing.screenX
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
  dayNavigation: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: theme.spacing.screenX
  },
  dayNavButton: {
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 150,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  dayNavButtonMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  dayNavButtonText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "900"
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
  filterPanel: {
    gap: 10
  },
  filterPanelBody: {
    gap: 12
  },
  filterPanelHeader: {
    alignItems: "center",
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: theme.spacing.screenX,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  filterPanelTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  filterSectionTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    marginHorizontal: theme.spacing.screenX,
    textTransform: "uppercase"
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
  homeDayDivider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4
  },
  homeDayDividerLine: {
    backgroundColor: theme.colors.borderSoft,
    flex: 1,
    height: 1,
    opacity: 0.7
  },
  homeDayDividerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  homeDayGroup: {
    gap: 12
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
  selectedCampArea: {
    gap: 8
  },
  suggestionButton: {
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  suggestionGroup: {
    gap: 6
  },
  suggestionGroupTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
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
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: theme.spacing.screenX
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
