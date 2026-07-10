import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type ViewStyle
} from "react-native";

import {
  ALL_GRID_SQUARES,
  CAMP_MAP_IMAGE,
  GRID_COLUMNS,
  GRID_ROWS,
  createGridSquareRef,
  getGridColumnBounds,
  getGridRowBounds,
  getGridSquareBounds
} from "@/lib/mapGrid";
import type { GridSquareRef } from "@/models/schedule";
import { theme } from "@/theme/theme";

const campgroundMapImage = require("../../assets/maps/campground-map-grid-2026.png") as ImageSourcePropType;
const GRID_LABEL_GUTTER_X = 34;
const GRID_LABEL_GUTTER_Y = 28;

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
  mode?: "static" | "scrollable";
  onGridSquarePress?: (gridSquare: GridSquareRef) => void;
  showGridLabels?: boolean;
}

export function CampMap({
  campHighlightSquares = [],
  campInfo,
  highlightedSquares,
  interactiveSquares = "highlighted",
  mode = "static",
  onGridSquarePress,
  showGridLabels = mode === "scrollable"
}: CampMapProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const labels = highlightedSquares.map((square) => square.label).join(", ");
  const isEventDetailHighlightMode = interactiveSquares === "highlighted";
  const pressableSquares =
    onGridSquarePress && interactiveSquares === "all" ? ALL_GRID_SQUARES : highlightedSquares;
  const scrollViewportHeight = useMemo(
    () => Math.min(Math.max(windowHeight * 0.64, 360), 720),
    [windowHeight]
  );

  const mapOverlay = (
    <>
      {campHighlightSquares.map((square) => (
        <View
          key={`camp-${square.key}`}
          pointerEvents="none"
          style={[styles.campMarker, getMapRectStyle(getGridSquareBounds(square), mode)]}
        />
      ))}
      {highlightedSquares.map((square) => {
        const cellStyle = getMapRectStyle(getGridSquareBounds(square), mode);
        const rowStyle = getMapRectStyle(getGridRowBounds(square), mode);
        const columnStyle = getMapRectStyle(getGridColumnBounds(square), mode);

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
                  onPress={() => onGridSquarePress(square)}
                  style={[styles.eventCellHighlight, cellStyle]}
                >
                  <Text style={styles.eventCellLabel}>{square.label}</Text>
                </Pressable>
              ) : (
                <View pointerEvents="none" style={[styles.eventCellHighlight, cellStyle]}>
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
        ? pressableSquares.map((square) => (
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
                getMapRectStyle(getGridSquareBounds(square), mode)
              ]}
            />
          ))
        : null}
      {campInfo ? <CampInfoOverlay info={campInfo} mode={mode} /> : null}
    </>
  );

  return (
    <View style={styles.container}>
      {highlightedSquares.length > 0 ? (
        <View style={styles.header}>
          <Text style={styles.title}>Show on map</Text>
          <Text style={styles.refs}>{labels}</Text>
        </View>
      ) : null}
      {mode === "scrollable" ? (
        <View style={[styles.frameBase, styles.scrollMapFrame, { height: scrollViewportHeight }]}>
          {showGridLabels ? (
            <>
              <View pointerEvents="none" style={styles.gridCorner} />
              <View pointerEvents="none" style={styles.columnViewport}>
                <View style={[styles.columnTrack, { transform: [{ translateX: -scrollX }] }]}>
                  {GRID_COLUMNS.map((column) => {
                    const square = createGridSquareRef(column, 1);
                    const bounds = getGridColumnBounds(square);
                    return (
                      <View key={column} style={[styles.columnLabelBox, getAxisLabelStyle(bounds, "column")]}>
                        <Text style={styles.axisLabelText}>{column}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View pointerEvents="none" style={styles.rowViewport}>
                <View style={[styles.rowTrack, { transform: [{ translateY: -scrollY }] }]}>
                  {GRID_ROWS.map((row) => {
                    const square = createGridSquareRef("A", row);
                    const bounds = getGridRowBounds(square);
                    return (
                      <View key={row} style={[styles.rowLabelBox, getAxisLabelStyle(bounds, "row")]}>
                        <Text style={styles.axisLabelText}>{row}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          ) : null}
          <ScrollView
            horizontal
            contentContainerStyle={styles.horizontalScrollContent}
            nestedScrollEnabled
            onScroll={(event) => setScrollX(event.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator
            style={[styles.horizontalScroll, showGridLabels && styles.horizontalScrollWithLabels]}
          >
            <View style={{ width: CAMP_MAP_IMAGE.width }}>
              <ScrollView
                contentContainerStyle={{ height: CAMP_MAP_IMAGE.height }}
                nestedScrollEnabled
                onScroll={(event) => setScrollY(event.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator
                style={styles.verticalScroll}
              >
                <View style={styles.pixelMapCanvas}>
                  <Image source={campgroundMapImage} style={styles.pixelMapImage} />
                  <View pointerEvents="box-none" style={styles.markerLayer}>
                    {mapOverlay}
                  </View>
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      ) : (
        <View style={[styles.frameBase, styles.staticMapFrame]}>
          <Image source={campgroundMapImage} style={styles.mapImage} resizeMode="contain" />
          <View pointerEvents="box-none" style={styles.markerLayer}>
            {mapOverlay}
          </View>
        </View>
      )}
    </View>
  );
}

function CampInfoOverlay({
  info,
  mode
}: {
  info: {
    camps: string[];
    onCampPress: (camp: string) => void;
    onClose: () => void;
    square: GridSquareRef;
  };
  mode: "static" | "scrollable";
}) {
  const squareBounds = getGridSquareBounds(info.square);
  const anchor = getGridSquareCenter(info.square, mode);
  const isBelowAnchor = anchor.yPercent < 50;
  const squareTopValue = mode === "scrollable" ? squareBounds.y : (squareBounds.y / CAMP_MAP_IMAGE.height) * 100;
  const squareBottomValue =
    mode === "scrollable"
      ? squareBounds.y + squareBounds.height
      : ((squareBounds.y + squareBounds.height) / CAMP_MAP_IMAGE.height) * 100;
  const horizontalPlacement = getBubbleHorizontalPlacement(anchor.xPercent, mode);

  return (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.campInfoMarker,
          mode === "scrollable"
            ? { left: anchor.xValue, top: anchor.yValue }
            : {
                left: toPercent(anchor.xPercent, 100),
                top: toPercent(anchor.yPercent, 100)
              }
        ]}
      />
      <View
        style={[
          styles.campInfoBubble,
          isBelowAnchor
            ? mode === "scrollable"
              ? { top: squareBottomValue }
              : { top: toPercent(squareBottomValue, 100) }
            : mode === "scrollable"
              ? { bottom: CAMP_MAP_IMAGE.height - squareTopValue }
              : { bottom: toPercent(100 - squareTopValue, 100) },
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

function getMapRectStyle(bounds: { x: number; y: number; width: number; height: number }, mode: "static" | "scrollable"): ViewStyle {
  if (mode === "scrollable") {
    return {
      height: bounds.height,
      left: bounds.x,
      top: bounds.y,
      width: bounds.width
    };
  }

  return {
    height: toPercent(bounds.height, CAMP_MAP_IMAGE.height),
    left: toPercent(bounds.x, CAMP_MAP_IMAGE.width),
    top: toPercent(bounds.y, CAMP_MAP_IMAGE.height),
    width: toPercent(bounds.width, CAMP_MAP_IMAGE.width)
  };
}

function getAxisLabelStyle(bounds: { x: number; y: number; width: number; height: number }, axis: "column" | "row"): ViewStyle {
  return axis === "column"
    ? {
        left: bounds.x,
        width: bounds.width
      }
    : {
        height: bounds.height,
        top: bounds.y
      };
}

function toPercent(value: number, total: number): `${number}%` {
  return `${(value / total) * 100}%`;
}

function getGridSquareCenter(square: GridSquareRef, mode: "static" | "scrollable") {
  const bounds = getGridSquareBounds(square);
  const xValue = bounds.x + bounds.width / 2;
  const yValue = bounds.y + bounds.height / 2;

  return {
    xPercent: (xValue / CAMP_MAP_IMAGE.width) * 100,
    xValue,
    yPercent: (yValue / CAMP_MAP_IMAGE.height) * 100,
    yValue
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBubbleHorizontalPlacement(anchorXPercent: number, mode: "static" | "scrollable") {
  const estimatedWidthPercent = mode === "scrollable" ? (190 / CAMP_MAP_IMAGE.width) * 100 : 24;

  if (anchorXPercent < 22) {
    return {
      style: mode === "scrollable" ? ({ left: 12 } as const) : ({ left: "2%" } as const)
    };
  }

  if (anchorXPercent > 78) {
    return {
      style: mode === "scrollable" ? ({ right: 12 } as const) : ({ right: "2%" } as const)
    };
  }

  const leftPercent = clamp(anchorXPercent - estimatedWidthPercent / 2, 2, 100 - estimatedWidthPercent - 2);
  return {
    style: mode === "scrollable" ? { left: (leftPercent / 100) * CAMP_MAP_IMAGE.width } : { left: toPercent(leftPercent, 100) }
  };
}

const styles = StyleSheet.create({
  axisLabelText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 15,
    textAlign: "center"
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
  campMarker: {
    backgroundColor: "rgba(189, 243, 212, 0.42)",
    borderColor: theme.colors.brandWarm,
    borderRadius: 2,
    borderWidth: 2,
    pointerEvents: "none",
    position: "absolute",
    zIndex: 1
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
  columnLabelBox: {
    alignItems: "center",
    height: GRID_LABEL_GUTTER_Y,
    justifyContent: "center",
    position: "absolute",
    top: 0
  },
  columnTrack: {
    height: GRID_LABEL_GUTTER_Y,
    position: "relative",
    width: CAMP_MAP_IMAGE.width
  },
  columnViewport: {
    backgroundColor: "rgba(250, 245, 239, 0.94)",
    borderBottomColor: theme.colors.borderSoft,
    borderBottomWidth: 1,
    height: GRID_LABEL_GUTTER_Y,
    left: GRID_LABEL_GUTTER_X,
    overflow: "hidden",
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 5
  },
  container: {
    backgroundColor: theme.surfaces.card,
    borderColor: theme.colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 12
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
  gridCorner: {
    backgroundColor: "rgba(250, 245, 239, 0.94)",
    borderBottomColor: theme.colors.borderSoft,
    borderBottomWidth: 1,
    borderRightColor: theme.colors.borderSoft,
    borderRightWidth: 1,
    height: GRID_LABEL_GUTTER_Y,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    width: GRID_LABEL_GUTTER_X,
    zIndex: 6
  },
  header: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between"
  },
  highlightPressTarget: {
    minHeight: 24,
    minWidth: 24
  },
  horizontalScroll: {
    flex: 1
  },
  horizontalScrollContent: {
    minWidth: "100%"
  },
  horizontalScrollWithLabels: {
    marginLeft: GRID_LABEL_GUTTER_X,
    marginTop: GRID_LABEL_GUTTER_Y
  },
  frameBase: {
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
  pixelMapCanvas: {
    backgroundColor: theme.colors.backgroundFallback,
    height: CAMP_MAP_IMAGE.height,
    position: "relative",
    width: CAMP_MAP_IMAGE.width
  },
  pixelMapImage: {
    height: CAMP_MAP_IMAGE.height,
    width: CAMP_MAP_IMAGE.width
  },
  pressTarget: {
    backgroundColor: "transparent",
    position: "absolute",
    zIndex: 3
  },
  refs: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "900"
  },
  rowLabelBox: {
    alignItems: "center",
    justifyContent: "center",
    left: 0,
    position: "absolute",
    width: GRID_LABEL_GUTTER_X
  },
  rowTrack: {
    height: CAMP_MAP_IMAGE.height,
    position: "relative",
    width: GRID_LABEL_GUTTER_X
  },
  rowViewport: {
    backgroundColor: "rgba(250, 245, 239, 0.94)",
    borderRightColor: theme.colors.borderSoft,
    borderRightWidth: 1,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    pointerEvents: "none",
    position: "absolute",
    top: GRID_LABEL_GUTTER_Y,
    width: GRID_LABEL_GUTTER_X,
    zIndex: 5
  },
  scrollMapFrame: {
    minHeight: 360
  },
  staticMapFrame: {
    aspectRatio: CAMP_MAP_IMAGE.width / CAMP_MAP_IMAGE.height
  },
  title: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  verticalScroll: {
    height: "100%"
  }
});
