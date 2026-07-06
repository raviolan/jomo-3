import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { FestivalEvent } from "@/models/schedule";
import { theme } from "@/theme/theme";

interface EventCardProps {
  event: FestivalEvent;
  isSaved: boolean;
  onToggleSaved: (eventId: string) => void;
}

export function EventCard({ event, isSaved, onToggleSaved }: EventCardProps) {
  return (
    <Link href={`/event/${event.id}`} asChild>
      <Pressable style={styles.card}>
        <View style={styles.header}>
          <View style={styles.timeBlock}>
            <Text style={styles.time}>{event.time.start}</Text>
            <Text style={styles.timeEnd}>{event.time.end}</Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.category}>{event.category}</Text>
            <Text style={styles.title}>{event.title}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSaved ? "Unsave event" : "Save event"}
            onPress={(pressEvent) => {
              pressEvent.preventDefault();
              onToggleSaved(event.id);
            }}
            style={[styles.saveButton, isSaved && styles.saveButtonActive]}
          >
            <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextActive]}>
              {isSaved ? "Saved" : "Save"}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.location} numberOfLines={2}>
          {event.location.name}
        </Text>
        {event.host ? (
          <Text style={styles.host} numberOfLines={1}>
            {event.host}
          </Text>
        ) : null}
        {event.campHost ? (
          <Text style={styles.campHost} numberOfLines={1}>
            {event.campHost}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surfaces.card,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14
  },
  campHost: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: "800"
  },
  category: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  host: {
    color: theme.colors.textMuted,
    fontSize: 13
  },
  location: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 19
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: theme.surfaces.input,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  saveButtonActive: {
    backgroundColor: theme.colors.brandDark
  },
  saveButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  saveButtonTextActive: {
    color: theme.colors.textOnDark
  },
  time: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  timeBlock: {
    minWidth: 54
  },
  timeEnd: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "700"
  },
  title: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 20
  },
  titleBlock: {
    flex: 1,
    gap: 3,
    minWidth: 170
  }
});
