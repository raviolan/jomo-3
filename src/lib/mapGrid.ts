import type { GridColumn, GridRow, GridSquareRef } from "@/models/schedule";

export const GRID_COLUMNS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z"
] as const satisfies readonly GridColumn[];

export const GRID_ROWS = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27
] as const satisfies readonly GridRow[];

export const CAMP_MAP_IMAGE = {
  width: 842,
  height: 1191,
  rotationDegrees: -11
} as const;

export const CAMP_MAP_GRID_BOUNDS = {
  x: 42,
  y: 122,
  width: 767,
  height: 795
} as const;

export const CAMP_MAP_CELL = {
  width: CAMP_MAP_GRID_BOUNDS.width / GRID_COLUMNS.length,
  height: CAMP_MAP_GRID_BOUNDS.height / GRID_ROWS.length
} as const;

const gridColumnSet = new Set<string>(GRID_COLUMNS);
const gridRowSet = new Set<number>(GRID_ROWS);

export const ALL_GRID_SQUARES = GRID_COLUMNS.flatMap((column) =>
  GRID_ROWS.map((row) => createGridSquareRef(column, row))
);

export function createGridSquareRef(column: GridColumn, row: GridRow): GridSquareRef {
  return {
    column,
    row,
    key: `${column}${row}`,
    label: `${column}${String(row).padStart(2, "0")}`
  };
}

export function parseGridSquareRef(value: string | undefined): GridSquareRef | undefined {
  const match = value?.trim().toUpperCase().match(/^([A-Z])0?(\d{1,2})$/);
  if (!match) {
    return undefined;
  }

  const column = match[1];
  const row = Number(match[2]);

  if (!isGridColumn(column) || !isGridRow(row)) {
    return undefined;
  }

  return createGridSquareRef(column, row);
}

export function getGridSquareBounds(square: GridSquareRef) {
  const columnIndex = GRID_COLUMNS.indexOf(square.column);
  const rowIndex = GRID_ROWS.indexOf(square.row);

  return {
    x: CAMP_MAP_GRID_BOUNDS.x + columnIndex * CAMP_MAP_CELL.width,
    y: CAMP_MAP_GRID_BOUNDS.y + rowIndex * CAMP_MAP_CELL.height,
    width: CAMP_MAP_CELL.width,
    height: CAMP_MAP_CELL.height
  };
}

function isGridColumn(value: string): value is GridColumn {
  return gridColumnSet.has(value);
}

function isGridRow(value: number): value is GridRow {
  return gridRowSet.has(value);
}
