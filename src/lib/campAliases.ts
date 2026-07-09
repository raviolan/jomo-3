import aliasDefinitions from "@/data/campAliases.json";
import type { FestivalEvent } from "@/models/schedule";

type AliasRecord = Record<string, string[]>;

export interface ResolvedSelectionOption {
  canonicalName: string;
  matchKind: "canonical" | "alias" | "group" | "fuzzy" | "fallback";
  rawLabel: string;
}

export interface ResolvedSelection {
  input: string;
  kind: "exact" | "canonical" | "ambiguous" | "unresolved";
  matches: ResolvedSelectionOption[];
}

const campAliases = aliasDefinitions.campAliases as AliasRecord;
const hostAliases = aliasDefinitions.hostAliases as AliasRecord;
const campGroupAliases = aliasDefinitions.campGroupAliases as AliasRecord;

const metadataSuffixes = [
  "Adults only",
  "Queer",
  "Queer-inclusive",
  "Queer inclusive",
  "Queer - inclusive",
  "Sensory content",
  "Sensory warning",
  "Sensory warnings",
  "Sex positive",
  "Sex-positive",
  "Sexpositive",
  "Sober",
  "Triggering themes",
  "Trigger warning",
  "Trigger warnings",
  "Kid-friendly",
  "Kid friendly",
  "Body-positive",
  "Body positive",
  "Pet-friendly",
  "Pet friendly"
];

const normalizedMetadataSuffixes = metadataSuffixes
  .map((suffix) => normalizeAssociationKey(suffix))
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

const campAliasLookup = createAliasLookup(campAliases);
const hostAliasLookup = createAliasLookup(hostAliases);
const campAliasesByCanonical = createAliasesByCanonical(campAliases);
const hostAliasesByCanonical = createAliasesByCanonical(hostAliases);
const campGroupLookup = new Map(
  Object.entries(campGroupAliases).map(([label, groups]) => [
    normalizeAssociationKey(stripTrailingMetadataFlags(label)),
    dedupeStrings(groups.map(getCanonicalCampHost))
  ])
);

export function normalizeAssociationKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\band\b/g, "and");
}

export function stripTrailingMetadataFlags(value: string): string {
  let current = value.trim();
  let next = stripOneMetadataSuffix(current);

  while (next && next !== current) {
    current = next;
    next = stripOneMetadataSuffix(current);
  }

  return current || value.trim();
}

export function getCanonicalCampHost(rawName: string): string {
  return resolveCanonicalName(rawName, campAliasLookup);
}

export function getCanonicalHost(rawName: string): string {
  return resolveCanonicalName(rawName, hostAliasLookup);
}

export function getCampHostGroups(rawName: string): string[] {
  const normalized = normalizeAssociationKey(stripTrailingMetadataFlags(rawName));
  const directGroups = campGroupLookup.get(normalized);
  if (directGroups?.length) {
    return directGroups;
  }

  return [getCanonicalCampHost(rawName)];
}

export function getCampAliasesForCanonical(canonicalName: string): string[] {
  return campAliasesByCanonical.get(getCanonicalCampHost(canonicalName)) ?? [getCanonicalCampHost(canonicalName)];
}

export function getHostAliasesForCanonical(canonicalName: string): string[] {
  return hostAliasesByCanonical.get(getCanonicalHost(canonicalName)) ?? [getCanonicalHost(canonicalName)];
}

export function getRawCampHostLabelsForEvent(event: Pick<FestivalEvent, "campHosts" | "campHost">): string[] {
  return getRawAssociatedLabels(event.campHosts, event.campHost);
}

export function getRawHostLabelsForEvent(event: Pick<FestivalEvent, "hosts" | "host">): string[] {
  return getRawAssociatedLabels(event.hosts, event.host);
}

export function resolveCampHostSelection(label: string): ResolvedSelection {
  return resolveSelection(label, {
    aliasesByCanonical: campAliasesByCanonical,
    canonicalize: getCanonicalCampHost,
    getGroups: getCampHostGroups
  });
}

export function resolveHostSelection(label: string): ResolvedSelection {
  return resolveSelection(label, {
    aliasesByCanonical: hostAliasesByCanonical,
    canonicalize: getCanonicalHost,
    getGroups: (value) => [getCanonicalHost(value)]
  });
}

function getRawAssociatedLabels(values: string[] | undefined, fallback: string | undefined): string[] {
  const labels = values?.length ? values : fallback ? [fallback] : [];
  const seen = new Set<string>();

  return labels.filter((label) => {
    const normalized = normalizeAssociationKey(label);
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function resolveCanonicalName(rawName: string, aliasLookup: Map<string, string>): string {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return trimmed;
  }

  for (const key of getLookupKeys(trimmed)) {
    const canonical = aliasLookup.get(key);
    if (canonical) {
      return canonical;
    }
  }

  return stripTrailingMetadataFlags(trimmed);
}

function resolveSelection(
  label: string,
  options: {
    aliasesByCanonical: Map<string, string[]>;
    canonicalize: (value: string) => string;
    getGroups: (value: string) => string[];
  }
): ResolvedSelection {
  const trimmed = label.trim();
  if (!trimmed) {
    return { input: label, kind: "unresolved", matches: [] };
  }

  const groups = dedupeStrings(options.getGroups(trimmed));
  if (groups.length > 1) {
    return {
      input: label,
      kind: "ambiguous",
      matches: groups.map((canonicalName) => ({
        canonicalName,
        matchKind: "group" as const,
        rawLabel: trimmed
      }))
    };
  }

  const canonicalName = options.canonicalize(trimmed);
  const canonicalAliases = options.aliasesByCanonical.get(canonicalName);
  if (canonicalAliases?.length) {
    const matchKind = normalizeAssociationKey(trimmed) === normalizeAssociationKey(canonicalName) ? "exact" : "canonical";
    return {
      input: label,
      kind: matchKind,
      matches: [
        {
          canonicalName,
          matchKind: matchKind === "exact" ? "canonical" : "alias",
          rawLabel: trimmed
        }
      ]
    };
  }

  const plausibleMatches = findPlausibleMatches(trimmed, options.aliasesByCanonical);
  if (plausibleMatches.length > 1) {
    return {
      input: label,
      kind: "ambiguous",
      matches: plausibleMatches.map((canonicalValue) => ({
        canonicalName: canonicalValue,
        matchKind: "fuzzy" as const,
        rawLabel: trimmed
      }))
    };
  }

  if (plausibleMatches.length === 1) {
    return {
      input: label,
      kind: "canonical",
      matches: [
        {
          canonicalName: plausibleMatches[0] ?? canonicalName,
          matchKind: "fuzzy",
          rawLabel: trimmed
        }
      ]
    };
  }

  return {
    input: label,
    kind: "unresolved",
    matches: [
      {
        canonicalName,
        matchKind: "fallback",
        rawLabel: trimmed
      }
    ]
  };
}

function createAliasLookup(aliasRecord: AliasRecord): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const [canonicalName, aliases] of Object.entries(aliasRecord)) {
    for (const value of dedupeStrings([canonicalName, ...aliases])) {
      for (const key of getLookupKeys(value)) {
        if (!lookup.has(key)) {
          lookup.set(key, canonicalName);
        }
      }
    }
  }

  return lookup;
}

function createAliasesByCanonical(aliasRecord: AliasRecord): Map<string, string[]> {
  return new Map(
    Object.entries(aliasRecord).map(([canonicalName, aliases]) => [canonicalName, dedupeStrings([canonicalName, ...aliases])])
  );
}

function getLookupKeys(value: string): string[] {
  const trimmed = value.trim();
  const stripped = stripTrailingMetadataFlags(trimmed);

  return dedupeStrings([
    normalizeAssociationKey(trimmed),
    normalizeAssociationKey(stripped)
  ]).filter(Boolean);
}

function stripOneMetadataSuffix(value: string): string {
  const normalized = normalizeAssociationKey(value);
  const matchingSuffix = normalizedMetadataSuffixes.find(
    (suffix) => normalized === suffix || normalized.endsWith(` ${suffix}`)
  );

  if (!matchingSuffix) {
    return value.trim();
  }

  const suffixPattern = metadataSuffixes
    .map((suffix) => suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*[-–—]?\\s*"))
    .join("|");

  return value
    .replace(new RegExp(`(?:\\s*[·,/|-]?\\s*)(?:${suffixPattern})\\s*$`, "i"), "")
    .trim();
}

function findPlausibleMatches(label: string, aliasesByCanonical: Map<string, string[]>): string[] {
  const normalizedLabel = normalizeAssociationKey(stripTrailingMetadataFlags(label));
  if (!normalizedLabel) {
    return [];
  }

  const labelTerms = new Set(normalizedLabel.split(" ").filter(Boolean));
  const matches: string[] = [];

  for (const [canonicalName, aliases] of aliasesByCanonical.entries()) {
    const isMatch = aliases.some((alias) => {
      const normalizedAlias = normalizeAssociationKey(stripTrailingMetadataFlags(alias));
      if (!normalizedAlias) {
        return false;
      }

      if (normalizedAlias.includes(normalizedLabel) || normalizedLabel.includes(normalizedAlias)) {
        return true;
      }

      const aliasTerms = new Set(normalizedAlias.split(" ").filter(Boolean));
      return Array.from(labelTerms).every((term) => aliasTerms.has(term));
    });

    if (isMatch) {
      matches.push(canonicalName);
    }
  }

  return matches.sort((a, b) => a.localeCompare(b));
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeAssociationKey(trimmed);
    if (!trimmed || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(trimmed);
  }

  return deduped;
}
