import { useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import { AppFooter } from "@/components/AppFooter";
import { CampMap } from "@/components/CampMap";
import { MAP_PLAZAS, MAP_SERVICE_LOCATIONS } from "@/data/mapReference";
import { INFO_PLAZA_MAP_GRID_GEOMETRY } from "@/lib/mapGrid";
import type { GridSquareRef } from "@/models/schedule";
import { theme } from "@/theme/theme";

type MapMode = "info" | "places";

const legendInfoImage = require("../../assets/maps/campground-map-legend-info-2026.png");
const buildingsPlacesReferenceImage = require("../../assets/maps/campground-map-buildings-places-reference-2026.png");
const infoBaseMapImage = require("../../assets/maps/campground-map-info-cropped-2026.png");
const servicesBaseMapImage = require("../../assets/maps/campground-map-services-cropped-2026.png");

export default function MapScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const mapSectionOffsetRef = useRef(0);
  const [activeMode, setActiveMode] = useState<MapMode>("info");
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  const [isPlacesReferenceExpanded, setIsPlacesReferenceExpanded] = useState(false);
  const [selectedPlazaNumber, setSelectedPlazaNumber] = useState<number | undefined>();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>();
  const selectedPlaza = useMemo(
    () => MAP_PLAZAS.find((plaza) => plaza.number === selectedPlazaNumber),
    [selectedPlazaNumber]
  );
  const selectedPlace = useMemo(
    () => MAP_SERVICE_LOCATIONS.find((place) => place.id === selectedPlaceId),
    [selectedPlaceId]
  );
  const plazaMarkers = useMemo(
    () =>
      MAP_PLAZAS.map((plaza) => ({
        key: `plaza-${plaza.number}`,
        label: String(plaza.number),
        offset: plaza.markerOffset,
        square: plaza.square
      })),
    []
  );

  function openGridSquare(square: GridSquareRef) {
    router.push(`/map/${square.key}`);
  }

  function setMode(mode: MapMode) {
    setActiveMode(mode);
    setIsLegendExpanded(false);
    setIsPlacesReferenceExpanded(false);
    setSelectedPlazaNumber(undefined);
    setSelectedPlaceId(undefined);
  }

  function handleMapSectionLayout(event: LayoutChangeEvent) {
    mapSectionOffsetRef.current = event.nativeEvent.layout.y;
  }

  function focusMapSection() {
    scrollViewRef.current?.scrollTo({
      y: Math.max(mapSectionOffsetRef.current - 12, 0),
      animated: true
    });
  }

  function togglePlazaSelection(plazaNumber: number) {
    setSelectedPlazaNumber((current) => (current === plazaNumber ? undefined : plazaNumber));
    focusMapSection();
  }

  function togglePlaceSelection(placeId: string) {
    setSelectedPlaceId((current) => (current === placeId ? undefined : placeId));
    focusMapSection();
  }

  return (
    <ScrollView ref={scrollViewRef} style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.subtitle}>
          {activeMode === "info"
            ? "Browse legend details and plazas from the bundled festival guide."
            : "Browse bundled service locations and jump back to the matching map highlights."}
        </Text>
      </View>

      <View style={styles.filters}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMode("info")}
          style={[styles.filterButton, activeMode === "info" && styles.filterButtonActive]}
        >
          <Text style={[styles.filterButtonText, activeMode === "info" && styles.filterButtonTextActive]}>
            Info & plazas
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMode("places")}
          style={[styles.filterButton, activeMode === "places" && styles.filterButtonActive]}
        >
          <Text style={[styles.filterButtonText, activeMode === "places" && styles.filterButtonTextActive]}>
            Service locations
          </Text>
        </Pressable>
      </View>

      <View onLayout={handleMapSectionLayout}>
        <CampMap
          baseMapImageSource={activeMode === "info" ? infoBaseMapImage : servicesBaseMapImage}
          gridGeometry={activeMode === "info" ? INFO_PLAZA_MAP_GRID_GEOMETRY : undefined}
          highlightedSquares={
            activeMode === "info"
              ? selectedPlaza
                ? [selectedPlaza.square]
                : []
              : selectedPlace?.squares ?? []
          }
          highlightedSquaresVariant="outline"
          interactiveSquares="all"
          mode="scrollable"
          onGridSquarePress={openGridSquare}
          overlayMarkers={activeMode === "info" ? plazaMarkers : []}
          showGridLabels
          showSelectionSummary={false}
        />
      </View>

      {activeMode === "info" ? (
        <>
          <View style={styles.referenceSection}>
            <Pressable accessibilityRole="button" onPress={() => setIsLegendExpanded((current) => !current)} style={styles.sectionToggle}>
              <Text style={styles.sectionTitle}>Legend & info</Text>
              <Text style={styles.sectionToggleText}>{isLegendExpanded ? "Hide" : "Show"}</Text>
            </Pressable>
            {isLegendExpanded ? (
              <View style={styles.legendImageCard}>
                <Image source={legendInfoImage} style={styles.legendImage} resizeMode="contain" />
              </View>
            ) : null}
          </View>

          <View style={styles.referenceSection}>
            <Text style={styles.sectionTitle}>Plazas</Text>
            <View style={styles.referenceList}>
              {MAP_PLAZAS.map((plaza) => {
                const isSelected = plaza.number === selectedPlazaNumber;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={plaza.number}
                    onPress={() => togglePlazaSelection(plaza.number)}
                    style={[styles.plazaRow, isSelected && styles.plazaRowActive]}
                  >
                    <View style={[styles.plazaNumberBadge, isSelected && styles.plazaNumberBadgeActive]}>
                      <Text style={[styles.plazaNumberText, isSelected && styles.plazaNumberTextActive]}>{plaza.number}</Text>
                    </View>
                    <View style={styles.plazaTextBlock}>
                      <Text style={styles.plazaName}>{plaza.name}</Text>
                      <Text style={styles.plazaSquare}>{plaza.square.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={styles.referenceSection}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsPlacesReferenceExpanded((current) => !current)}
              style={styles.sectionToggle}
            >
              <Text style={styles.sectionTitle}>Services reference</Text>
              <Text style={styles.sectionToggleText}>{isPlacesReferenceExpanded ? "Hide" : "Show"}</Text>
            </Pressable>
            {isPlacesReferenceExpanded ? (
              <View style={styles.legendImageCard}>
                <Image source={buildingsPlacesReferenceImage} style={styles.placesReferenceImage} resizeMode="contain" />
              </View>
            ) : null}
          </View>

          <View style={styles.referenceSection}>
            <Text style={styles.sectionTitle}>Service locations</Text>
            <View style={styles.placeGrid}>
              {MAP_SERVICE_LOCATIONS.map((place) => {
                const isSelected = place.id === selectedPlaceId;
                const squareLabels = place.squares.map((square) => square.label).join(", ");

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={place.id}
                    onPress={() => togglePlaceSelection(place.id)}
                    style={[styles.placeCard, isSelected && styles.placeCardActive]}
                  >
                    <Image source={place.image} style={styles.placeImage} resizeMode="contain" />
                    <View style={styles.placeTextBlock}>
                      <Text style={styles.placeName}>{place.label}</Text>
                      <Text style={styles.placeSquareText}>{squareLabels}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      )}

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
  header: {
    gap: 6
  },
  legendImage: {
    aspectRatio: 786 / 250,
    width: "100%"
  },
  legendImageCard: {
    backgroundColor: theme.surfaces.card,
    borderColor: theme.colors.border,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    padding: 8
  },
  placeCard: {
    alignItems: "center",
    backgroundColor: theme.surfaces.card,
    borderColor: theme.colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
    width: "48%"
  },
  placeCardActive: {
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.brandDark
  },
  placeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between"
  },
  placeImage: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 8,
    height: 36,
    width: 36
  },
  placeName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  placeSquareText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  placesReferenceImage: {
    aspectRatio: 620 / 360,
    width: "100%"
  },
  placeTextBlock: {
    flex: 1,
    gap: 4
  },
  plazaName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  plazaNumberBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 248, 165, 0.95)",
    borderColor: "#4f3a00",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  plazaNumberBadgeActive: {
    backgroundColor: theme.colors.brandDark,
    borderColor: theme.colors.brandDark
  },
  plazaNumberText: {
    color: "#4f3a00",
    fontSize: 13,
    fontWeight: "900"
  },
  plazaNumberTextActive: {
    color: theme.colors.textOnDark
  },
  plazaRow: {
    alignItems: "center",
    backgroundColor: theme.surfaces.card,
    borderColor: theme.colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12
  },
  plazaRowActive: {
    backgroundColor: theme.surfaces.chrome,
    borderColor: theme.colors.brandDark
  },
  plazaSquare: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "800"
  },
  plazaTextBlock: {
    flex: 1,
    gap: 3
  },
  referenceList: {
    gap: 10
  },
  referenceSection: {
    gap: 10
  },
  screen: {
    backgroundColor: "transparent",
    flex: 1
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  sectionToggle: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  sectionToggleText: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
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
