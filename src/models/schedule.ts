export type FestivalEventId = string;

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
  | "Adults only"
  | "Queer-inclusive"
  | "Sensory content"
  | "Sex positive"
  | "Sober"
  | "Triggering themes";

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
  host?: string;
  campHost?: string;
  location: FestivalLocation;
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
}

export interface SavedEventState {
  savedEventIds: FestivalEventId[];
  savedCampHosts: string[];
  hiddenEventIds: FestivalEventId[];
  updatedAt: string;
}
