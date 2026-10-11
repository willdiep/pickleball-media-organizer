import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import { categoryLabel, type MediaCategory } from "@/lib/categories";
import type {
  AddFolderResponse,
  DeleteMediaResponse,
  LibraryRoot,
  MediaListResponse,
  NormalizedMedia,
  Tag,
  UpdateDescriptionResponse,
  UpdateTagsResponse,
} from "@/types/media";

type MediaRow = Omit<NormalizedMedia, "fileUrl">;

// WebKitGTK's media pipeline does not play Tauri `asset://` URLs. Photos still
// use the asset protocol. Videos are streamed from the loopback server in
// src-tauri/src/media_server.rs, which only serves imported folders.
const VIDEO_ORIGIN = "http://127.0.0.1:17421";

function withFileUrl(media: MediaRow): NormalizedMedia {
  const photoSource = media.previewPath || media.filepath;
  const fileUrl =
    media.mediatype === "VIDEO"
      ? `${VIDEO_ORIGIN}/media?path=${encodeURIComponent(media.filepath)}`
      : convertFileSrc(photoSource);
  return {
    ...media,
    fileUrl,
  };
}

export async function listMedia(): Promise<MediaListResponse> {
  const result = await invoke<{
    media: MediaRow[];
    tags: Tag[];
    roots: LibraryRoot[];
  }>("list_media");
  return {
    media: result.media.map(withFileUrl),
    tags: result.tags,
    roots: result.roots,
  };
}

export async function addFolder(
  category: MediaCategory
): Promise<AddFolderResponse> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: `Add ${categoryLabel(category)} folder`,
  });
  if (typeof selected !== "string") {
    return { imported: 0, alreadyPresent: 0, skipped: 0 };
  }

  const result = await invoke<{
    imported: number;
    alreadyPresent: number;
    skipped: number;
    media: MediaRow[];
    tags: Tag[];
    roots: LibraryRoot[];
  }>("ingest_folder", { directory: selected, category });

  return {
    imported: result.imported,
    alreadyPresent: result.alreadyPresent,
    skipped: result.skipped,
    media: result.media.map(withFileUrl),
    tags: result.tags,
    roots: result.roots,
  };
}

export async function rescanRoot(rootId: number): Promise<AddFolderResponse> {
  const result = await invoke<{
    imported: number;
    alreadyPresent: number;
    skipped: number;
    missing: number;
    media: MediaRow[];
    tags: Tag[];
    roots: LibraryRoot[];
  }>("rescan_root", { rootId });
  return {
    imported: result.imported,
    alreadyPresent: result.alreadyPresent,
    skipped: result.skipped,
    missing: result.missing,
    media: result.media.map(withFileUrl),
    tags: result.tags,
    roots: result.roots,
  };
}

export async function removeRoot(rootId: number): Promise<DeleteMediaResponse> {
  const result = await invoke<{
    media: MediaRow[];
    tags: Tag[];
    roots: LibraryRoot[];
  }>("remove_root", { rootId });
  return {
    media: result.media.map(withFileUrl),
    tags: result.tags,
    roots: result.roots,
  };
}

export async function revealMedia(mediaId: number): Promise<void> {
  await invoke("reveal_media", { mediaId });
}

export async function updateTags(
  mediaId: number,
  tags: string[]
): Promise<UpdateTagsResponse> {
  const result = await invoke<{ media: MediaRow; tags: Tag[] }>("update_tags", {
    mediaId,
    tags,
  });
  return { media: withFileUrl(result.media), tags: result.tags };
}

export async function updateDescription(
  mediaId: number,
  description: string
): Promise<UpdateDescriptionResponse> {
  const result = await invoke<{ media: MediaRow }>("update_description", {
    mediaId,
    description,
  });
  return { media: withFileUrl(result.media) };
}

export async function deleteAllMedia(): Promise<DeleteMediaResponse> {
  const result = await invoke<{
    media: MediaRow[];
    tags: Tag[];
    roots: LibraryRoot[];
  }>("delete_all_media");
  return {
    media: result.media.map(withFileUrl),
    tags: result.tags,
    roots: result.roots,
  };
}

export async function deleteMedia(mediaId: number): Promise<DeleteMediaResponse> {
  const result = await invoke<{
    media: MediaRow[];
    tags: Tag[];
    roots: LibraryRoot[];
  }>("delete_media", { mediaId });
  return {
    media: result.media.map(withFileUrl),
    tags: result.tags,
    roots: result.roots,
  };
}
