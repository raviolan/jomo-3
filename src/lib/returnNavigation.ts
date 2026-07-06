import type { FestivalCategory, FestivalTag } from "@/models/schedule";

export type ReturnContext =
  | {
      category: FestivalCategory | "all";
      isFilterPanelExpanded: boolean;
      query: string;
      route: "home";
      scrollY: number;
      selectedDayId?: string;
      selectedTags: FestivalTag[];
    }
  | {
      query: string;
      route: "camps";
      mode: "index";
      scrollY: number;
    }
  | {
      route: "camps";
      mode: "selected";
      collapsedDayIds: string[];
      campIndexScrollY: number;
      isPastEventsExpanded: boolean;
      query: string;
      scrollY: number;
      selectedCampHosts: string[];
    }
  | {
      route: "saved";
      scrollY: number;
    };

let returnContext: ReturnContext | undefined;

export function setReturnContext(context: ReturnContext) {
  returnContext = context;
}

export function getReturnContext(): ReturnContext | undefined {
  return returnContext;
}

export function clearReturnContext() {
  returnContext = undefined;
}

export function getReturnHref(context: ReturnContext | undefined): "/" | "/saved" | "/?view=camps" {
  if (!context) {
    return "/";
  }

  if (context.route === "saved") {
    return "/saved";
  }

  if (context.route === "camps") {
    return "/?view=camps";
  }

  return "/";
}
