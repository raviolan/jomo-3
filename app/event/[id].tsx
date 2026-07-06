import { useEffect, useRef } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppFooter } from "@/components/AppFooter";
import { EmptyState } from "@/components/EmptyState";
import { LinkifiedText } from "@/components/LinkifiedText";
import { UndoNotice } from "@/components/UndoNotice";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { getReturnContext, getReturnHref } from "@/lib/returnNavigation";
import { getDayLabelForEvent, getEventById } from "@/lib/scheduleQueries";
import { subscribeToScrollToTop } from "@/lib/scrollToTopEvents";
import { theme } from "@/theme/theme";

export default function EventDetailScreen() {
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = typeof id === "string" ? getEventById(id) : undefined;
  const saved = useSavedEvents();

  useEffect(
    () =>
      subscribeToScrollToTop(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }),
    []
  );

  if (!event) {
    return (
      <View style={styles.missing}>
        <EmptyState title="Event not found" body="This event is not available in the bundled schedule." />
        <Link href="/" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to schedule</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const isSaved = saved.isSaved(event.id);

  return (
    <ScrollView ref={scrollViewRef} style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.replace(getReturnHref(getReturnContext()));
        }}
        style={styles.backButton}
      >
        <Text style={styles.backButtonText}>Back to list</Text>
      </Pressable>

      <UndoNotice label={saved.undoLabel} onUndo={saved.undoLastAction} />

      <Text style={styles.category}>{event.category}</Text>
      <Text style={styles.title}>{event.title}</Text>

      <View style={styles.metaGrid}>
        <MetaBlock label="Time" value={`${getDayLabelForEvent(event)} · ${event.time.display}`} />
        <MetaBlock label="Location" value={event.location.name} />
        <DescriptionBlock value={event.description || "No description was extracted for this event."} />
        {event.host ? <MetaBlock label="Host" value={event.host} /> : null}
        {event.campHost ? <MetaBlock label="Camp" value={event.campHost} /> : null}
        {event.tags.length > 0 ? <MetaBlock label="Tags" value={event.tags.join(" · ")} /> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => saved.toggleSaved(event.id)}
        style={[styles.saveButton, isSaved && styles.saveButtonActive]}
      >
        <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextActive]}>
          {isSaved ? "Saved locally" : "Save event"}
        </Text>
      </Pressable>

      {saved.storageError ? <Text style={styles.warning}>{saved.storageError}</Text> : null}

      <Text style={styles.source}>Source: {event.source.pdf}, page {event.source.page}</Text>
      <AppFooter />
    </ScrollView>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBlock}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function DescriptionBlock({ value }: { value: string }) {
  return (
    <View style={styles.metaBlock}>
      <Text style={styles.metaLabel}>Description</Text>
      <LinkifiedText style={styles.metaValue} text={value} />
    </View>
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
  category: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  content: {
    gap: 18,
    marginHorizontal: "auto",
    maxWidth: 760,
    padding: theme.spacing.screenX,
    paddingBottom: theme.spacing.bottomNavPadding,
    width: "100%"
  },
  metaBlock: {
    backgroundColor: theme.surfaces.card,
    borderColor: theme.colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12
  },
  metaGrid: {
    gap: 10
  },
  metaLabel: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 20
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
  saveButton: {
    alignItems: "center",
    backgroundColor: theme.surfaces.input,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  saveButtonActive: {
    backgroundColor: theme.colors.brandDark
  },
  saveButtonText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "900"
  },
  saveButtonTextActive: {
    color: theme.colors.textOnDark
  },
  screen: {
    backgroundColor: "transparent",
    flex: 1
  },
  source: {
    color: theme.colors.textMuted,
    fontSize: 12
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
