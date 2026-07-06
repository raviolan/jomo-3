import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppFooter } from "@/components/AppFooter";
import { EmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { UndoNotice } from "@/components/UndoNotice";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { clearReturnContext, getReturnContext, setReturnContext } from "@/lib/returnNavigation";
import { parseGridSquareRef } from "@/lib/mapGrid";
import { getEventsForGridSquare } from "@/lib/scheduleQueries";
import { subscribeToScrollToTop } from "@/lib/scrollToTopEvents";
import { theme } from "@/theme/theme";

export default function MapSquareScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const [pendingRestoreScrollY, setPendingRestoreScrollY] = useState<number | undefined>();
  const { square: squareParam } = useLocalSearchParams<{ square: string }>();
  const square = parseGridSquareRef(typeof squareParam === "string" ? squareParam : undefined);
  const events = useMemo(() => (square ? getEventsForGridSquare(square) : []), [square]);
  const saved = useSavedEvents();

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
      if (!square || context?.route !== "mapSquare" || context.square !== square.key) {
        return;
      }

      setPendingRestoreScrollY(context.scrollY);
    }, [square])
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
  }, [events.length, pendingRestoreScrollY]);

  function captureReturnContext() {
    if (!square) {
      return;
    }

    setReturnContext({
      route: "mapSquare",
      scrollY: scrollYRef.current,
      square: square.key
    });
  }

  if (!square) {
    return (
      <View style={styles.missing}>
        <EmptyState title="Grid square not found" body="This map square is outside the campground grid." />
        <Link href="/map" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to map</Text>
          </Pressable>
        </Link>
      </View>
    );
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
        <Link href="/map" asChild>
          <Pressable accessibilityRole="button" style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to map</Text>
          </Pressable>
        </Link>
        <Text style={styles.title}>{square.label}</Text>
        <Text style={styles.subtitle}>
          {events.length === 1 ? "1 event in this grid square." : `${events.length} events in this grid square.`}
        </Text>
      </View>

      {saved.storageError ? <Text style={styles.warning}>{saved.storageError}</Text> : null}
      <UndoNotice label={saved.undoLabel} onUndo={saved.undoLastAction} />

      <View style={styles.list}>
        {events.length === 0 ? (
          <EmptyState title="No events found" body="No bundled schedule events are linked to this grid square yet." />
        ) : (
          events.map((event) => (
            <EventCard
              event={event}
              isSaved={saved.isSaved(event.id)}
              key={event.id}
              onBeforeNavigate={captureReturnContext}
              onToggleSaved={saved.toggleSaved}
            />
          ))
        )}
      </View>

      <AppFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
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
  content: {
    gap: 18,
    marginHorizontal: "auto",
    maxWidth: 760,
    padding: theme.spacing.screenX,
    paddingBottom: theme.spacing.bottomNavPadding,
    width: "100%"
  },
  header: {
    gap: 10
  },
  list: {
    gap: 12
  },
  missing: {
    backgroundColor: "transparent",
    flex: 1,
    gap: 16,
    justifyContent: "center",
    padding: theme.spacing.screenX,
    paddingBottom: theme.spacing.bottomNavPadding
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.brandDark,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  primaryButtonText: {
    color: theme.colors.textOnDark,
    fontSize: 14,
    fontWeight: "900"
  },
  screen: {
    backgroundColor: "transparent",
    flex: 1
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 21
  },
  title: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 39
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
