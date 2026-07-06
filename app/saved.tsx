import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { getAllEvents } from "@/lib/scheduleQueries";
import { subscribeToScrollToTop } from "@/lib/scrollToTopEvents";
import { theme } from "@/theme/theme";

export default function SavedScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const saved = useSavedEvents();
  const events = saved.savedEvents(getAllEvents());

  useEffect(
    () =>
      subscribeToScrollToTop(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }),
    []
  );

  return (
    <ScrollView ref={scrollViewRef} style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved events</Text>
        <Text style={styles.subtitle}>
          {saved.isHydrating ? "Loading saved events..." : `${events.length} events saved locally.`}
        </Text>
      </View>

      {saved.storageError ? <Text style={styles.warning}>{saved.storageError}</Text> : null}

      <View style={styles.list}>
        {events.length === 0 ? (
          <EmptyState
            title="No saved events yet"
            body="Save events from the schedule to build a local plan for the festival."
          />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    marginHorizontal: "auto",
    maxWidth: 760,
    padding: theme.spacing.screenX,
    paddingBottom: theme.spacing.bottomNavPadding,
    width: "100%"
  },
  header: {
    gap: 4
  },
  list: {
    gap: 12
  },
  screen: {
    backgroundColor: "transparent",
    flex: 1
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
  warning: {
    backgroundColor: theme.colors.warningBackground,
    borderColor: theme.colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.colors.warningText,
    padding: 12
  }
});
