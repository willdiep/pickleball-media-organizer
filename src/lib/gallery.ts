import type { NormalizedMedia } from "@/types/media";

export interface GalleryEntry {
  key: string;
  title: string;
  grouped: boolean;
  items: NormalizedMedia[];
}

export function folderName(groupPath: string): string {
  const parts = groupPath.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? groupPath;
}

function createdMillis(
  value: NormalizedMedia["createdAt"] | string | number
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

function byFilename(a: NormalizedMedia, b: NormalizedMedia): number {
  return a.filename.localeCompare(b.filename) || a.id - b.id;
}

export function buildGalleryEntries(media: NormalizedMedia[]): GalleryEntry[] {
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

  entries.sort((a, b) => {
    const aTime = Math.max(
      ...a.items.map((item) => createdMillis(item.createdAt))
    );
    const bTime = Math.max(
      ...b.items.map((item) => createdMillis(item.createdAt))
    );
    return bTime - aTime || a.title.localeCompare(b.title);
  });

  return entries;
}
