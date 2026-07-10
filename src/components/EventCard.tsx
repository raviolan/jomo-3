import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { HeartIcon } from "@/components/HeartIcon";
import { getDayLabelForEvent, getEventHref } from "@/lib/scheduleQueries";
import type { FestivalEvent } from "@/models/schedule";
import { theme } from "@/theme/theme";

interface EventCardProps {
  event: FestivalEvent;
  campHostLabel?: string;
  hostLabel?: string;
  isSaved: boolean;
  onBeforeNavigate?: () => void;
  onToggleSaved: (eventId: string) => void;
}

export function EventCard({ event, campHostLabel, hostLabel, isSaved, onBeforeNavigate, onToggleSaved }: EventCardProps) {
  return (
    <Link href={getEventHref(event)} asChild>
      <Pressable onPress={onBeforeNavigate} style={styles.card}>
        <View style={styles.header}>
          <View style={styles.timeBlock}>
            <Text style={styles.timeMeta}>{getDayLabelForEvent(event)}</Text>
            <Text style={styles.time}>{event.time.start}</Text>
            <Text style={styles.timeMeta}>{event.time.end}</Text>
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
            style={styles.saveButton}
          >
            <HeartIcon color={theme.colors.brandDark} filled={isSaved} size={21} />
          </Pressable>
        </View>
        <Text style={styles.location} numberOfLines={2}>
          {event.location.name}
        </Text>
        {event.host || hostLabel ? (
          <Text style={styles.host} numberOfLines={1}>
            {hostLabel ?? event.host}
          </Text>
        ) : null}
        {event.campHost ? (
          <Text style={styles.campHost} numberOfLines={1}>
            {campHostLabel ?? event.campHost}
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
    height: 40,
    justifyContent: "center",
    width: 40
  },
  time: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  timeBlock: {
    minWidth: 62
  },
  timeMeta: {
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
