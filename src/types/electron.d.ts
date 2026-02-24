import type {
  MediaListResponse,
  AddFolderResponse,
  NormalizedMedia,
  UpdateTagsResponse,
  UpdateDescriptionResponse,
  DeleteMediaResponse,
  Tag,
} from './media';

export interface ElectronApi {
  listMedia: () => Promise<MediaListResponse>;
  addFolder: () => Promise<AddFolderResponse>;
  getMedia: (mediaId: number) => Promise<NormalizedMedia | null>;
  updateTags: (mediaId: number, tags: string[]) => Promise<UpdateTagsResponse>;
  updateDescription: (mediaId: number, description: string) => Promise<UpdateDescriptionResponse>;
  deleteMedia: (mediaId: number) => Promise<DeleteMediaResponse>;
  listTags: () => Promise<Tag[]>;
}

declare global {
  interface Window {
    electronApi?: ElectronApi;
  }
}

export {};
