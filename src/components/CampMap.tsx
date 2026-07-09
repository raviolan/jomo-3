import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";

import {
  ALL_GRID_SQUARES,
  CAMP_MAP_IMAGE,
  getGridColumnBounds,
  getGridRowBounds,
  getGridSquareBounds
} from "@/lib/mapGrid";
import type { GridSquareRef } from "@/models/schedule";
import { theme } from "@/theme/theme";

const campgroundMapImage = require("../../assets/maps/campground-map-2026.png") as ImageSourcePropType;

interface CampMapProps {
  campHighlightSquares?: GridSquareRef[];
  campInfo?: {
    camps: string[];
    onCampPress: (camp: string) => void;
    onClose: () => void;
    square: GridSquareRef;
  };
  highlightedSquares: GridSquareRef[];
  interactiveSquares?: "highlighted" | "all";
  onGridSquarePress?: (gridSquare: GridSquareRef) => void;
}

export function CampMap({
  campHighlightSquares = [],
  campInfo,
  highlightedSquares,
  interactiveSquares = "highlighted",
  onGridSquarePress
}: CampMapProps) {
  const labels = highlightedSquares.map((square) => square.label).join(", ");
  const isEventDetailHighlightMode = interactiveSquares === "highlighted";
  const pressableSquares =
    onGridSquarePress && interactiveSquares === "all" ? ALL_GRID_SQUARES : highlightedSquares;

  return (
    <View style={styles.container}>
      {highlightedSquares.length > 0 ? (
        <View style={styles.header}>
          <Text style={styles.title}>Show on map</Text>
          <Text style={styles.refs}>{labels}</Text>
        </View>
      ) : null}
      <View style={styles.mapFrame}>
        <Image source={campgroundMapImage} style={styles.mapImage} resizeMode="contain" />
        <View pointerEvents="box-none" style={styles.markerLayer}>
          {campHighlightSquares.map((square) => {
            const bounds = getGridSquareBounds(square);
            const markerStyle = {
              height: toPercent(bounds.height, CAMP_MAP_IMAGE.height),
              left: toPercent(bounds.x, CAMP_MAP_IMAGE.width),
              top: toPercent(bounds.y, CAMP_MAP_IMAGE.height),
              width: toPercent(bounds.width, CAMP_MAP_IMAGE.width)
            };

            return <View key={`camp-${square.key}`} pointerEvents="none" style={[styles.campMarker, markerStyle]} />;
          })}
          {highlightedSquares.map((square) => {
            const bounds = getGridSquareBounds(square);
            const cellStyle = {
              height: toPercent(bounds.height, CAMP_MAP_IMAGE.height),
              left: toPercent(bounds.x, CAMP_MAP_IMAGE.width),
              top: toPercent(bounds.y, CAMP_MAP_IMAGE.height),
              width: toPercent(bounds.width, CAMP_MAP_IMAGE.width)
            };
            const rowBounds = getGridRowBounds(square);
            const rowStyle = {
              height: toPercent(rowBounds.height, CAMP_MAP_IMAGE.height),
              left: toPercent(rowBounds.x, CAMP_MAP_IMAGE.width),
              top: toPercent(rowBounds.y, CAMP_MAP_IMAGE.height),
              width: toPercent(rowBounds.width, CAMP_MAP_IMAGE.width)
            };
            const columnBounds = getGridColumnBounds(square);
            const columnStyle = {
              height: toPercent(columnBounds.height, CAMP_MAP_IMAGE.height),
              left: toPercent(columnBounds.x, CAMP_MAP_IMAGE.width),
              top: toPercent(columnBounds.y, CAMP_MAP_IMAGE.height),
              width: toPercent(columnBounds.width, CAMP_MAP_IMAGE.width)
            };

            if (isEventDetailHighlightMode) {
              return (
                <View key={square.key} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                  <View pointerEvents="none" style={[styles.eventGuide, styles.eventGuideRow, rowStyle]} />
                  <View pointerEvents="none" style={[styles.eventGuide, styles.eventGuideColumn, columnStyle]} />
                  {onGridSquarePress ? (
                    <Pressable
                      accessibilityLabel={`Show event info for grid square ${square.label}`}
                      accessibilityRole="button"
                      hitSlop={18}
                      key={`${square.key}-highlight`}
                      onPress={() => onGridSquarePress(square)}
                      style={[styles.eventCellHighlight, cellStyle]}
                    >
                      <Text style={styles.eventCellLabel}>{square.label}</Text>
                    </Pressable>
                  ) : (
                    <View key={`${square.key}-highlight`} pointerEvents="none" style={[styles.eventCellHighlight, cellStyle]}>
                      <Text style={styles.eventCellLabel}>{square.label}</Text>
                    </View>
                  )}
                </View>
              );
            }

            if (onGridSquarePress) {
              return (
                <Pressable
                  accessibilityLabel={`Show event info for grid square ${square.label}`}
                  accessibilityRole="button"
                  hitSlop={18}
                  key={square.key}
                  onPress={() => onGridSquarePress(square)}
                  style={[styles.marker, cellStyle]}
                >
                  <GridSquareMarker label={square.label} />
                </Pressable>
              );
            }

            return (
              <View key={square.key} pointerEvents="none" style={[styles.marker, cellStyle]}>
                <GridSquareMarker label={square.label} />
              </View>
            );
          })}
          {onGridSquarePress
            ? pressableSquares.map((square) => {
                const bounds = getGridSquareBounds(square);
                const markerStyle = {
                  height: toPercent(bounds.height, CAMP_MAP_IMAGE.height),
                  left: toPercent(bounds.x, CAMP_MAP_IMAGE.width),
                  top: toPercent(bounds.y, CAMP_MAP_IMAGE.height),
                  width: toPercent(bounds.width, CAMP_MAP_IMAGE.width)
                };

                return (
                  <Pressable
                    accessibilityLabel={
                      interactiveSquares === "all"
                        ? `Open grid square ${square.label}`
                        : `Show event info for grid square ${square.label}`
                    }
                    accessibilityRole="button"
                    hitSlop={interactiveSquares === "all" ? 0 : 18}
                    key={`${square.key}-target`}
                    onPress={() => onGridSquarePress(square)}
                    style={[
                      styles.pressTarget,
                      interactiveSquares === "highlighted" && styles.highlightPressTarget,
                      markerStyle
                    ]}
                  />
                );
              })
            : null}
        </View>
        {campInfo ? <CampInfoOverlay info={campInfo} /> : null}
      </View>
    </View>
  );
}

function CampInfoOverlay({
  info
}: {
  info: {
    camps: string[];
    onCampPress: (camp: string) => void;
    onClose: () => void;
    square: GridSquareRef;
  };
}) {
  const squareBounds = getGridSquareBounds(info.square);
  const anchor = getGridSquareCenter(info.square);
  const isBelowAnchor = anchor.yPercent < 50;
  const squareTopPercent = (squareBounds.y / CAMP_MAP_IMAGE.height) * 100;
  const squareBottomPercent = ((squareBounds.y + squareBounds.height) / CAMP_MAP_IMAGE.height) * 100;
  const horizontalPlacement = getBubbleHorizontalPlacement(anchor.xPercent);

  return (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.campInfoMarker,
          {
            left: toPercent(anchor.xPercent, 100),
            top: toPercent(anchor.yPercent, 100)
          }
        ]}
      />
      <View
        style={[
          styles.campInfoBubble,
          isBelowAnchor ? { top: toPercent(squareBottomPercent, 100) } : { bottom: toPercent(100 - squareTopPercent, 100) },
          horizontalPlacement.style
        ]}
      >
        <View style={styles.campInfoHeader}>
          <View style={styles.campInfoList}>
            {info.camps.map((camp) => (
              <Pressable accessibilityRole="button" key={camp} onPress={() => info.onCampPress(camp)} style={styles.campInfoButton}>
                <Text numberOfLines={2} style={styles.campInfoButtonText}>
                  {camp}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityLabel="Close camp info"
            accessibilityRole="button"
            hitSlop={8}
            onPress={info.onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>x</Text>
          </Pressable>
        </View>
      </View>
    </>
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

function getGridSquareCenter(square: GridSquareRef) {
  const bounds = getGridSquareBounds(square);

  return {
    xPercent: ((bounds.x + bounds.width / 2) / CAMP_MAP_IMAGE.width) * 100,
    yPercent: ((bounds.y + bounds.height / 2) / CAMP_MAP_IMAGE.height) * 100
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBubbleHorizontalPlacement(anchorXPercent: number) {
  const estimatedWidthPercent = 24;

  if (anchorXPercent < 22) {
    return {
      style: { left: "2%" as const },
      leftPercent: 2,
      widthPercent: estimatedWidthPercent
    };
  }

  if (anchorXPercent > 78) {
    return {
      style: { right: "2%" as const },
      leftPercent: 100 - estimatedWidthPercent - 2,
      widthPercent: estimatedWidthPercent
    };
  }

  const leftPercent = clamp(anchorXPercent - estimatedWidthPercent / 2, 2, 100 - estimatedWidthPercent - 2);

  return {
    style: { left: toPercent(leftPercent, 100) },
    leftPercent,
    widthPercent: estimatedWidthPercent
  };
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
  campMarker: {
    backgroundColor: "rgba(189, 243, 212, 0.42)",
    borderColor: theme.colors.brandWarm,
    borderRadius: 2,
    borderWidth: 2,
    pointerEvents: "none",
    position: "absolute",
    zIndex: 1
  },
  campInfoButton: {
    alignItems: "center",
    backgroundColor: theme.surfaces.input,
    borderColor: theme.colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 148,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  campInfoButtonText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
    textAlign: "center"
  },
  campInfoHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center"
  },
  campInfoList: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    justifyContent: "center",
    maxWidth: 156
  },
  campInfoBubble: {
    backgroundColor: theme.surfaces.cardStrong,
    borderColor: theme.colors.border,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 190,
    paddingHorizontal: 7,
    paddingVertical: 6,
    position: "absolute",
    zIndex: 4
  },
  campInfoMarker: {
    backgroundColor: theme.colors.pink,
    borderColor: theme.colors.brandDark,
    borderRadius: 3,
    borderWidth: 1,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    position: "absolute",
    transform: [{ rotate: "45deg" }],
    width: 12,
    zIndex: 3
  },
  closeButton: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    width: 22
  },
  closeButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 16
  },
  eventCellHighlight: {
    alignItems: "center",
    backgroundColor: "rgba(211, 255, 0, 0.44)",
    borderColor: "rgba(249, 255, 164, 1)",
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: "center",
    position: "absolute",
    shadowColor: "#d6ff00",
    shadowOffset: {
      width: 0,
      height: 0
    },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    zIndex: 2
  },
  eventCellLabel: {
    color: "#152100",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.3,
    textShadowColor: "rgba(255, 255, 255, 0.55)",
    textShadowOffset: {
      width: 0,
      height: 0
    },
    textShadowRadius: 2
  },
  eventGuide: {
    backgroundColor: "rgba(211, 255, 0, 0.26)",
    position: "absolute",
    zIndex: 1
  },
  eventGuideColumn: {
    borderLeftColor: "rgba(247, 255, 149, 0.9)",
    borderLeftWidth: 1.5,
    borderRightColor: "rgba(247, 255, 149, 0.9)",
    borderRightWidth: 1.5
  },
  eventGuideRow: {
    borderBottomColor: "rgba(247, 255, 149, 0.9)",
    borderBottomWidth: 1.5,
    borderTopColor: "rgba(247, 255, 149, 0.9)",
    borderTopWidth: 1.5
  },
  marker: {
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    position: "absolute",
    zIndex: 2
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
  pressTarget: {
    backgroundColor: "transparent",
    position: "absolute",
    zIndex: 3
  },
  highlightPressTarget: {
    minHeight: 24,
    minWidth: 24
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
