import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppFooter } from "@/components/AppFooter";
import { CampMap } from "@/components/CampMap";
import { getCampLocationsByGridSquare, getCampsForGridSquare } from "@/lib/scheduleQueries";
import type { GridSquareRef } from "@/models/schedule";
import { theme } from "@/theme/theme";

type MapFilter = "default" | "camps";

export default function MapScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<MapFilter>("default");
  const [selectedCampSquare, setSelectedCampSquare] = useState<GridSquareRef | undefined>();
  const campLocationGroups = useMemo(() => getCampLocationsByGridSquare(), []);
  const campSquareKeys = useMemo(() => new Set(campLocationGroups.map((group) => group.square.key)), [campLocationGroups]);
  const campHighlightSquares = useMemo(() => campLocationGroups.map((group) => group.square), [campLocationGroups]);
  const selectedCamps = selectedCampSquare ? getCampsForGridSquare(selectedCampSquare) : [];
  const isCampFilterActive = activeFilter === "camps";

  function openGridSquare(square: GridSquareRef) {
    if (isCampFilterActive && campSquareKeys.has(square.key)) {
      if (selectedCampSquare?.key === square.key && selectedCamps.length === 1) {
        openCamp(selectedCamps[0]);
        return;
      }

      setSelectedCampSquare(square);
      return;
    }

    setSelectedCampSquare(undefined);
    router.push(`/map/${square.key}`);
  }

  function setFilter(filter: MapFilter) {
    setActiveFilter(filter);
    setSelectedCampSquare(undefined);
  }

  function openCamp(camp: string) {
    router.push({
      pathname: "/",
      params: {
        camp,
        view: "camps"
      }
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.subtitle}>Tap a grid square to see events happening there.</Text>
      </View>

      <View style={styles.filters}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFilter("default")}
          style={[styles.filterButton, activeFilter === "default" && styles.filterButtonActive]}
        >
          <Text style={[styles.filterButtonText, activeFilter === "default" && styles.filterButtonTextActive]}>All</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFilter("camps")}
          style={[styles.filterButton, isCampFilterActive && styles.filterButtonActive]}
        >
          <Text style={[styles.filterButtonText, isCampFilterActive && styles.filterButtonTextActive]}>Camps</Text>
        </Pressable>
      </View>

      <CampMap
        campInfo={
          isCampFilterActive && selectedCampSquare
            ? {
                camps: selectedCamps,
                onCampPress: openCamp,
                onClose: () => setSelectedCampSquare(undefined),
                square: selectedCampSquare
              }
            : undefined
        }
        campHighlightSquares={isCampFilterActive ? campHighlightSquares : []}
        highlightedSquares={[]}
        interactiveSquares="all"
        onGridSquarePress={openGridSquare}
      />

      <AppFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    marginHorizontal: "auto",
    maxWidth: 900,
    padding: theme.spacing.screenX,
    paddingBottom: theme.spacing.bottomNavPadding,
    width: "100%"
  },
  header: {
    gap: 6
  },
  filters: {
    alignSelf: "flex-start",
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 4
  },
  filterButton: {
    borderRadius: 999,
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  filterButtonActive: {
    backgroundColor: theme.colors.brandDark
  },
  filterButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  filterButtonTextActive: {
    color: theme.colors.textOnDark
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
  }
});
