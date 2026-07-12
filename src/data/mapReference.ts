import type { ImageSourcePropType } from "react-native";
import { createGridSquareRef } from "@/lib/mapGrid";
import type { GridSquareRef } from "@/models/schedule";

export interface MapMarkerOffset {
  x: number;
  y: number;
}

export interface MapPlaza {
  markerOffset?: MapMarkerOffset;
  name: string;
  number: number;
  square: GridSquareRef;
}

export const MAP_PLAZAS: readonly MapPlaza[] = [
  { number: 1, name: "Pamper plaza", square: createGridSquareRef("Q", 6), markerOffset: { x: -0.68, y: 0.66 } },
  { number: 2, name: "Penta plaza", square: createGridSquareRef("N", 11), markerOffset: { x: -0.38, y: 0.86 } },
  { number: 3, name: "Bayt-al-Noor plaza", square: createGridSquareRef("P", 10), markerOffset: { x: 0.15, y: 0.82 } },
  { number: 4, name: "Snacktown plaza", square: createGridSquareRef("Q", 10), markerOffset: { x: 0.28, y: 0.82 } },
  { number: 5, name: "Lowlands plaza", square: createGridSquareRef("R", 12), markerOffset: { x: -0.08, y: 0.45 } },
  { number: 6, name: "Fire plaza", square: createGridSquareRef("T", 17), markerOffset: { x: -0.28, y: 1.2 } },
  { number: 7, name: "Earth plaza", square: createGridSquareRef("U", 19), markerOffset: { x: -0.72, y: 1.18 } },
  { number: 8, name: "Water plaza", square: createGridSquareRef("R", 18), markerOffset: { x: -0.45, y: 1.65 } },
  { number: 9, name: "Cuddle plaza", square: createGridSquareRef("S", 21), markerOffset: { x: -0.68, y: 1.65 } },
  { number: 10, name: "Sunset plaza", square: createGridSquareRef("N", 22), markerOffset: { x: 0.98, y: 1.55 } },
  { number: 11, name: "Shameless plaza", square: createGridSquareRef("O", 21), markerOffset: { x: -0.05, y: 0.82 } },
  { number: 12, name: "Captain's plaza", square: createGridSquareRef("L", 22), markerOffset: { x: -0.56, y: 2.05 } },
  { number: 13, name: "Lakeside plaza", square: createGridSquareRef("H", 21), markerOffset: { x: -0.35, y: 1.55 } }
] as const;

export interface MapServiceLocation {
  id: string;
  image: ImageSourcePropType;
  label: string;
  squares: GridSquareRef[];
}

export const MAP_SERVICE_LOCATIONS: readonly MapServiceLocation[] = [
  {
    id: "toilets",
    image: require("../../assets/toilets.png"),
    label: "Toilets",
    squares: [
      createGridSquareRef("F", 7),
      createGridSquareRef("L", 5),
      createGridSquareRef("Q", 8),
      createGridSquareRef("M", 14),
      createGridSquareRef("M", 21),
      createGridSquareRef("P", 19),
      createGridSquareRef("S", 21)
    ]
  },
  {
    id: "water",
    image: require("../../assets/water.png"),
    label: "Water",
    squares: [createGridSquareRef("J", 21), createGridSquareRef("L", 21)]
  },
  {
    id: "info-point",
    image: require("../../assets/infopoint.png"),
    label: "Info point",
    squares: [createGridSquareRef("K", 20)]
  },
  {
    id: "trash-recycling",
    image: require("../../assets/trash.png"),
    label: "Trash / recycling",
    squares: [createGridSquareRef("N", 15)]
  },
  {
    id: "sanctuary",
    image: require("../../assets/sanctuary.png"),
    label: "Sanctuary",
    squares: [createGridSquareRef("L", 14)]
  },
  {
    id: "threshold-gate",
    image: require("../../assets/threshold.png"),
    label: "Threshold / gate",
    squares: [createGridSquareRef("K", 4)]
  }
] as const;
