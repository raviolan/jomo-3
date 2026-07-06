import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";

import {
  CAMP_MAP_IMAGE,
  getGridSquareBounds
} from "@/lib/mapGrid";
import type { GridSquareRef } from "@/models/schedule";
import { theme } from "@/theme/theme";

const campgroundMapImage = require("../../assets/maps/campground-map-2026.png") as ImageSourcePropType;

interface CampMapProps {
  highlightedSquares: GridSquareRef[];
  onGridSquarePress?: (gridSquare: GridSquareRef) => void;
}

export function CampMap({ highlightedSquares, onGridSquarePress }: CampMapProps) {
  const labels = highlightedSquares.map((square) => square.label).join(", ");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Show on map</Text>
        <Text style={styles.refs}>{labels}</Text>
      </View>
      <View style={styles.mapFrame}>
        <Image source={campgroundMapImage} style={styles.mapImage} resizeMode="contain" />
        <View pointerEvents="box-none" style={styles.markerLayer}>
          {highlightedSquares.map((square) => {
            const bounds = getGridSquareBounds(square);
            const markerStyle = {
              height: toPercent(bounds.height, CAMP_MAP_IMAGE.height),
              left: toPercent(bounds.x, CAMP_MAP_IMAGE.width),
              top: toPercent(bounds.y, CAMP_MAP_IMAGE.height),
              width: toPercent(bounds.width, CAMP_MAP_IMAGE.width)
            };

            if (onGridSquarePress) {
              return (
                <Pressable
                  accessibilityLabel={`Show event info for grid square ${square.label}`}
                  accessibilityRole="button"
                  hitSlop={18}
                  key={square.key}
                  onPress={() => onGridSquarePress(square)}
                  style={[styles.marker, markerStyle]}
                >
                  <GridSquareMarker label={square.label} />
                </Pressable>
              );
            }

            return (
              <View key={square.key} pointerEvents="none" style={[styles.marker, markerStyle]}>
                <GridSquareMarker label={square.label} />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function GridSquareMarker({ label }: { label: string }) {
  return (
    <View style={styles.markerCell}>
      <Text style={styles.markerLabel}>{label}</Text>
    </View>
  );
}

function toPercent(value: number, total: number): `${number}%` {
  return `${(value / total) * 100}%`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.surfaces.card,
    borderColor: theme.colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12
  },
  header: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between"
  },
  mapFrame: {
    aspectRatio: CAMP_MAP_IMAGE.width / CAMP_MAP_IMAGE.height,
    backgroundColor: theme.colors.backgroundFallback,
    borderColor: theme.colors.borderSoft,
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    width: "100%"
  },
  mapImage: {
    height: "100%",
    width: "100%"
  },
  marker: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute"
  },
  markerCell: {
    alignItems: "center",
    backgroundColor: "rgba(255, 159, 207, 0.48)",
    borderColor: theme.colors.brandDark,
    borderRadius: 2,
    borderWidth: 2,
    height: "100%",
    justifyContent: "center",
    minHeight: 18,
    minWidth: 32,
    width: "100%"
  },
  markerLabel: {
    backgroundColor: "rgba(255, 253, 248, 0.88)",
    borderColor: theme.colors.brandDark,
    borderRadius: 999,
    borderWidth: 1,
    color: theme.colors.brandDark,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 15,
    minWidth: 30,
    overflow: "hidden",
    paddingHorizontal: 4,
    textAlign: "center"
  },
  markerLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2
  },
  refs: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  title: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  }
});
