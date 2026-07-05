import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import type { FestivalDay } from "@/models/schedule";
import { theme } from "@/theme/theme";

interface DayTabsProps {
  days: FestivalDay[];
  selectedDayId: string;
  onSelectDay: (dayId: string) => void;
}

export function DayTabs({ days, selectedDayId, onSelectDay }: DayTabsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {days.map((day) => {
        const isSelected = day.id === selectedDayId;
        return (
          <Pressable
            accessibilityRole="button"
            key={day.id}
            onPress={() => onSelectDay(day.id)}
            style={[styles.tab, isSelected && styles.tabSelected]}
          >
            <Text style={[styles.tabText, isSelected && styles.tabTextSelected]}>
              {shortDayLabel(day.label)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function shortDayLabel(label: string): string {
  return label.replace(" 2026", "").replace(" (build)", "").replace(" (strike)", "");
}

const styles = StyleSheet.create({
  tab: {
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  tabSelected: {
    backgroundColor: theme.colors.brandDark
  },
  tabText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  tabTextSelected: {
    color: theme.colors.textOnDark
  },
  tabs: {
    gap: 8,
    paddingHorizontal: 18
  }
});
