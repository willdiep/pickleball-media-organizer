import assert from "node:assert/strict";

import { buildGalleryEntries } from "./gallery.ts";

import type { NormalizedMedia } from "../types/media.ts";

function item(
  id: number,
  filename: string,
  createdAt: string,
  fileModifiedAt: string | null
): NormalizedMedia {
  return {
    id,
    uuid: String(id),
    filename,
    filepath: `/library/${filename}`,
    mediatype: "PHOTO",
    description: null,
    groupPath: null,
    category: "pickleball",
    rootId: 1,
    fileModifiedAt,
    fileMissing: false,
    previewPath: null,
    previewUnavailable: false,
    createdAt: createdAt as unknown as Date,
    updatedAt: createdAt as unknown as Date,
    tags: [],
    fileUrl: filename,
  };
}

const entries = buildGalleryEntries([
    item(1, "older-file.png", "2024-06-01 00:00:00", "2019-01-01 00:00:00"),
    item(2, "newer-file.png", "2020-01-01 00:00:00", "2024-01-01 00:00:00"),
    item(3, "imported-only.png", "2021-01-01 00:00:00", null),
  ]);
assert.deepEqual(
  entries.map((entry) => entry.title),
  ["newer-file.png", "imported-only.png", "older-file.png"]
);
