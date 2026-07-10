import { useMemo, useRef, useState, type MutableRefObject } from "react";
import {
  type GestureResponderEvent,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeTouchEvent,
  type LayoutChangeEvent,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as ScrollViewType,
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
const MIN_MAP_ZOOM = 1;
const MAX_MAP_ZOOM = 4;
const PINCH_DISTANCE_THRESHOLD = 8;

type TouchLike = {
  clientX: number;
  clientY: number;
};

type PinchGestureState = {
  initialDistance: number;
  initialScale: number;
  initialScrollX: number;
  initialScrollY: number;
  viewportFocalX: number;
  viewportFocalY: number;
};

type TouchEventPayload = NativeTouchEvent & {
  touches?: TouchLike[];
};

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
  const [zoomScale, setZoomScale] = useState(MIN_MAP_ZOOM);
  const [scrollViewportWidth, setScrollViewportWidth] = useState<number>(CAMP_MAP_IMAGE.width);
  const labels = highlightedSquares.map((square) => square.label).join(", ");
  const isEventDetailHighlightMode = interactiveSquares === "highlighted";
  const pressableSquares =
    onGridSquarePress && interactiveSquares === "all" ? ALL_GRID_SQUARES : highlightedSquares;
  const scrollViewportHeight = useMemo(
    () => Math.min(Math.max(windowHeight * 0.64, 360), 720),
    [windowHeight]
  );
  const horizontalScrollRef = useRef<ScrollViewType | null>(null);
  const verticalScrollRef = useRef<ScrollViewType | null>(null);
  const pinchStateRef = useRef<PinchGestureState | null>(null);
  const pinchHasMovedRef = useRef(false);
  const suppressNextPressRef = useRef(false);
  const scrollableMapWidth = CAMP_MAP_IMAGE.width * zoomScale;
  const scrollableMapHeight = CAMP_MAP_IMAGE.height * zoomScale;
  const horizontalViewportWidth = Math.max(scrollViewportWidth - (showGridLabels ? GRID_LABEL_GUTTER_X : 0), 0);
  const verticalViewportHeight = Math.max(scrollViewportHeight - (showGridLabels ? GRID_LABEL_GUTTER_Y : 0), 0);

  const mapOverlay = (
    <>
      {campHighlightSquares.map((square) => (
        <View
          key={`camp-${square.key}`}
          pointerEvents="none"
          style={[styles.campMarker, getMapRectStyle(getGridSquareBounds(square), mode, zoomScale)]}
        />
      ))}
      {highlightedSquares.map((square) => {
        const cellStyle = getMapRectStyle(getGridSquareBounds(square), mode, zoomScale);
        const rowStyle = getMapRectStyle(getGridRowBounds(square), mode, zoomScale);
        const columnStyle = getMapRectStyle(getGridColumnBounds(square), mode, zoomScale);

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
              onPress={() => {
                if (suppressNextPressRef.current) {
                  suppressNextPressRef.current = false;
                  return;
                }

                onGridSquarePress(square);
              }}
              style={[
                styles.pressTarget,
                interactiveSquares === "highlighted" && styles.highlightPressTarget,
                getMapRectStyle(getGridSquareBounds(square), mode, zoomScale)
              ]}
            />
          ))
        : null}
      {campInfo ? <CampInfoOverlay info={campInfo} mode={mode} scale={zoomScale} /> : null}
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
        <View
          onLayout={(event) => handleScrollFrameLayout(event, showGridLabels, setScrollViewportWidth)}
          onTouchCancel={() => endPinchGesture({ pinchHasMovedRef, pinchStateRef, suppressNextPressRef })}
          onTouchEnd={() => endPinchGesture({ pinchHasMovedRef, pinchStateRef, suppressNextPressRef })}
          onTouchMove={(event) =>
            handlePinchTouchMove(event, {
              horizontalScrollRef,
              horizontalViewportWidth,
              pinchHasMovedRef,
              pinchStateRef,
              setScrollX,
              setScrollY,
              setZoomScale,
              verticalScrollRef,
              verticalViewportHeight
            })
          }
          onTouchStart={(event) =>
            handlePinchTouchStart(event, {
              horizontalViewportWidth,
              pinchHasMovedRef,
              pinchStateRef,
              scrollX,
              scrollY,
              showGridLabels,
              verticalViewportHeight,
              zoomScale
            })
          }
          style={[styles.frameBase, styles.scrollMapFrame, { height: scrollViewportHeight }]}
        >
          {showGridLabels ? (
            <>
              <View pointerEvents="none" style={styles.gridCorner} />
              <View pointerEvents="none" style={styles.columnViewport}>
                <View style={[styles.columnTrack, { transform: [{ translateX: -scrollX }], width: scrollableMapWidth }]}>
                  {GRID_COLUMNS.map((column) => {
                    const square = createGridSquareRef(column, 1);
                    const bounds = getGridColumnBounds(square);
                    return (
                      <View key={column} style={[styles.columnLabelBox, getAxisLabelStyle(bounds, "column", zoomScale)]}>
                        <Text style={styles.axisLabelText}>{column}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View pointerEvents="none" style={styles.rowViewport}>
                <View style={[styles.rowTrack, { height: scrollableMapHeight, transform: [{ translateY: -scrollY }] }]}>
                  {GRID_ROWS.map((row) => {
                    const square = createGridSquareRef("A", row);
                    const bounds = getGridRowBounds(square);
                    return (
                      <View key={row} style={[styles.rowLabelBox, getAxisLabelStyle(bounds, "row", zoomScale)]}>
                        <Text style={styles.axisLabelText}>{row}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          ) : null}
          <ScrollView
            ref={horizontalScrollRef}
            horizontal
            contentContainerStyle={styles.horizontalScrollContent}
            nestedScrollEnabled
            onScroll={(event) => handleHorizontalScroll(event, setScrollX)}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator
            style={[styles.horizontalScroll, showGridLabels && styles.horizontalScrollWithLabels]}
          >
            <View style={{ width: scrollableMapWidth }}>
              <ScrollView
                ref={verticalScrollRef}
                contentContainerStyle={{ height: scrollableMapHeight }}
                nestedScrollEnabled
                onScroll={(event) => handleVerticalScroll(event, setScrollY)}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator
                style={styles.verticalScroll}
              >
                <View style={[styles.pixelMapCanvas, { height: scrollableMapHeight, width: scrollableMapWidth }]}>
                  <Image source={campgroundMapImage} style={[styles.pixelMapImage, { height: scrollableMapHeight, width: scrollableMapWidth }]} />
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
          {showGridLabels ? <StaticGridLabelOverlay /> : null}
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
  mode,
  scale = 1
}: {
  info: {
    camps: string[];
    onCampPress: (camp: string) => void;
    onClose: () => void;
    square: GridSquareRef;
  };
  mode: "static" | "scrollable";
  scale?: number;
}) {
  const squareBounds = getGridSquareBounds(info.square);
  const anchor = getGridSquareCenter(info.square, mode, scale);
  const isBelowAnchor = anchor.yPercent < 50;
  const squareTopValue = mode === "scrollable" ? squareBounds.y * scale : (squareBounds.y / CAMP_MAP_IMAGE.height) * 100;
  const squareBottomValue =
    mode === "scrollable"
      ? (squareBounds.y + squareBounds.height) * scale
      : ((squareBounds.y + squareBounds.height) / CAMP_MAP_IMAGE.height) * 100;
  const horizontalPlacement = getBubbleHorizontalPlacement(anchor.xPercent, mode, scale);

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
              ? { bottom: CAMP_MAP_IMAGE.height * scale - squareTopValue }
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

function StaticGridLabelOverlay() {
  return (
    <View pointerEvents="none" style={styles.staticLabelOverlay}>
      {GRID_COLUMNS.map((column) => {
        const square = createGridSquareRef(column, 1);
        const bounds = getGridColumnBounds(square);
        return (
          <View key={column} style={[styles.staticColumnLabelBox, getStaticAxisLabelStyle(bounds, "column")]}>
            <Text style={styles.axisLabelText}>{column}</Text>
          </View>
        );
      })}
      {GRID_ROWS.map((row) => {
        const square = createGridSquareRef("A", row);
        const bounds = getGridRowBounds(square);
        return (
          <View key={row} style={[styles.staticRowLabelBox, getStaticAxisLabelStyle(bounds, "row")]}>
            <Text style={styles.axisLabelText}>{row}</Text>
          </View>
        );
      })}
    </View>
  );
}

function getAxisLabelStyle(
  bounds: { x: number; y: number; width: number; height: number },
  axis: "column" | "row",
  scale = 1
): ViewStyle {
  return axis === "column"
    ? {
        left: bounds.x * scale,
        width: bounds.width * scale
      }
    : {
        height: bounds.height * scale,
        top: bounds.y * scale
      };
}

function getMapRectStyle(
  bounds: { x: number; y: number; width: number; height: number },
  mode: "static" | "scrollable",
  scale = 1
): ViewStyle {
  if (mode === "scrollable") {
    return {
      height: bounds.height * scale,
      left: bounds.x * scale,
      top: bounds.y * scale,
      width: bounds.width * scale
    };
  }

  return {
    height: toPercent(bounds.height, CAMP_MAP_IMAGE.height),
    left: toPercent(bounds.x, CAMP_MAP_IMAGE.width),
    top: toPercent(bounds.y, CAMP_MAP_IMAGE.height),
    width: toPercent(bounds.width, CAMP_MAP_IMAGE.width)
  };
}

function getStaticAxisLabelStyle(
  bounds: { x: number; y: number; width: number; height: number },
  axis: "column" | "row"
): ViewStyle {
  return axis === "column"
    ? {
        left: toPercent(bounds.x, CAMP_MAP_IMAGE.width),
        width: toPercent(bounds.width, CAMP_MAP_IMAGE.width)
      }
    : {
        height: toPercent(bounds.height, CAMP_MAP_IMAGE.height),
        top: toPercent(bounds.y, CAMP_MAP_IMAGE.height)
      };
}

function handleScrollFrameLayout(
  event: LayoutChangeEvent,
  showGridLabels: boolean,
  setScrollViewportWidth: (width: number) => void
) {
  const gutterWidth = showGridLabels ? GRID_LABEL_GUTTER_X : 0;
  setScrollViewportWidth(Math.max(event.nativeEvent.layout.width, gutterWidth));
}

function handleHorizontalScroll(
  event: NativeSyntheticEvent<NativeScrollEvent>,
  setScrollX: (value: number) => void
) {
  setScrollX(event.nativeEvent.contentOffset.x);
}

function handleVerticalScroll(
  event: NativeSyntheticEvent<NativeScrollEvent>,
  setScrollY: (value: number) => void
) {
  setScrollY(event.nativeEvent.contentOffset.y);
}

function handlePinchTouchStart(
  event: GestureResponderEvent,
  context: {
    horizontalViewportWidth: number;
    pinchHasMovedRef: MutableRefObject<boolean>;
    pinchStateRef: MutableRefObject<PinchGestureState | null>;
    scrollX: number;
    scrollY: number;
    showGridLabels: boolean;
    verticalViewportHeight: number;
    zoomScale: number;
  }
) {
  const touches = getTouchPoints(event);
  if (touches.length !== 2) {
    return;
  }

  const focalPoint = getTouchMidpoint(touches);
  const viewportFocalX = clamp(
    focalPoint.x - (context.showGridLabels ? GRID_LABEL_GUTTER_X : 0),
    0,
    context.horizontalViewportWidth
  );
  const viewportFocalY = clamp(
    focalPoint.y - (context.showGridLabels ? GRID_LABEL_GUTTER_Y : 0),
    0,
    context.verticalViewportHeight
  );

  context.pinchStateRef.current = {
    initialDistance: getTouchDistance(touches[0], touches[1]),
    initialScale: context.zoomScale,
    initialScrollX: context.scrollX,
    initialScrollY: context.scrollY,
    viewportFocalX,
    viewportFocalY
  };
  context.pinchHasMovedRef.current = false;
}

function handlePinchTouchMove(
  event: GestureResponderEvent,
  context: {
    horizontalScrollRef: MutableRefObject<ScrollViewType | null>;
    horizontalViewportWidth: number;
    pinchHasMovedRef: MutableRefObject<boolean>;
    pinchStateRef: MutableRefObject<PinchGestureState | null>;
    setScrollX: (value: number) => void;
    setScrollY: (value: number) => void;
    setZoomScale: (value: number) => void;
    verticalScrollRef: MutableRefObject<ScrollViewType | null>;
    verticalViewportHeight: number;
  }
) {
  const touches = getTouchPoints(event);
  const pinchState = context.pinchStateRef.current;

  if (touches.length !== 2 || !pinchState) {
    return;
  }

  event.preventDefault?.();

  const distance = getTouchDistance(touches[0], touches[1]);
  if (distance <= 0) {
    return;
  }

  if (Math.abs(distance - pinchState.initialDistance) >= PINCH_DISTANCE_THRESHOLD) {
    context.pinchHasMovedRef.current = true;
  }

  const nextScale = clamp((distance / pinchState.initialDistance) * pinchState.initialScale, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
  const contentFocalX = (pinchState.initialScrollX + pinchState.viewportFocalX) / pinchState.initialScale;
  const contentFocalY = (pinchState.initialScrollY + pinchState.viewportFocalY) / pinchState.initialScale;
  const maxScrollX = Math.max(CAMP_MAP_IMAGE.width * nextScale - context.horizontalViewportWidth, 0);
  const maxScrollY = Math.max(CAMP_MAP_IMAGE.height * nextScale - context.verticalViewportHeight, 0);
  const nextScrollX = clamp(contentFocalX * nextScale - pinchState.viewportFocalX, 0, maxScrollX);
  const nextScrollY = clamp(contentFocalY * nextScale - pinchState.viewportFocalY, 0, maxScrollY);

  context.setZoomScale(nextScale);
  context.horizontalScrollRef.current?.scrollTo({ animated: false, x: nextScrollX });
  context.verticalScrollRef.current?.scrollTo({ animated: false, y: nextScrollY });
  context.setScrollX(nextScrollX);
  context.setScrollY(nextScrollY);
}

function endPinchGesture(context: {
  pinchHasMovedRef: MutableRefObject<boolean>;
  pinchStateRef: MutableRefObject<PinchGestureState | null>;
  suppressNextPressRef: MutableRefObject<boolean>;
}) {
  if (context.pinchHasMovedRef.current) {
    context.suppressNextPressRef.current = true;
  }

  context.pinchStateRef.current = null;
  context.pinchHasMovedRef.current = false;
}

function getTouchPoints(event: GestureResponderEvent): TouchLike[] {
  const nativeTouches = (event.nativeEvent as TouchEventPayload).touches;
  return Array.isArray(nativeTouches) ? nativeTouches : [];
}

function getTouchDistance(first: TouchLike, second: TouchLike) {
  const deltaX = first.clientX - second.clientX;
  const deltaY = first.clientY - second.clientY;
  return Math.hypot(deltaX, deltaY);
}

function getTouchMidpoint(touches: TouchLike[]) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

function toPercent(value: number, total: number): `${number}%` {
  return `${(value / total) * 100}%`;
}

function getGridSquareCenter(square: GridSquareRef, mode: "static" | "scrollable", scale = 1) {
  const bounds = getGridSquareBounds(square);
  const xValue = (bounds.x + bounds.width / 2) * scale;
  const yValue = (bounds.y + bounds.height / 2) * scale;
  const xPercent = ((bounds.x + bounds.width / 2) / CAMP_MAP_IMAGE.width) * 100;
  const yPercent = ((bounds.y + bounds.height / 2) / CAMP_MAP_IMAGE.height) * 100;

  return {
    xPercent,
    xValue,
    yPercent,
    yValue
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBubbleHorizontalPlacement(anchorXPercent: number, mode: "static" | "scrollable", scale = 1) {
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
    style:
      mode === "scrollable"
        ? { left: ((leftPercent / 100) * CAMP_MAP_IMAGE.width) * scale }
        : { left: toPercent(leftPercent, 100) }
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
  staticColumnLabelBox: {
    alignItems: "center",
    backgroundColor: "rgba(250, 245, 239, 0.9)",
    borderBottomColor: theme.colors.borderSoft,
    borderBottomWidth: 1,
    justifyContent: "flex-start",
    minHeight: 18,
    paddingTop: 2,
    position: "absolute",
    top: 0,
    zIndex: 4
  },
  staticLabelOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
    zIndex: 4
  },
  staticRowLabelBox: {
    alignItems: "flex-start",
    backgroundColor: "rgba(250, 245, 239, 0.9)",
    borderRightColor: theme.colors.borderSoft,
    borderRightWidth: 1,
    justifyContent: "center",
    left: 0,
    minWidth: 20,
    paddingLeft: 3,
    position: "absolute",
    width: "8.5%",
    zIndex: 4
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
