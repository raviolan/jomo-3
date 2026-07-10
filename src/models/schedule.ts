export type FestivalEventId = string;

export type GridColumn =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";

export type GridRow =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27;

export type GridSquareKey = `${GridColumn}${GridRow}`;

export interface GridSquareRef {
  column: GridColumn;
  row: GridRow;
  key: GridSquareKey;
  label: string;
}

export type FestivalCategory =
  | "Art/Installation"
  | "Care/Support/Pampering"
  | "Crafting/Pimping/Arting"
  | "Food/Drinks"
  | "Games/Play"
  | "Music/Performance/Show"
  | "Party/Gathering"
  | "Ritual/Ceremony"
  | "Workshop/Class"
  | "Yoga/Movement/Bodywork"
  | "Other";

export type FestivalTag =
  | "Kids friendly"
  | "Adults only"
  | "Queer-focused"
  | "Queer-inclusive"
  | "Sensory content"
  | "Sex positive"
  | "Sober"
  | "Triggering themes";

export type FestivalCampListingType = FestivalCategory | "Camp";

export interface FestivalDay {
  id: string;
  label: string;
  date: string;
  sortKey: string;
}

export interface FestivalLocation {
  name: string;
  area?: string;
  gridSquare?: string;
  notes?: string;
}

export interface EventTimeRange {
  start: string;
  end: string;
  crossesMidnight: boolean;
  display: string;
}

export interface FestivalEvent {
  id: FestivalEventId;
  title: string;
  dayId: string;
  date: string;
  time: EventTimeRange;
  category: FestivalCategory;
  hosts?: string[];
  host?: string;
  campHosts?: string[];
  campHost?: string;
  location: FestivalLocation;
  gridSquares?: GridSquareRef[];
  tags: FestivalTag[];
  description: string;
  source: {
    pdf: string;
    page: number;
  };
}

export interface FestivalCampListing {
  id: string;
  name: string;
  type: FestivalCampListingType;
  location: FestivalLocation;
  gridSquares?: GridSquareRef[];
  tags: FestivalTag[];
  description: string;
  source: {
    pdf: string;
    page: number;
  };
}

export interface NormalizedSchedule {
  generatedAt: string;
  sourcePdf: string;
  days: FestivalDay[];
  events: FestivalEvent[];
  campListings: FestivalCampListing[];
}

export interface SavedEventState {
  savedEventIds: FestivalEventId[];
  savedCampHosts: string[];
  hiddenEventIds: FestivalEventId[];
  updatedAt: string;
}
