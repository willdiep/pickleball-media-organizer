import type { NormalizedMedia } from "@/types/media";

export interface GalleryEntry {
  key: string;
  title: string;
  grouped: boolean;
  items: NormalizedMedia[];
}

export type GallerySort = "newest" | "oldest" | "name-asc" | "name-desc";

export type MediaTypeFilter = "all" | "PHOTO" | "VIDEO";

export interface LibraryFilters {
  selectedTag: string | null;
  mediaType: MediaTypeFilter;
  query: string;
}

export function folderName(groupPath: string): string {
  const parts = pathParts(groupPath);
  return parts[parts.length - 1] ?? groupPath;
}

function timestampMillis(
  value: NormalizedMedia["createdAt"] | string | number | null | undefined
): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (Number.isFinite(numeric)) return numeric;
  }
  const normalized = text.includes("T") ? text : `${text.replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function librarySortMillis(item: NormalizedMedia): number {
  if (item.fileModifiedAt) {
    const parsed = timestampMillis(item.fileModifiedAt);
    if (parsed > 0) return parsed;
  }
  return timestampMillis(item.createdAt);
}

export function formatLibraryTime(value: string): string {
  const parsed = timestampMillis(value);
  if (!parsed) return value;
  return new Date(parsed).toLocaleString();
}

function byFilename(a: NormalizedMedia, b: NormalizedMedia): number {
  return a.filename.localeCompare(b.filename) || a.id - b.id;
}

function pathParts(value: string): string[] {
  return value.split(/[/\\]/).filter(Boolean);
}

function parentFolderName(groupPath: string): string | null {
  const parts = pathParts(groupPath);
  if (parts.length < 2) return null;
  return parts[parts.length - 2] ?? null;
}

export function itemMatchesQuery(item: NormalizedMedia, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const groupPath = item.groupPath?.trim() ?? "";
  const folder = groupPath ? folderName(groupPath) : "";
  const fields = [
    item.filename,
    item.description ?? "",
    folder,
    ...(item.tags ?? []).map((tag) => tag.name),
  ];
  return fields.some((field) => field.toLowerCase().includes(needle));
}

export function filterMedia(
  media: NormalizedMedia[],
  filters: LibraryFilters
): NormalizedMedia[] {
  const query = filters.query.trim();
  return media.filter((item) => {
    if (
      filters.selectedTag &&
      filters.selectedTag !== "all" &&
      !item.tags?.some((tag) => tag.name === filters.selectedTag)
    ) {
      return false;
    }
    if (
      (filters.mediaType === "PHOTO" || filters.mediaType === "VIDEO") &&
      item.mediatype !== filters.mediaType
    ) {
      return false;
    }
    if (query && !itemMatchesQuery(item, query)) return false;
    return true;
  });
}

export function shouldClearSearch(key: string, query: string, inputFocused: boolean): boolean {
  return inputFocused && key === "Escape" && query.length > 0;
}

export type LibraryGridState = "loading" | "empty" | "no-matches" | "grid";

export function libraryGridState(
  loading: boolean,
  mediaCount: number,
  visibleCount: number
): LibraryGridState {
  if (loading) return "loading";
  if (mediaCount === 0) return "empty";
  if (visibleCount === 0) return "no-matches";
  return "grid";
}

function clampDescription(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 100) return `${trimmed.slice(0, 100)}...`;
  return trimmed;
}

export function groupCardDescription(
  items: NormalizedMedia[],
  grouped: boolean
): string {
  if (!grouped || items.length <= 1) {
    return clampDescription(items[0]?.description ?? "");
  }
  const descriptions = items
    .map((item) => item.description?.trim() ?? "")
    .filter((value) => value.length > 0);
  if (descriptions.length === 0) return "";
  if (new Set(descriptions).size === 1) return clampDescription(descriptions[0]);
  return `${clampDescription(descriptions[0])} and ${descriptions.length - 1} more`;
}

export function buildGalleryEntries(
  media: NormalizedMedia[],
  sort: GallerySort = "newest"
): GalleryEntry[] {
  const groups = new Map<string, NormalizedMedia[]>();
  const singles: NormalizedMedia[] = [];

  for (const item of media) {
    const groupPath = item.groupPath?.trim();
    if (groupPath) {
      const list = groups.get(groupPath);
      if (list) {
        list.push(item);
      } else {
        groups.set(groupPath, [item]);
      }
    } else {
      singles.push(item);
    }
  }

  const entries: GalleryEntry[] = [];
  for (const [groupPath, groupItems] of groups) {
    entries.push({
      key: `group:${groupPath}`,
      title: folderName(groupPath),
      grouped: true,
      items: [...groupItems].sort(byFilename),
    });
  }

  for (const item of singles) {
    entries.push({
      key: `media:${item.id}`,
      title: item.filename,
      grouped: false,
      items: [item],
    });
  }

  const titleCounts = new Map<string, number>();
  for (const entry of entries) {
    titleCounts.set(entry.title, (titleCounts.get(entry.title) ?? 0) + 1);
  }
  for (const entry of entries) {
    if ((titleCounts.get(entry.title) ?? 0) < 2 || !entry.grouped) continue;
    const groupPath = entry.key.slice("group:".length);
    const parent = parentFolderName(groupPath);
    if (!parent) continue;
    entry.title = `${folderName(groupPath)} (${parent})`;
  }

  const entryTime = (entry: GalleryEntry) =>
    Math.max(...entry.items.map((item) => librarySortMillis(item)));

  entries.sort((a, b) => {
    if (sort === "name-asc" || sort === "name-desc") {
      const byTitle =
        sort === "name-asc"
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      return byTitle || a.items[0].id - b.items[0].id;
    }
    const delta =
      sort === "oldest" ? entryTime(a) - entryTime(b) : entryTime(b) - entryTime(a);
    return delta || a.title.localeCompare(b.title);
  });

  return entries;
}
