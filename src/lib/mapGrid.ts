import type { GridColumn, GridRow, GridSquareRef } from "@/models/schedule";

export interface MapGridBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapGridGeometry {
  columnGuides: readonly number[];
  rowGuides: readonly number[];
}

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
  width: 767,
  height: 795,
  rotationDegrees: -11
} as const;

export const CAMP_MAP_GRID_BOUNDS: MapGridBounds = {
  x: 0,
  y: 0,
  width: CAMP_MAP_IMAGE.width,
  height: CAMP_MAP_IMAGE.height
} as const;

export const CAMP_MAP_GRID_GEOMETRY = createUniformGridGeometry(CAMP_MAP_GRID_BOUNDS);

// Page-2 is close to uniform, but the crop trims the far edges enough that a single divided
// rectangle drifts across the map. Use explicit guide lines for plaza-mode calibration.
export const INFO_PLAZA_MAP_GRID_GEOMETRY: MapGridGeometry = {
  columnGuides: [
    0, 32, 62, 92, 122, 152, 182, 212, 243, 273, 303, 333, 363, 393, 423, 453, 483, 513, 543, 573, 603, 633, 663,
    694, 724, 754, 767
  ],
  rowGuides: [
    0, 28, 60, 92, 124, 153, 183, 213, 242, 272, 301, 330, 360, 389, 419, 448, 478, 507, 536, 566, 595, 624, 654,
    683, 712, 742, 771, 795
  ]
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

export function getAdjacentGridSquares(square: GridSquareRef): GridSquareRef[] {
  const columnIndex = GRID_COLUMNS.indexOf(square.column);

  return [-1, 0, 1].flatMap((columnOffset) =>
    [-1, 0, 1]
      .filter((rowOffset) => columnOffset !== 0 || rowOffset !== 0)
      .map((rowOffset) => {
        const column = GRID_COLUMNS[columnIndex + columnOffset];
        const row = square.row + rowOffset;

        if (!column || !isGridRow(row)) {
          return undefined;
        }

        return createGridSquareRef(column, row);
      })
      .filter(isDefinedGridSquare)
  );
}

export function getGridSquareBounds(square: GridSquareRef, gridGeometry: MapGridGeometry = CAMP_MAP_GRID_GEOMETRY) {
  const columnIndex = GRID_COLUMNS.indexOf(square.column);
  const rowIndex = GRID_ROWS.indexOf(square.row);
  const x = gridGeometry.columnGuides[columnIndex];
  const nextX = gridGeometry.columnGuides[columnIndex + 1];
  const y = gridGeometry.rowGuides[rowIndex];
  const nextY = gridGeometry.rowGuides[rowIndex + 1];

  return {
    x,
    y,
    width: nextX - x,
    height: nextY - y
  };
}

export function getGridRowBounds(square: GridSquareRef, gridGeometry: MapGridGeometry = CAMP_MAP_GRID_GEOMETRY) {
  const rowIndex = GRID_ROWS.indexOf(square.row);
  const y = gridGeometry.rowGuides[rowIndex];
  const nextY = gridGeometry.rowGuides[rowIndex + 1];

  return {
    x: gridGeometry.columnGuides[0],
    y,
    width: gridGeometry.columnGuides[gridGeometry.columnGuides.length - 1] - gridGeometry.columnGuides[0],
    height: nextY - y
  };
}

export function getGridColumnBounds(square: GridSquareRef, gridGeometry: MapGridGeometry = CAMP_MAP_GRID_GEOMETRY) {
  const columnIndex = GRID_COLUMNS.indexOf(square.column);
  const x = gridGeometry.columnGuides[columnIndex];
  const nextX = gridGeometry.columnGuides[columnIndex + 1];

  return {
    x,
    y: gridGeometry.rowGuides[0],
    width: nextX - x,
    height: gridGeometry.rowGuides[gridGeometry.rowGuides.length - 1] - gridGeometry.rowGuides[0]
  };
}

function createUniformGridGeometry(bounds: MapGridBounds): MapGridGeometry {
  return {
    columnGuides: Array.from({ length: GRID_COLUMNS.length + 1 }, (_, index) =>
      index === GRID_COLUMNS.length ? bounds.x + bounds.width : bounds.x + (bounds.width / GRID_COLUMNS.length) * index
    ),
    rowGuides: Array.from({ length: GRID_ROWS.length + 1 }, (_, index) =>
      index === GRID_ROWS.length ? bounds.y + bounds.height : bounds.y + (bounds.height / GRID_ROWS.length) * index
    )
  };
}

function isGridColumn(value: string): value is GridColumn {
  return gridColumnSet.has(value);
}

function isGridRow(value: number): value is GridRow {
  return gridRowSet.has(value);
}

function isDefinedGridSquare(value: GridSquareRef | undefined): value is GridSquareRef {
  return value !== undefined;
}
