// Media types aligned with Prisma schema

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
export interface MediaListResponse {
  media: NormalizedMedia[];
  tags: Tag[];
}

export interface AddFolderResponse {
  imported: number;
  skipped: number;
  media?: NormalizedMedia[];
  tags?: Tag[];
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
}
