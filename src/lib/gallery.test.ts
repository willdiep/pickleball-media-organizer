import assert from "node:assert/strict";

import {
  buildGalleryEntries,
  filterMedia,
  groupCardDescription,
  libraryGridState,
  shouldClearSearch,
} from "./gallery.ts";

import type { NormalizedMedia, Tag } from "../types/media.ts";

function item(overrides: Partial<NormalizedMedia> & Pick<NormalizedMedia, "id" | "filename">): NormalizedMedia {
  return {
    uuid: String(overrides.id),
    filepath: `/library/${overrides.filename}`,
    mediatype: "PHOTO",
    description: null,
    groupPath: null,
    category: "pickleball",
    rootId: 1,
    fileModifiedAt: null,
    fileMissing: false,
    previewPath: null,
    previewUnavailable: false,
    createdAt: "2020-01-01 00:00:00" as unknown as Date,
    updatedAt: "2020-01-01 00:00:00" as unknown as Date,
    tags: [],
    fileUrl: overrides.filename,
    ...overrides,
  };
}

function tag(name: string): Tag {
  return { id: name.length, name };
}

const library = [
  item({
    id: 1,
    filename: "serve.png",
    description: "Backhand winner",
    groupPath: "/games/morning/rally",
    mediatype: "PHOTO",
    tags: [tag("drill")],
    fileModifiedAt: "2024-01-01 00:00:00",
    createdAt: "2010-01-01 00:00:00" as unknown as Date,
  }),
  item({
    id: 2,
    filename: "overhead.mp4",
    description: "Kitchen volley",
    groupPath: "/games/morning/rally",
    mediatype: "VIDEO",
    tags: [],
    fileModifiedAt: "2018-01-01 00:00:00",
    createdAt: "2025-01-01 00:00:00" as unknown as Date,
  }),
  item({
    id: 3,
    filename: "dink.png",
    description: null,
    groupPath: "/games/evening/rally",
    mediatype: "PHOTO",
    tags: [tag("drill"), tag("match")],
    fileModifiedAt: null,
    createdAt: "2022-01-01 00:00:00" as unknown as Date,
  }),
  item({
    id: 4,
    filename: "notes.txt.png",
    description: "Warmup stretch",
    groupPath: null,
    mediatype: "PHOTO",
    tags: [tag("match")],
    fileModifiedAt: null,
    createdAt: "2021-06-01 00:00:00" as unknown as Date,
  }),
];

const allFilters = { selectedTag: "all", mediaType: "all" as const, query: "" };

function titles(media: NormalizedMedia[], filters = allFilters, sort: "newest" | "oldest" | "name-asc" | "name-desc" = "newest") {
  return buildGalleryEntries(filterMedia(media, filters), sort).map((entry) => entry.title);
}

const byFilename = titles(library, { selectedTag: "all", mediaType: "all", query: "serve" });
assert.deepEqual(byFilename, ["rally"]);
assert.deepEqual(
  buildGalleryEntries(filterMedia(library, { selectedTag: "all", mediaType: "all", query: "serve" }))[0].items.map(
    (entry) => entry.filename
  ),
  ["serve.png"]
);

const byDescription = filterMedia(library, { selectedTag: "all", mediaType: "all", query: "volley" });
assert.deepEqual(byDescription.map((entry) => entry.filename), ["overhead.mp4"]);

const byTag = filterMedia(library, { selectedTag: "all", mediaType: "all", query: "DRILL" });
assert.deepEqual(
  byTag.map((entry) => entry.filename).sort(),
  ["dink.png", "serve.png"]
);

const byFolder = filterMedia(library, { selectedTag: "all", mediaType: "all", query: "rally" });
assert.deepEqual(
  byFolder.map((entry) => entry.filename).sort(),
  ["dink.png", "overhead.mp4", "serve.png"]
);
assert.deepEqual(
  filterMedia(library, { selectedTag: "all", mediaType: "all", query: "morning" }).map((entry) => entry.id),
  []
);

const combined = filterMedia(library, {
  selectedTag: "drill",
  mediaType: "PHOTO",
  query: "backhand",
});
assert.deepEqual(combined.map((entry) => entry.id), [1]);
assert.deepEqual(
  filterMedia(library, { selectedTag: "drill", mediaType: "VIDEO", query: "backhand" }).map((entry) => entry.id),
  []
);
assert.deepEqual(
  filterMedia(library, { selectedTag: "match", mediaType: "PHOTO", query: "" }).map((entry) => entry.id),
  [3, 4]
);

const taggedOnly = buildGalleryEntries(
  filterMedia(library, { selectedTag: "drill", mediaType: "all", query: "" })
);
const morning = taggedOnly.find((entry) => entry.title === "rally (morning)");
assert.ok(morning);
assert.deepEqual(morning.items.map((entry) => entry.filename), ["serve.png"]);
const fullMorning = buildGalleryEntries(library).find((entry) => entry.title === "rally (morning)");
assert.ok(fullMorning);
assert.deepEqual(
  fullMorning.items.map((entry) => entry.filename),
  ["overhead.mp4", "serve.png"]
);

assert.deepEqual(titles(library).filter((title) => title.startsWith("rally")), [
  "rally (morning)",
  "rally (evening)",
]);
assert.equal(
  buildGalleryEntries([
    item({ id: 8, filename: "final.png", groupPath: "/games/sunday/finals" }),
  ])[0].title,
  "finals"
);

const shared = [
  item({ id: 10, filename: "a.png", groupPath: "/set/one", description: "Same point" }),
  item({ id: 11, filename: "b.png", groupPath: "/set/one", description: "Same point" }),
];
assert.equal(
  groupCardDescription(buildGalleryEntries(shared)[0].items, true),
  "Same point"
);

const mixed = [
  item({ id: 12, filename: "a.png", groupPath: "/set/two", description: "Alpha" }),
  item({ id: 13, filename: "b.png", groupPath: "/set/two", description: "Beta" }),
  item({ id: 14, filename: "c.png", groupPath: "/set/two", description: "  " }),
];
assert.equal(
  groupCardDescription(buildGalleryEntries(mixed)[0].items, true),
  "Alpha and 1 more"
);
assert.equal(
  groupCardDescription(
    [
      item({ id: 40, filename: "a.png", description: "q".repeat(140) }),
      item({ id: 41, filename: "b.png", description: "other" }),
    ],
    true
  ),
  `${"q".repeat(100)}... and 1 more`
);

const blank = [
  item({ id: 15, filename: "a.png", groupPath: "/set/three", description: null }),
  item({ id: 16, filename: "b.png", groupPath: "/set/three", description: "   " }),
];
assert.equal(groupCardDescription(buildGalleryEntries(blank)[0].items, true), "");

const longText = "p".repeat(120);
assert.equal(
  groupCardDescription(
    [
      item({ id: 17, filename: "a.png", description: longText }),
      item({ id: 18, filename: "b.png", description: longText }),
    ],
    true
  ),
  `${"p".repeat(100)}...`
);
assert.equal(
  groupCardDescription([item({ id: 19, filename: "solo.png", description: "Only one" })], false),
  "Only one"
);

const timed = [
  item({
    id: 20,
    filename: "file-time.png",
    fileModifiedAt: "2024-01-01 00:00:00",
    createdAt: "2010-01-01 00:00:00" as unknown as Date,
  }),
  item({
    id: 21,
    filename: "import-time.png",
    fileModifiedAt: null,
    createdAt: "2022-01-01 00:00:00" as unknown as Date,
  }),
  item({
    id: 22,
    filename: "older-file.png",
    fileModifiedAt: "2018-01-01 00:00:00",
    createdAt: "2025-01-01 00:00:00" as unknown as Date,
  }),
];
assert.deepEqual(
  buildGalleryEntries(timed, "newest").map((entry) => entry.title),
  ["file-time.png", "import-time.png", "older-file.png"]
);
assert.deepEqual(
  buildGalleryEntries(timed, "oldest").map((entry) => entry.title),
  ["older-file.png", "import-time.png", "file-time.png"]
);
assert.deepEqual(buildGalleryEntries(timed).map((entry) => entry.title), [
  "file-time.png",
  "import-time.png",
  "older-file.png",
]);

const named = [
  item({ id: 31, filename: "b.png" }),
  item({ id: 30, filename: "a.png" }),
  item({ id: 32, filename: "a.png" }),
];
assert.deepEqual(
  buildGalleryEntries(named, "name-asc").map((entry) => entry.items[0].id),
  [30, 32, 31]
);
assert.deepEqual(
  buildGalleryEntries(named, "name-desc").map((entry) => entry.items[0].id),
  [31, 30, 32]
);

assert.equal(libraryGridState(true, 4, 0), "loading");
assert.equal(libraryGridState(false, 0, 0), "empty");
assert.equal(libraryGridState(false, 4, 0), "no-matches");
assert.equal(libraryGridState(false, 4, 2), "grid");

assert.equal(shouldClearSearch("Escape", "rally", true), true);
assert.equal(shouldClearSearch("Escape", "", true), false);
assert.equal(shouldClearSearch("Escape", "rally", false), false);
assert.equal(shouldClearSearch("Enter", "rally", true), false);

const phase2Order = buildGalleryEntries([
  item({
    id: 1,
    filename: "older-file.png",
    createdAt: "2024-06-01 00:00:00" as unknown as Date,
    fileModifiedAt: "2019-01-01 00:00:00",
  }),
  item({
    id: 2,
    filename: "newer-file.png",
    createdAt: "2020-01-01 00:00:00" as unknown as Date,
    fileModifiedAt: "2024-01-01 00:00:00",
  }),
  item({
    id: 3,
    filename: "imported-only.png",
    createdAt: "2021-01-01 00:00:00" as unknown as Date,
    fileModifiedAt: null,
  }),
]);
assert.deepEqual(
  phase2Order.map((entry) => entry.title),
  ["newer-file.png", "imported-only.png", "older-file.png"]
);
