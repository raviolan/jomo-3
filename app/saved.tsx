import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { UndoNotice } from "@/components/UndoNotice";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { clearReturnContext, getReturnContext, setReturnContext } from "@/lib/returnNavigation";
import { getAllEvents, getEventEndTime, getEventStartTime, getScheduleDays } from "@/lib/scheduleQueries";
import { subscribeToScrollToTop } from "@/lib/scrollToTopEvents";
import { theme } from "@/theme/theme";
import type { FestivalDay, FestivalEvent } from "@/models/schedule";

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
  const saved = useSavedEvents();
  const savedCampEvents = saved.savedCampEvents;
  const allEvents = useMemo(() => getAllEvents(), []);
  const events = saved.savedEvents(allEvents);
  const days = getScheduleDays();
  const eventGroups = useMemo(() => groupSavedEventsByDay(events, days), [days, events]);
  const savedCampHosts = useMemo(
    () => [...saved.savedCampHosts].sort((a, b) => a.localeCompare(b)),
    [saved.savedCampHosts]
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
            : `${events.length} events and ${savedCampHosts.length} camps saved locally.`}
        </Text>
      </View>

      {saved.storageError ? <Text style={styles.warning}>{saved.storageError}</Text> : null}
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
              body="Save events or camps to build a local plan for the festival."
            />
          ) : (
            eventGroups.map((group) => (
              <View key={group.dayId} style={styles.dayGroup}>
                <SavedDayDivider label={group.label} />
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
          <View style={styles.list}>
            {selectedCampEventGroups.map((group) => (
              <View key={group.dayId} style={styles.dayGroup}>
                <SavedDayDivider label={group.label} />
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
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.list}>
          {savedCampHosts.length === 0 ? (
            <EmptyState title="No saved camps yet" body="Save camps from the Camps view to follow all of their events." />
          ) : (
            savedCampHosts.map((campHost) => (
              <Pressable
                accessibilityRole="button"
                key={campHost}
                onPress={() => openSavedCamp(campHost)}
                style={styles.campRow}
              >
                <Text style={styles.campRowTitle}>{campHost}</Text>
                <Text style={styles.campRowMeta}>View</Text>
              </Pressable>
            ))
          )}
        </View>
      )}
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
  const scheduleDays = getDisplayedScheduleDays(days, events, range, now);

  if (events.length === 0) {
    return (
      <EmptyState
        title="No saved schedule yet"
        body="Saved events and events from saved camps will appear in your visual schedule."
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
            onPress={() => onRangeChange(option.value)}
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

      {scheduleDays.length === 0 ? (
        <EmptyState
          title="No saved schedule available"
          body="Saved items are present, but none match a valid festival schedule day."
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
                router.push(`/event/${eventId}`);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
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

function CurrentTimeGuide({ top }: { top: number }) {
  const safeTop = getSafeStyleNumber(top);

  return (
    <View pointerEvents="none" style={StyleSheet.flatten([styles.currentTimeGuide, { top: safeTop }])}>
      <View style={styles.currentTimeDot} />
      <View style={styles.currentTimeLine} />
    </View>
  );
}

function SavedDayDivider({ label }: { label: string }) {
  return (
    <View style={styles.dayDivider}>
      <View style={styles.dayDividerLine} />
      <Text style={styles.dayDividerText}>{shortDayLabel(label).split(/\s+/)[0]}</Text>
      <View style={styles.dayDividerLine} />
    </View>
  );
}

function getDisplayedScheduleDays(
  days: FestivalDay[],
  events: FestivalEvent[],
  range: ScheduleRange,
  now: Date
): ScheduleDayGroup[] {
  const validDays = days.filter(isValidScheduleDay);
  if (validDays.length === 0) {
    return [];
  }

  const eventDayIds = new Set(events.map((event) => event.dayId).filter(isDefinedString));

  if (range === "week") {
    const daysWithEvents = validDays.filter((day) => eventDayIds.has(day.id));
    return (daysWithEvents.length > 0 ? daysWithEvents : validDays).map((day) => ({
      day,
      events: getEventsForScheduleDay(events, day.id)
    }));
  }

  const today = toLocalDateString(now);
  const todayIndex = validDays.findIndex((day) => day.date === today);
  const firstSavedEventDayIndex = validDays.findIndex((day) => eventDayIds.has(day.id));
  const startIndex = todayIndex >= 0 ? todayIndex : Math.max(firstSavedEventDayIndex, 0);
  const dayCount = range === "1day" ? 1 : 3;

  return validDays.slice(startIndex, startIndex + dayCount).map((day) => ({
    day,
    events: getEventsForScheduleDay(events, day.id)
  }));
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

function getScheduleTimeline(events: FestivalEvent[], isCompact: boolean): ScheduleTimeline {
  const timedEvents = events
    .map((event) => {
      const bounds = getEventTimeBounds(event);
      return bounds ? { event, ...bounds } : undefined;
    })
    .filter(isDefined)
    .sort((a, b) => a.start - b.start || a.end - b.end || a.event.title.localeCompare(b.event.title));

  if (timedEvents.length === 0) {
    return emptyScheduleTimeline();
  }

  const dayStart = floorToHour(Math.min(...timedEvents.map((row) => row.start)));
  const dayEnd = ceilToHour(Math.max(...timedEvents.map((row) => row.end)));

  if (!isFiniteNumber(dayStart) || !isFiniteNumber(dayEnd) || dayEnd <= dayStart) {
    return emptyScheduleTimeline();
  }

  const ticks = buildHourlyTicks(dayStart, dayEnd);
  const rows = assignTimelineRows(timedEvents, dayStart, isCompact);
  const timelineHeight = Math.max(
    minTimelineHeight,
    ...rows.map((row) => row.top + row.height),
    (dayEnd - dayStart) / minuteMs * scheduleMinuteHeight
  );

  return {
    dayEnd,
    dayStart,
    rows,
    ticks,
    timelineHeight: getSafeStyleNumber(timelineHeight, minTimelineHeight)
  };
}

function getCurrentTimeGuide(
  day: FestivalDay,
  layout: ScheduleTimeline,
  now: Date
): { top: number } | undefined {
  if (!isValidScheduleDay(day) || layout.rows.length === 0 || day.date !== toLocalDateString(now)) {
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
  isCompact: boolean
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
    const placed = placeTimelineGroup(group);
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
    paddingVertical: 4
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
  dayGroup: {
    gap: 12
  },
  header: {
    gap: 4
  },
  list: {
    gap: 12
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
  warning: {
    backgroundColor: theme.colors.warningBackground,
    borderColor: theme.colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.colors.warningText,
    padding: 12
  }
});
