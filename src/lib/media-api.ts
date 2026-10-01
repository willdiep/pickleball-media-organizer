import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import type {
  AddFolderResponse,
  DeleteMediaResponse,
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
  const fileUrl =
    media.mediatype === "VIDEO"
      ? `${VIDEO_ORIGIN}/media?path=${encodeURIComponent(media.filepath)}`
      : convertFileSrc(media.filepath);
  return {
    ...media,
    fileUrl,
  };
}

export async function listMedia(): Promise<MediaListResponse> {
  const result = await invoke<{ media: MediaRow[]; tags: Tag[] }>("list_media");
  return {
    media: result.media.map(withFileUrl),
    tags: result.tags,
  };
}

export async function addFolder(): Promise<AddFolderResponse> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Add media folder",
  });
  if (typeof selected !== "string") {
    return { imported: 0, skipped: 0 };
  }

  const result = await invoke<{
    imported: number;
    skipped: number;
    media: MediaRow[];
    tags: Tag[];
  }>("ingest_folder", { directory: selected });

  return {
    imported: result.imported,
    skipped: result.skipped,
    media: result.media.map(withFileUrl),
    tags: result.tags,
  };
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

export async function deleteMedia(mediaId: number): Promise<DeleteMediaResponse> {
  const result = await invoke<{ media: MediaRow[]; tags: Tag[] }>(
    "delete_media",
    { mediaId }
  );
  return {
    media: result.media.map(withFileUrl),
    tags: result.tags,
  };
}
