import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { AppFooter } from "@/components/AppFooter";
import { EmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { UndoNotice } from "@/components/UndoNotice";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { exportEventsAsCalendarFile } from "@/lib/calendarExport";
import { clearReturnContext, getReturnContext, setReturnContext } from "@/lib/returnNavigation";
import { getAllEvents, getEventById, getEventEndTime, getEventHref, getEventStartTime, getScheduleDays } from "@/lib/scheduleQueries";
import { subscribeToScrollToTop } from "@/lib/scrollToTopEvents";
import { theme } from "@/theme/theme";
import type { FestivalDay, FestivalEvent, SavedCampState } from "@/models/schedule";

type SavedTab = "events" | "camps" | "schedule";
type ScheduleRange = "1day" | "3days" | "week";

interface SavedEventDayGroup {
  dayId: string;
  events: FestivalEvent[];
  label: string;
}

interface ScheduleDayGroup {
  day: FestivalDay;
  events: FestivalEvent[];
}

interface ScheduleTick {
  label: string;
  top: number;
  time: number;
}

interface ScheduleRow {
  columnCount: number;
  columnIndex: number;
  end: number;
  event: FestivalEvent;
  height: number;
  leftPercent: number;
  top: number;
  widthPercent: number;
}

interface ScheduleTimeline {
  dayEnd: number;
  dayStart: number;
  rows: ScheduleRow[];
  ticks: ScheduleTick[];
  timelineHeight: number;
}

interface TimelineBounds {
  dayEnd: number;
  dayStart: number;
}

interface TimelineTimeBounds {
  endMinute: number;
  startMinute: number;
}

const scheduleRanges: { label: string; value: ScheduleRange }[] = [
  { label: "1 day", value: "1day" },
  { label: "3 days", value: "3days" },
  { label: "full week", value: "week" }
];

const scheduleBlockStyles = [
  { backgroundColor: "rgba(189, 243, 212, 0.7)", borderLeftColor: theme.colors.mint },
  { backgroundColor: "rgba(255, 210, 179, 0.68)", borderLeftColor: theme.colors.peach },
  { backgroundColor: "rgba(217, 195, 255, 0.66)", borderLeftColor: theme.colors.lavender },
  { backgroundColor: "rgba(255, 159, 207, 0.54)", borderLeftColor: theme.colors.pink },
  { backgroundColor: "rgba(114, 217, 220, 0.58)", borderLeftColor: theme.colors.cyan }
];

const minuteMs = 60 * 1000;
const scheduleMinuteHeight = 0.82;
const minTimelineHeight = 160;
const minScheduleBlockHeight = 54;
const scheduleHourRailWidth = 54;
const scheduleHourLineOpacity = 0.12;

export default function SavedScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const [activeTab, setActiveTab] = useState<SavedTab>("events");
  const [scheduleRange, setScheduleRange] = useState<ScheduleRange>("1day");
  const [selectedCampHost, setSelectedCampHost] = useState<string | undefined>();
  const [calendarExportError, setCalendarExportError] = useState<string | null>(null);
  const saved = useSavedEvents();
  const savedCampEvents = saved.savedCampEvents;
  const allEvents = useMemo(() => getAllEvents(), []);
  const events = saved.savedEvents(allEvents);
  const days = getScheduleDays();
  const eventGroups = useMemo(() => groupSavedEventsByDay(events, days), [days, events]);
  const savedCamps = useMemo(
    () => [...saved.savedCamps].sort((a, b) => a.campHost.localeCompare(b.campHost)),
    [saved.savedCamps]
  );
  const selectedSavedCamp = useMemo(
    () => savedCamps.find((savedCamp) => savedCamp.campHost === selectedCampHost),
    [savedCamps, selectedCampHost]
  );
  const selectedCampEvents = useMemo(
    () => (selectedCampHost ? savedCampEvents(selectedCampHost, allEvents) : []),
    [allEvents, savedCampEvents, selectedCampHost]
  );
  const selectedCampEventGroups = useMemo(
    () => groupSavedEventsByDay(selectedCampEvents, days),
    [days, selectedCampEvents]
  );

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
      if (context?.route !== "saved") {
        return;
      }

      const timeout = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: context.scrollY, animated: false });
        clearReturnContext();
      }, 0);

      return () => clearTimeout(timeout);
    }, [])
  );

  function captureReturnContext() {
    setReturnContext({ route: "saved", scrollY: scrollYRef.current });
  }

  function showEventsTab() {
    setActiveTab("events");
    setSelectedCampHost(undefined);
  }

  function showCampsTab() {
    setActiveTab("camps");
    setSelectedCampHost(undefined);
  }

  function showScheduleTab() {
    setActiveTab("schedule");
    setSelectedCampHost(undefined);
  }

  function openSavedCamp(campHost: string) {
    setSelectedCampHost(campHost);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }

  function removeSelectedCamp() {
    if (!selectedCampHost) {
      return;
    }

    saved.toggleSavedCamp(selectedCampHost);
    setSelectedCampHost(undefined);
  }

  function exportSavedDay(group: SavedEventDayGroup) {
    try {
      exportEventsAsCalendarFile(group.events, {
        fileNameBase: createSavedDayFileName(group.label)
      });
      setCalendarExportError(null);
    } catch (error) {
      setCalendarExportError(error instanceof Error ? error.message : "Calendar export failed.");
    }
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
      <View style={styles.header}>
        <Text style={styles.title}>Saved</Text>
        <Text style={styles.subtitle}>
          {saved.isHydrating
            ? "Loading saved items..."
            : `${events.length} events and ${savedCamps.length} camps saved locally.`}
        </Text>
      </View>

      {saved.storageError ? <Text style={styles.warning}>{saved.storageError}</Text> : null}
      {calendarExportError ? <Text style={styles.warning}>{calendarExportError}</Text> : null}
      <UndoNotice label={saved.undoLabel} onUndo={saved.undoLastAction} />

      <View style={styles.segmented}>
        <Pressable
          accessibilityRole="button"
          onPress={showEventsTab}
          style={[styles.segmentButton, activeTab === "events" && styles.segmentButtonActive]}
        >
          <Text style={[styles.segmentText, activeTab === "events" && styles.segmentTextActive]}>Events</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={showCampsTab}
          style={[styles.segmentButton, activeTab === "camps" && styles.segmentButtonActive]}
        >
          <Text style={[styles.segmentText, activeTab === "camps" && styles.segmentTextActive]}>Camps</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={showScheduleTab}
          style={[styles.segmentButton, activeTab === "schedule" && styles.segmentButtonActive]}
        >
          <Text style={[styles.segmentText, activeTab === "schedule" && styles.segmentTextActive]}>Schedule</Text>
        </Pressable>
      </View>

      {activeTab === "events" ? (
        <View style={styles.list}>
          {events.length === 0 ? (
            <EmptyState
              title="No saved events yet"
              body="Save events or save camps with all their events to build a local plan for the festival."
            />
          ) : (
            eventGroups.map((group) => (
              <View key={group.dayId} style={styles.dayGroup}>
                <SavedDayDivider
                  canExport={group.events.length > 0}
                  label={group.label}
                  onExport={() => exportSavedDay(group)}
                />
                {group.events.map((event) => (
                  <EventCard
                    event={event}
                    isSaved={saved.isSaved(event.id)}
                    key={event.id}
                    onBeforeNavigate={captureReturnContext}
                    onToggleSaved={saved.toggleSaved}
                  />
                ))}
              </View>
            ))
          )}
        </View>
      ) : activeTab === "schedule" ? (
        <SavedScheduleView
          days={days}
          events={events}
          onBeforeNavigate={captureReturnContext}
          onRangeChange={setScheduleRange}
          range={scheduleRange}
        />
      ) : selectedCampHost ? (
        <View style={styles.campDetail}>
          <View style={styles.campDetailHeader}>
            <Pressable accessibilityRole="button" onPress={() => setSelectedCampHost(undefined)} style={styles.backButton}>
              <Text style={styles.backButtonText}>Back to saved camps</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={removeSelectedCamp}
              style={styles.removeCampButton}
            >
              <Text style={styles.removeCampButtonText}>Remove camp</Text>
            </Pressable>
          </View>
          <Text style={styles.campTitle}>{selectedCampHost}</Text>
          <Text style={styles.campStatus}>
            {selectedSavedCamp?.includeEvents ? "Camp + events saved" : "Camp saved for directory only"}
          </Text>
          <View style={styles.list}>
            {selectedSavedCamp?.includeEvents ? (
              selectedCampEventGroups.map((group) => (
                <View key={group.dayId} style={styles.dayGroup}>
                  <SavedDayDivider
                    canExport={group.events.length > 0}
                    label={group.label}
                    onExport={() => exportSavedDay(group)}
                  />
                  {group.events.map((event) => (
                    <EventCard
                      event={event}
                      isSaved={saved.isSaved(event.id)}
                      key={event.id}
                      onBeforeNavigate={captureReturnContext}
                      onToggleSaved={saved.toggleSaved}
                    />
                  ))}
                </View>
              ))
            ) : (
              <EmptyState
                title="No camp events included"
                body="This camp is saved for directory/following only, so its events are not added to Saved Events or Schedule."
              />
            )}
          </View>
        </View>
      ) : (
        <View style={styles.list}>
          {savedCamps.length === 0 ? (
            <EmptyState
              title="No saved camps yet"
              body="Save camps from the Camps view to follow them, with or without adding all their events."
            />
          ) : (
            savedCamps.map((savedCamp) => (
              <Pressable
                accessibilityRole="button"
                key={savedCamp.campHost}
                onPress={() => openSavedCamp(savedCamp.campHost)}
                style={styles.campRow}
              >
                <Text style={styles.campRowTitle}>{savedCamp.campHost}</Text>
                <Text style={styles.campRowMeta}>{getSavedCampLabel(savedCamp)}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}
      <AppFooter />
    </ScrollView>
  );
}

function SavedScheduleView({
  days,
  events,
  onBeforeNavigate,
  onRangeChange,
  range
}: {
  days: FestivalDay[];
  events: FestivalEvent[];
  onBeforeNavigate: () => void;
  onRangeChange: (range: ScheduleRange) => void;
  range: ScheduleRange;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 520;
  const now = new Date();
  const validScheduleDays = useMemo(() => days.filter(isValidScheduleDay), [days]);
  const [scheduleStartDayIndex, setScheduleStartDayIndex] = useState(() =>
    getDefaultScheduleStartDayIndex(days, new Date())
  );
  const maxStartDayIndex = getMaxScheduleStartDayIndex(validScheduleDays.length, range);
  const defaultScheduleStartDayIndex = getDefaultScheduleStartDayIndex(validScheduleDays, now);
  const clampedDefaultScheduleStartDayIndex = clampNumber(defaultScheduleStartDayIndex, 0, maxStartDayIndex);
  const clampedStartDayIndex = clampNumber(scheduleStartDayIndex, 0, maxStartDayIndex);
  const scheduleDays = getDisplayedScheduleDays(days, events, range, clampedStartDayIndex);
  const canNavigateScheduleDays = range !== "week" && validScheduleDays.length > 1;
  const canGoToPreviousScheduleDay = canNavigateScheduleDays && clampedStartDayIndex > 0;
  const canGoToNextScheduleDay = canNavigateScheduleDays && clampedStartDayIndex < maxStartDayIndex;
  const isShowingDefaultScheduleDay = clampedStartDayIndex === clampedDefaultScheduleStartDayIndex;

  useEffect(() => {
    if (scheduleStartDayIndex !== clampedStartDayIndex) {
      setScheduleStartDayIndex(clampedStartDayIndex);
    }
  }, [clampedStartDayIndex, scheduleStartDayIndex]);

  function changeScheduleRange(nextRange: ScheduleRange) {
    setScheduleStartDayIndex((currentIndex) =>
      clampNumber(currentIndex, 0, getMaxScheduleStartDayIndex(validScheduleDays.length, nextRange))
    );
    onRangeChange(nextRange);
  }

  function showPreviousScheduleDayWindow() {
    const navigationStep = getScheduleWindowNavigationStep(range);
    setScheduleStartDayIndex((currentIndex) => clampNumber(currentIndex - navigationStep, 0, maxStartDayIndex));
  }

  function showNextScheduleDayWindow() {
    const navigationStep = getScheduleWindowNavigationStep(range);
    setScheduleStartDayIndex((currentIndex) => clampNumber(currentIndex + navigationStep, 0, maxStartDayIndex));
  }

  function showDefaultScheduleDayWindow() {
    setScheduleStartDayIndex(clampedDefaultScheduleStartDayIndex);
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="No saved schedule yet"
        body="Saved events and events from camps saved with all their events will appear in your visual schedule."
      />
    );
  }

  return (
    <View style={styles.schedule}>
      <View style={styles.rangePills}>
        {scheduleRanges.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => changeScheduleRange(option.value)}
            style={StyleSheet.flatten([
              styles.rangePill,
              range === option.value ? styles.rangePillActive : null
            ])}
          >
            <Text
              style={StyleSheet.flatten([
                styles.rangePillText,
                range === option.value ? styles.rangePillTextActive : null
              ])}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {canNavigateScheduleDays ? (
        <View style={styles.scheduleDayControls}>
          <Pressable
            accessibilityRole="button"
            disabled={!canGoToPreviousScheduleDay}
            onPress={showPreviousScheduleDayWindow}
            style={StyleSheet.flatten([
              styles.rangePill,
              styles.scheduleDayControlButton,
              !canGoToPreviousScheduleDay ? styles.scheduleDayControlButtonDisabled : null
            ])}
          >
            <Text
              style={StyleSheet.flatten([
                styles.rangePillText,
                !canGoToPreviousScheduleDay ? styles.scheduleDayControlTextDisabled : null
              ])}
            >
              Previous
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isShowingDefaultScheduleDay}
            onPress={showDefaultScheduleDayWindow}
            style={StyleSheet.flatten([
              styles.rangePill,
              styles.scheduleDayControlButton,
              styles.scheduleTodayButton,
              isShowingDefaultScheduleDay ? styles.scheduleDayControlButtonDisabled : null
            ])}
          >
            <Text
              style={StyleSheet.flatten([
                styles.rangePillText,
                isShowingDefaultScheduleDay ? styles.scheduleDayControlTextDisabled : null
              ])}
            >
              TODAY
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!canGoToNextScheduleDay}
            onPress={showNextScheduleDayWindow}
            style={StyleSheet.flatten([
              styles.rangePill,
              styles.scheduleDayControlButton,
              !canGoToNextScheduleDay ? styles.scheduleDayControlButtonDisabled : null
            ])}
          >
            <Text
              style={StyleSheet.flatten([
                styles.rangePillText,
                !canGoToNextScheduleDay ? styles.scheduleDayControlTextDisabled : null
              ])}
            >
              Next
            </Text>
          </Pressable>
        </View>
      ) : null}

      {scheduleDays.length === 0 ? (
        <EmptyState
          title="No saved schedule available"
          body="Saved items are present, but none match a valid festival schedule day."
        />
      ) : range === "3days" || range === "week" ? (
        <MultiDayScheduleView
          days={scheduleDays}
          isCompact={isCompact}
          now={now}
          onOpenEvent={(eventId) => {
            onBeforeNavigate();
            const event = getEventById(eventId);
            if (event) {
              router.push(getEventHref(event));
            }
          }}
        />
      ) : (
        <View style={styles.scheduleDays}>
          {scheduleDays.map((group) => (
            <ScheduleDaySection
              day={group.day}
              events={group.events}
              key={group.day.id}
              isCompact={isCompact}
              now={now}
              onBeforeNavigate={onBeforeNavigate}
              onOpenEvent={(eventId) => {
                onBeforeNavigate();
                const event = getEventById(eventId);
                if (event) {
                  router.push(getEventHref(event));
                }
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function getSavedCampLabel(savedCamp: SavedCampState) {
  return savedCamp.includeEvents ? "Camp + events" : "Camp only";
}

function ScheduleDaySection({
  day,
  events,
  isCompact,
  now,
  onBeforeNavigate,
  onOpenEvent
}: {
  day?: FestivalDay;
  events: FestivalEvent[];
  isCompact: boolean;
  now: Date;
  onBeforeNavigate: () => void;
  onOpenEvent: (eventId: string) => void;
}) {
  if (!isValidScheduleDay(day)) {
    return null;
  }

  const layout = getScheduleTimeline(events, isCompact);
  const currentGuide = getCurrentTimeGuide(day, layout, now);

  return (
    <View style={styles.scheduleDay}>
      <View style={styles.scheduleDayHeader}>
        <Text style={styles.scheduleDayTitle}>{shortDayLabel(day.label)}</Text>
        <Text style={styles.scheduleDayMeta}>
          {events.length === 0 ? "No saved events" : `${events.length} saved ${events.length === 1 ? "event" : "events"}`}
        </Text>
      </View>

      {layout.rows.length === 0 ? (
        <Text style={styles.scheduleEmptyDay}>No saved events in this range.</Text>
      ) : (
        <View style={StyleSheet.flatten([styles.timeline, { minHeight: layout.timelineHeight }])}>
          <View style={styles.timelineRails}>
            <View style={styles.timelineRailLeft}>
          {layout.ticks.map((tick) => (
            <Text
              key={`left-${tick.time}`}
              style={StyleSheet.flatten([styles.timelineHourLabel, styles.timelineHourLabelLeft, { top: tick.top }])}
            >
              {tick.label}
            </Text>
          ))}
            </View>
            <View style={styles.timelineEventArea}>
              {layout.ticks.map((tick) => (
                <View
                  key={`line-${tick.time}`}
                  pointerEvents="none"
                  style={StyleSheet.flatten([styles.timelineHourLine, { top: tick.top }])}
                />
              ))}
              {layout.rows.map((row, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={row.event.id}
                  onPress={() => onOpenEvent(row.event.id)}
                  style={StyleSheet.flatten([
                    styles.scheduleBlock,
                    scheduleBlockStyles[index % scheduleBlockStyles.length],
                    {
                      left: `${getSafeStyleNumber(row.leftPercent)}%`,
                      minHeight: getSafeStyleNumber(row.height, minScheduleBlockHeight),
                      top: getSafeStyleNumber(row.top),
                      width: `${getSafeStyleNumber(row.widthPercent, 100)}%`
                    }
                  ])}
                >
                  <Text style={styles.scheduleBlockTitle} numberOfLines={2}>
                    {row.event.title}
                  </Text>
                  {row.event.host ? (
                    <Text style={styles.scheduleBlockHost} numberOfLines={1}>
                      {row.event.host}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
              {currentGuide ? <CurrentTimeGuide top={currentGuide.top} /> : null}
            </View>
            <View style={styles.timelineRailRight}>
              {layout.ticks.map((tick) => (
                <Text
                  key={`right-${tick.time}`}
                  style={StyleSheet.flatten([styles.timelineHourLabel, styles.timelineHourLabelRight, { top: tick.top }])}
                >
                  {tick.label}
                </Text>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function MultiDayScheduleView({
  days,
  isCompact,
  now,
  onOpenEvent
}: {
  days: ScheduleDayGroup[];
  isCompact: boolean;
  now: Date;
  onOpenEvent: (eventId: string) => void;
}) {
  const { width } = useWindowDimensions();
  const availableWidth = Math.max(0, Math.min(width - theme.spacing.screenX * 2, 760));
  const minColumnWidth = days.length > 3 && availableWidth >= 640 ? 48 : days.length > 3 ? 82 : 150;
  const columnWidth = Math.max(minColumnWidth, Math.floor((availableWidth - scheduleHourRailWidth) / days.length));
  const contentWidth = scheduleHourRailWidth + columnWidth * days.length;
  const visibleEvents = days.flatMap((group) => group.events);
  const sharedTimeBounds = getTimelineTimeBounds(visibleEvents);
  const shouldStackOverlaps = days.length > 3 && columnWidth < 100;
  const isDense = days.length > 3;

  if (!sharedTimeBounds) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={StyleSheet.flatten([styles.threeDayScrollContent, { minWidth: contentWidth }])}
      >
        <View style={StyleSheet.flatten([styles.threeDayTimeline, { width: contentWidth }])}>
          <View style={styles.threeDayHeaderRow}>
            <View style={styles.threeDayRailSpacer} />
            {days.map((group) => (
              <View
                key={group.day.id}
                style={StyleSheet.flatten([
                  styles.threeDayColumnHeader,
                  isDense ? styles.multiDayDenseColumnHeader : null,
                  { width: columnWidth }
                ])}
              >
                <Text style={StyleSheet.flatten([styles.threeDayColumnTitle, isDense ? styles.multiDayDenseColumnTitle : null])}>
                  {shortDayLabel(group.day.label)}
                </Text>
                <Text style={StyleSheet.flatten([styles.threeDayColumnMeta, isDense ? styles.multiDayDenseColumnMeta : null])}>
                  No saved events
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.threeDayEmptyRow}>
            <View style={styles.threeDayRailSpacer} />
            {days.map((group) => (
              <View
                key={group.day.id}
                style={StyleSheet.flatten([
                  styles.threeDayEmptyColumn,
                  isDense ? styles.multiDayDenseEmptyColumn : null,
                  { width: columnWidth }
                ])}
              >
                <Text style={styles.scheduleEmptyDay}>No saved events in this range.</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  const timelines = days.map((group) =>
    getScheduleTimeline(group.events, isCompact, getTimelineBoundsForDay(group.day, sharedTimeBounds), shouldStackOverlaps)
  );
  const timelineHeight = Math.max(minTimelineHeight, ...timelines.map((timeline) => timeline.timelineHeight));
  const ticks = timelines[0]?.ticks ?? [];
  const currentDayId = toLocalDateString(now);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={StyleSheet.flatten([styles.threeDayScrollContent, { minWidth: contentWidth }])}
    >
      <View style={StyleSheet.flatten([styles.threeDayTimeline, { minHeight: timelineHeight, width: contentWidth }])}>
        <View style={styles.threeDayHeaderRow}>
          <View style={styles.threeDayRailSpacer} />
          {days.map((group) => (
            <View
              key={group.day.id}
              style={StyleSheet.flatten([
                styles.threeDayColumnHeader,
                isDense ? styles.multiDayDenseColumnHeader : null,
                { width: columnWidth }
              ])}
            >
              <Text style={StyleSheet.flatten([styles.threeDayColumnTitle, isDense ? styles.multiDayDenseColumnTitle : null])}>
                {shortDayLabel(group.day.label)}
              </Text>
              <Text style={StyleSheet.flatten([styles.threeDayColumnMeta, isDense ? styles.multiDayDenseColumnMeta : null])}>
                {group.events.length === 0 ? "No saved events" : `${group.events.length} saved`}
              </Text>
            </View>
          ))}
        </View>

        <View style={StyleSheet.flatten([styles.timelineRails, { minHeight: timelineHeight }])}>
          <View style={styles.timelineRailLeft}>
            {ticks.map((tick) => (
              <Text
                key={`three-day-left-${tick.time}`}
                style={StyleSheet.flatten([styles.timelineHourLabel, styles.timelineHourLabelLeft, { top: tick.top }])}
              >
                {tick.label}
              </Text>
            ))}
          </View>

          {days.map((group, index) => {
            const timeline = timelines[index];
            const isCurrentDay = group.day.date === currentDayId;
            const currentGuide = isCurrentDay ? getCurrentTimeGuide(group.day, timeline, now) : undefined;

            return (
              <View
                key={group.day.id}
                style={StyleSheet.flatten([
                  styles.threeDayColumn,
                  isDense ? styles.multiDayDenseColumn : null,
                  {
                    minHeight: timelineHeight,
                    width: columnWidth
                  }
                ])}
              >
                <View style={styles.threeDayColumnBody}>
                  {ticks.map((tick) => (
                    <View
                      key={`three-day-line-${group.day.id}-${tick.time}`}
                      pointerEvents="none"
                      style={StyleSheet.flatten([styles.timelineHourLine, { top: tick.top }])}
                    />
                  ))}
                  {timeline.rows.map((row, rowIndex) => (
                    <Pressable
                      accessibilityRole="button"
                      key={row.event.id}
                      onPress={() => onOpenEvent(row.event.id)}
                      style={StyleSheet.flatten([
                        styles.scheduleBlock,
                        styles.threeDayScheduleBlock,
                        isDense ? styles.multiDayDenseScheduleBlock : null,
                        scheduleBlockStyles[rowIndex % scheduleBlockStyles.length],
                        {
                          left: `${getSafeStyleNumber(row.leftPercent)}%`,
                          minHeight: getSafeStyleNumber(row.height, minScheduleBlockHeight),
                          top: getSafeStyleNumber(row.top),
                          width: `${getSafeStyleNumber(row.widthPercent, 100)}%`
                        }
                      ])}
                    >
                      <Text
                        style={StyleSheet.flatten([
                          styles.threeDayScheduleBlockTitle,
                          isDense ? styles.multiDayDenseScheduleBlockTitle : null
                        ])}
                        numberOfLines={isDense ? 3 : 2}
                      >
                        {row.event.title}
                      </Text>
                      {row.event.host ? (
                        <Text
                          style={StyleSheet.flatten([
                            styles.threeDayScheduleBlockHost,
                            isDense ? styles.multiDayDenseScheduleBlockHost : null
                          ])}
                          numberOfLines={1}
                        >
                          {row.event.host}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                  {currentGuide ? <CurrentTimeGuide top={currentGuide.top} /> : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function CurrentTimeGuide({ top }: { top: number }) {
  const safeTop = getSafeStyleNumber(top);

  return (
    <View pointerEvents="none" style={StyleSheet.flatten([styles.currentTimeGuide, { top: safeTop }])}>
      <View style={styles.currentTimeDot} />
      <View style={styles.currentTimeLine} />
    </View>
  );
}

function SavedDayDivider({
  canExport,
  label,
  onExport
}: {
  canExport: boolean;
  label: string;
  onExport?: () => void;
}) {
  return (
    <View style={styles.dayDivider}>
      <View style={styles.dayDividerLabelRow}>
        <View style={styles.dayDividerLine} />
        <Text style={styles.dayDividerText}>{shortDayLabel(label).split(/\s+/)[0]}</Text>
        <View style={styles.dayDividerLine} />
      </View>
      {onExport ? (
        <Pressable
          accessibilityRole="button"
          disabled={!canExport}
          onPress={onExport}
          style={[styles.dayExportButton, !canExport && styles.dayExportButtonDisabled]}
        >
          <Text style={[styles.dayExportButtonText, !canExport && styles.dayExportButtonTextDisabled]}>Export .ics</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createSavedDayFileName(label: string): string {
  const safeLabel = shortDayLabel(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return safeLabel ? `jomo-${safeLabel}-saved-events` : "jomo-saved-events";
}

function getDisplayedScheduleDays(
  days: FestivalDay[],
  events: FestivalEvent[],
  range: ScheduleRange,
  startDayIndex: number
): ScheduleDayGroup[] {
  const validDays = days.filter(isValidScheduleDay);
  if (validDays.length === 0) {
    return [];
  }

  if (range === "week") {
    return validDays.map((day) => ({
      day,
      events: getEventsForScheduleDay(events, day.id)
    }));
  }

  const dayCount = range === "1day" ? 1 : 3;
  const startIndex = clampNumber(startDayIndex, 0, getMaxScheduleStartDayIndex(validDays.length, range));

  return validDays.slice(startIndex, startIndex + dayCount).map((day) => ({
    day,
    events: getEventsForScheduleDay(events, day.id)
  }));
}

function getDefaultScheduleStartDayIndex(days: FestivalDay[], now: Date): number {
  const validDays = days.filter(isValidScheduleDay);
  const today = toLocalDateString(now);
  const todayIndex = validDays.findIndex((day) => day.date === today);

  return Math.max(todayIndex, 0);
}

function getScheduleWindowNavigationStep(range: ScheduleRange): number {
  if (range === "week") {
    return 0;
  }

  return 1;
}

function getMaxScheduleStartDayIndex(dayCount: number, range: ScheduleRange): number {
  if (range === "week") {
    return 0;
  }

  const visibleDayCount = range === "1day" ? 1 : 3;
  return Math.max(0, dayCount - visibleDayCount);
}

function groupSavedEventsByDay(events: FestivalEvent[], days: ReturnType<typeof getScheduleDays>): SavedEventDayGroup[] {
  const daysById = new Map(days.map((day) => [day.id, day]));
  const groups = new Map<string, FestivalEvent[]>();

  for (const event of events) {
    groups.set(event.dayId, [...(groups.get(event.dayId) ?? []), event]);
  }

  return Array.from(groups.entries()).map(([dayId, groupEvents]) => ({
    dayId,
    events: groupEvents,
    label: daysById.get(dayId)?.label ?? groupEvents[0]?.date ?? dayId
  }));
}

function getEventsForScheduleDay(events: FestivalEvent[], dayId: string): FestivalEvent[] {
  return events
    .filter((event) => event.dayId === dayId && getEventTimeBounds(event))
    .sort((a, b) => {
      const aBounds = getEventTimeBounds(a);
      const bBounds = getEventTimeBounds(b);

      return (aBounds?.start ?? 0) - (bBounds?.start ?? 0) || a.title.localeCompare(b.title);
    });
}

function getScheduleTimeline(
  events: FestivalEvent[],
  isCompact: boolean,
  bounds?: TimelineBounds,
  shouldStackOverlaps = false
): ScheduleTimeline {
  const timedEvents = events
    .map((event) => {
      const eventBounds = getEventTimeBounds(event);
      return eventBounds ? { event, ...eventBounds } : undefined;
    })
    .filter(isDefined)
    .sort((a, b) => a.start - b.start || a.end - b.end || a.event.title.localeCompare(b.event.title));

  const sharedDayStart = bounds?.dayStart ?? floorToHour(Math.min(...timedEvents.map((row) => row.start)));
  const sharedDayEnd = bounds?.dayEnd ?? ceilToHour(Math.max(...timedEvents.map((row) => row.end)));

  if (!isFiniteNumber(sharedDayStart) || !isFiniteNumber(sharedDayEnd) || sharedDayEnd <= sharedDayStart) {
    return emptyScheduleTimeline();
  }

  const ticks = buildHourlyTicks(sharedDayStart, sharedDayEnd);

  if (timedEvents.length === 0) {
    const emptyHeight = Math.max(minTimelineHeight, ((sharedDayEnd - sharedDayStart) / minuteMs) * scheduleMinuteHeight);

    return {
      dayEnd: sharedDayEnd,
      dayStart: sharedDayStart,
      rows: [],
      ticks,
      timelineHeight: getSafeStyleNumber(emptyHeight, minTimelineHeight)
    };
  }

  const rows = assignTimelineRows(timedEvents, sharedDayStart, isCompact, shouldStackOverlaps);
  const timelineHeight = Math.max(
    minTimelineHeight,
    ...rows.map((row) => row.top + row.height),
    ((sharedDayEnd - sharedDayStart) / minuteMs) * scheduleMinuteHeight
  );

  return {
    dayEnd: sharedDayEnd,
    dayStart: sharedDayStart,
    rows,
    ticks,
    timelineHeight: getSafeStyleNumber(timelineHeight, minTimelineHeight)
  };
}

function getTimelineTimeBounds(events: FestivalEvent[]): TimelineTimeBounds | undefined {
  const timedEvents = events
    .map((event) => {
      const bounds = getEventTimeBounds(event);
      return bounds ? getEventMinuteBounds(bounds.start, bounds.end) : undefined;
    })
    .filter(isDefined);

  if (timedEvents.length === 0) {
    return undefined;
  }

  const startMinute = floorToHourMinute(Math.min(...timedEvents.map((row) => row.startMinute)));
  const endMinute = ceilToHourMinute(Math.max(...timedEvents.map((row) => row.endMinute)));

  if (!isFiniteNumber(startMinute) || !isFiniteNumber(endMinute) || endMinute <= startMinute) {
    return undefined;
  }

  return { endMinute, startMinute };
}

function getTimelineBoundsForDay(day: FestivalDay, bounds: TimelineTimeBounds): TimelineBounds | undefined {
  const dayStart = getLocalDayMinuteTime(day.date, bounds.startMinute);
  const dayEnd = getLocalDayMinuteTime(day.date, bounds.endMinute);

  if (!isFiniteNumber(dayStart) || !isFiniteNumber(dayEnd) || dayEnd <= dayStart) {
    return undefined;
  }

  return { dayEnd, dayStart };
}

function getEventMinuteBounds(start: number, end: number): TimelineTimeBounds | undefined {
  if (!isFiniteNumber(start) || !isFiniteNumber(end) || end <= start) {
    return undefined;
  }

  const localDayStart = new Date(start);
  localDayStart.setHours(0, 0, 0, 0);
  const startMinute = (start - localDayStart.getTime()) / minuteMs;
  const endMinute = startMinute + (end - start) / minuteMs;

  if (!isFiniteNumber(startMinute) || !isFiniteNumber(endMinute) || endMinute <= startMinute) {
    return undefined;
  }

  return { endMinute, startMinute };
}

function getCurrentTimeGuide(day: FestivalDay, layout: ScheduleTimeline, now: Date): { top: number } | undefined {
  if (!isValidScheduleDay(day) || day.date !== toLocalDateString(now)) {
    return undefined;
  }

  const nowTime = now.getTime();
  if (!isFiniteNumber(nowTime)) {
    return undefined;
  }

  if (!isFiniteNumber(layout.dayStart) || !isFiniteNumber(layout.dayEnd) || layout.dayEnd <= layout.dayStart) {
    return undefined;
  }

  if (nowTime < layout.dayStart || nowTime > layout.dayEnd) {
    return undefined;
  }

  const top = ((nowTime - layout.dayStart) / minuteMs) * scheduleMinuteHeight;
  return isFiniteNumber(top) && top >= 0 ? { top } : undefined;
}

function shortDayLabel(label: string): string {
  return label.replace(" 2026", "").replace(" (build)", "").replace(" (strike)", "");
}

function getEventTimeBounds(event: FestivalEvent): { start: number; end: number } | undefined {
  if (!isDefinedString(event.time?.start) || !isDefinedString(event.time?.end)) {
    return undefined;
  }

  try {
    const start = getEventStartTime(event);
    const end = getEventEndTime(event);

    if (!isFiniteNumber(start) || !isFiniteNumber(end) || end <= start) {
      return undefined;
    }

    return { start, end };
  } catch {
    return undefined;
  }
}

function getSafeStyleNumber(value: number, fallback = 0): number {
  return isFiniteNumber(value) && value >= 0 ? value : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function emptyScheduleTimeline(): ScheduleTimeline {
  return {
    dayEnd: Number.NaN,
    dayStart: Number.NaN,
    rows: [],
    ticks: [],
    timelineHeight: 0
  };
}

function buildHourlyTicks(dayStart: number, dayEnd: number): ScheduleTick[] {
  if (!isFiniteNumber(dayStart) || !isFiniteNumber(dayEnd) || dayEnd <= dayStart) {
    return [];
  }

  const ticks: ScheduleTick[] = [];
  for (let time = dayStart; time <= dayEnd; time += 60 * minuteMs) {
    ticks.push({
      label: formatHourLabel(time),
      time,
      top: ((time - dayStart) / minuteMs) * scheduleMinuteHeight
    });
  }

  return ticks;
}

function formatHourLabel(time: number): string {
  if (!isFiniteNumber(time)) {
    return "";
  }

  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, "0")}:00`;
}

function assignTimelineRows(
  events: { event: FestivalEvent; start: number; end: number }[],
  dayStart: number,
  isCompact: boolean,
  shouldStackOverlaps = false
): ScheduleRow[] {
  const groups: { event: FestivalEvent; start: number; end: number }[][] = [];
  let currentGroup: { event: FestivalEvent; start: number; end: number }[] = [];
  let currentGroupEnd = Number.NaN;

  for (const row of events) {
    if (currentGroup.length === 0) {
      currentGroup = [row];
      currentGroupEnd = row.end;
      continue;
    }

    if (row.start < currentGroupEnd) {
      currentGroup.push(row);
      currentGroupEnd = Math.max(currentGroupEnd, row.end);
      continue;
    }

    groups.push(currentGroup);
    currentGroup = [row];
    currentGroupEnd = row.end;
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  const rows: ScheduleRow[] = [];
  const columnBottoms: number[] = [];

  for (const group of groups) {
    const placed = shouldStackOverlaps ? stackTimelineGroup(group) : placeTimelineGroup(group);
    const groupColumnCount = Math.max(1, ...placed.map((row) => row.columnCount));
    const columnGap = isCompact ? 1 : 2;
    const widthPercent = (100 - columnGap * (groupColumnCount - 1)) / groupColumnCount;

    for (const row of placed) {
      const rawTop = ((row.start - dayStart) / minuteMs) * scheduleMinuteHeight;
      const rawHeight = Math.max(minScheduleBlockHeight, ((row.end - row.start) / minuteMs) * scheduleMinuteHeight);
      const resolvedTop = Math.max(rawTop, columnBottoms[row.columnIndex] ?? 0);
      const renderedHeight = rawHeight;

      rows.push({
        ...row,
        columnCount: groupColumnCount,
        height: renderedHeight,
        leftPercent: row.columnIndex * (widthPercent + columnGap),
        top: resolvedTop,
        widthPercent
      });

      columnBottoms[row.columnIndex] = resolvedTop + renderedHeight;
    }
  }

  return rows;
}

function placeTimelineGroup(
  group: { event: FestivalEvent; start: number; end: number }[]
): { columnCount: number; columnIndex: number; end: number; event: FestivalEvent; height: number; start: number }[] {
  const activeColumns: number[] = [];
  const placed: {
    columnCount: number;
    columnIndex: number;
    end: number;
    event: FestivalEvent;
    height: number;
    start: number;
  }[] = [];

  for (const row of [...group].sort((a, b) => a.start - b.start || a.end - b.end || a.event.title.localeCompare(b.event.title))) {
    let columnIndex = activeColumns.findIndex((columnEnd) => columnEnd <= row.start);
    if (columnIndex < 0) {
      columnIndex = activeColumns.length;
      activeColumns.push(row.end);
    } else {
      activeColumns[columnIndex] = row.end;
    }

    placed.push({
      columnCount: 0,
      columnIndex,
      end: row.end,
      event: row.event,
      height: 0,
      start: row.start
    });
  }

  const columnCount = Math.max(1, activeColumns.length);

  return placed.map((row) => ({
    ...row,
    columnCount
  }));
}

function stackTimelineGroup(
  group: { event: FestivalEvent; start: number; end: number }[]
): { columnCount: number; columnIndex: number; end: number; event: FestivalEvent; height: number; start: number }[] {
  return [...group]
    .sort((a, b) => a.start - b.start || a.end - b.end || a.event.title.localeCompare(b.event.title))
    .map((row) => ({
      columnCount: 1,
      columnIndex: 0,
      end: row.end,
      event: row.event,
      height: 0,
      start: row.start
    }));
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isDefinedString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function isValidScheduleDay(day: FestivalDay | undefined): day is FestivalDay {
  return Boolean(day && isDefinedString(day.id) && isDefinedString(day.date) && isDefinedString(day.label));
}

function floorToHour(time: number): number {
  if (!isFiniteNumber(time)) {
    return Number.NaN;
  }

  const date = new Date(time);
  date.setMinutes(0, 0, 0);

  return date.getTime();
}

function floorToHourMinute(minute: number): number {
  return isFiniteNumber(minute) ? Math.floor(minute / 60) * 60 : Number.NaN;
}

function ceilToHour(time: number): number {
  if (!isFiniteNumber(time)) {
    return Number.NaN;
  }

  const date = new Date(time);
  date.setMinutes(0, 0, 0);

  if (date.getTime() < time) {
    date.setHours(date.getHours() + 1);
  }

  return date.getTime();
}

function ceilToHourMinute(minute: number): number {
  return isFiniteNumber(minute) ? Math.ceil(minute / 60) * 60 : Number.NaN;
}

function getLocalDayMinuteTime(dayDate: string, minute: number): number {
  const parts = dayDate.split("-").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    return Number.NaN;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  date.setHours(0, minute, 0, 0);

  return date.getTime();
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  campDetail: {
    gap: 12
  },
  campDetailHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  campRow: {
    alignItems: "center",
    backgroundColor: theme.surfaces.card,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  campRowMeta: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  campRowTitle: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 0
  },
  campTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "900"
  },
  campStatus: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "800"
  },
  content: {
    gap: 18,
    marginHorizontal: "auto",
    maxWidth: 760,
    padding: theme.spacing.screenX,
    paddingBottom: theme.spacing.bottomNavPadding,
    width: "100%"
  },
  currentTimeDot: {
    backgroundColor: theme.colors.brand,
    borderRadius: 4,
    height: 8,
    opacity: 0.45,
    width: 8
  },
  currentTimeGuide: {
    alignItems: "center",
    flexDirection: "row",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 0
  },
  currentTimeLine: {
    backgroundColor: theme.colors.brand,
    flex: 1,
    height: 1,
    opacity: 0.22
  },
  dayDivider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingVertical: 4
  },
  dayDividerLabelRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0
  },
  dayDividerLine: {
    backgroundColor: theme.colors.borderSoft,
    flex: 1,
    height: 1,
    opacity: 0.7
  },
  dayDividerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  dayExportButton: {
    alignItems: "center",
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  dayExportButtonDisabled: {
    opacity: 0.42
  },
  dayExportButtonText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "900"
  },
  dayExportButtonTextDisabled: {
    color: theme.colors.textMuted
  },
  dayGroup: {
    gap: 12
  },
  header: {
    gap: 4
  },
  list: {
    gap: 12
  },
  multiDayDenseColumn: {
    paddingLeft: 3,
    paddingRight: 2
  },
  multiDayDenseColumnHeader: {
    paddingHorizontal: 3
  },
  multiDayDenseColumnMeta: {
    fontSize: 8,
    lineHeight: 10
  },
  multiDayDenseColumnTitle: {
    fontSize: 9,
    lineHeight: 11
  },
  multiDayDenseEmptyColumn: {
    paddingHorizontal: 4
  },
  multiDayDenseScheduleBlock: {
    borderLeftWidth: 3,
    paddingHorizontal: 3,
    paddingVertical: 4
  },
  multiDayDenseScheduleBlockHost: {
    fontSize: 8,
    lineHeight: 10
  },
  multiDayDenseScheduleBlockTitle: {
    fontSize: 9,
    lineHeight: 11
  },
  rangePill: {
    alignItems: "center",
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  rangePillActive: {
    backgroundColor: theme.colors.brandDark,
    borderColor: theme.colors.brandDark
  },
  rangePillText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  rangePillTextActive: {
    color: theme.colors.textOnDark
  },
  rangePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  removeCampButton: {
    alignItems: "center",
    backgroundColor: theme.surfaces.input,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  removeCampButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  screen: {
    backgroundColor: "transparent",
    flex: 1
  },
  schedule: {
    gap: 14
  },
  scheduleBlock: {
    borderColor: theme.colors.border,
    borderLeftWidth: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    position: "absolute",
    justifyContent: "center",
    minWidth: 0,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 8,
    zIndex: 1
  },
  scheduleBlockTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 19
  },
  scheduleBlockHost: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14
  },
  scheduleDay: {
    backgroundColor: theme.surfaces.card,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12
  },
  scheduleDayHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between"
  },
  scheduleDayMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  scheduleDayTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  scheduleDays: {
    gap: 12
  },
  scheduleDayControlButton: {
    minWidth: 92
  },
  scheduleDayControlButtonDisabled: {
    opacity: 0.42
  },
  scheduleDayControlTextDisabled: {
    color: theme.colors.textMuted
  },
  scheduleDayControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  scheduleTodayButton: {
    flex: 1,
    minWidth: 86
  },
  scheduleEmptyDay: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: "700"
  },
  scheduleTimeEnd: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700"
  },
  scheduleTimeStart: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "900"
  },
  timelineEventArea: {
    flex: 1,
    position: "relative"
  },
  timelineHourLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    position: "absolute"
  },
  timelineHourLabelLeft: {
    left: 0,
    textAlign: "right",
    width: scheduleHourRailWidth - 6
  },
  timelineHourLabelRight: {
    left: 0,
    textAlign: "left",
    width: scheduleHourRailWidth - 6
  },
  timelineHourLine: {
    backgroundColor: theme.colors.borderSoft,
    left: 0,
    height: 1,
    opacity: scheduleHourLineOpacity,
    position: "absolute",
    right: 0
  },
  timelineRailLeft: {
    height: "100%",
    position: "relative",
    width: scheduleHourRailWidth
  },
  timelineRailRight: {
    height: "100%",
    position: "relative",
    width: scheduleHourRailWidth
  },
  timelineRails: {
    flexDirection: "row",
    minHeight: 0
  },
  segmented: {
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 4
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    paddingVertical: 9
  },
  segmentButtonActive: {
    backgroundColor: theme.colors.brandDark
  },
  segmentText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  segmentTextActive: {
    color: theme.colors.textOnDark
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15
  },
  title: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: "900"
  },
  timeline: {
    position: "relative"
  },
  threeDayColumn: {
    borderLeftColor: theme.colors.borderSoft,
    borderLeftWidth: 1,
    paddingLeft: 6,
    paddingRight: 4
  },
  threeDayColumnBody: {
    height: "100%",
    position: "relative"
  },
  threeDayColumnHeader: {
    borderLeftColor: theme.colors.borderSoft,
    borderLeftWidth: 1,
    gap: 2,
    minWidth: 0,
    paddingBottom: 8,
    paddingHorizontal: 6
  },
  threeDayColumnMeta: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "800"
  },
  threeDayColumnTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16
  },
  threeDayEmptyColumn: {
    borderLeftColor: theme.colors.borderSoft,
    borderLeftWidth: 1,
    minHeight: 96,
    padding: 8
  },
  threeDayEmptyRow: {
    flexDirection: "row"
  },
  threeDayHeaderRow: {
    flexDirection: "row"
  },
  threeDayRailSpacer: {
    width: scheduleHourRailWidth
  },
  threeDayScheduleBlock: {
    borderLeftWidth: 4,
    borderRadius: 6,
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 5
  },
  threeDayScheduleBlockHost: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12
  },
  threeDayScheduleBlockTitle: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 13
  },
  threeDayScrollContent: {
    flexGrow: 1
  },
  threeDayTimeline: {
    backgroundColor: theme.surfaces.card,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10
  },
  warning: {
    backgroundColor: theme.colors.warningBackground,
    borderColor: theme.colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.colors.warningText,
    padding: 12
  }
});
