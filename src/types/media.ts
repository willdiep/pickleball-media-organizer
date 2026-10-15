// Media types aligned with Prisma schema

import type { MediaCategory } from "@/lib/categories";

export type MediaType = 'VIDEO' | 'PHOTO';

export interface Tag {
  id: number;
  name: string;
}

export interface MediaTag {
  mediaId: number;
  tagId: number;
  tag: Tag;
}

export interface Media {
  id: number;
  uuid: string;
  filename: string;
  filepath: string;
  mediatype: MediaType;
  description: string | null;
  groupPath: string | null;
  category: MediaCategory;
  rootId: number | null;
  fileModifiedAt: string | null;
  fileMissing: boolean;
  previewPath: string | null;
  previewUnavailable: boolean;
  createdAt: Date;
  updatedAt: Date;
  tags: MediaTag[];
}

// Normalized media returned from IPC with fileUrl added and tags flattened
export interface NormalizedMedia extends Omit<Media, 'tags'> {
  fileUrl: string;
  tags: Tag[];
}

// IPC response types
export interface LibraryRoot {
  id: number;
  path: string;
  mediaCount: number;
}

export interface MediaListResponse {
  media: NormalizedMedia[];
  tags: Tag[];
  roots: LibraryRoot[];
}

export interface IngestProgress {
  scanned: number;
  imported: number;
  alreadyPresent: number;
  skipped: number;
}

export interface AddFolderResponse {
  imported: number;
  alreadyPresent: number;
  skipped: number;
  missing?: number;
  media?: NormalizedMedia[];
  tags?: Tag[];
  roots?: LibraryRoot[];
}

export interface UpdateTagsResponse {
  media: NormalizedMedia;
  tags: Tag[];
}

export interface UpdateDescriptionResponse {
  media: NormalizedMedia;
}

export interface DeleteMediaResponse {
  media: NormalizedMedia[];
  tags: Tag[];
  roots: LibraryRoot[];
}
