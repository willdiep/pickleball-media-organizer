// @ts-check
const { contextBridge, ipcRenderer } = require("electron");

/**
 * @typedef {import('./src/types/media').MediaListResponse} MediaListResponse
 * @typedef {import('./src/types/media').AddFolderResponse} AddFolderResponse
 * @typedef {import('./src/types/media').NormalizedMedia} NormalizedMedia
 * @typedef {import('./src/types/media').UpdateTagsResponse} UpdateTagsResponse
 * @typedef {import('./src/types/media').UpdateDescriptionResponse} UpdateDescriptionResponse
 * @typedef {import('./src/types/media').DeleteMediaResponse} DeleteMediaResponse
 * @typedef {import('./src/types/media').Tag} Tag
 */

/** @type {import('./src/types/electron').ElectronApi} */
const api = {
  listMedia: () => ipcRenderer.invoke("media:list"),
  addFolder: () => ipcRenderer.invoke("media:add-folder"),
  /** @param {number} mediaId */
  getMedia: (mediaId) => ipcRenderer.invoke("media:get", mediaId),
  /**
   * @param {number} mediaId
   * @param {string[]} tags
   */
  updateTags: (mediaId, tags) =>
    ipcRenderer.invoke("media:update-tags", { mediaId, tags }),
  listTags: () => ipcRenderer.invoke("tags:list"),
  /**
   * @param {number} mediaId
   * @param {string} description
   */
  updateDescription: (mediaId, description) => ipcRenderer.invoke("media:update-description", {mediaId, description}),
  /** @param {number} mediaId */
  deleteMedia: (mediaId) => ipcRenderer.invoke("media:delete", mediaId)
};

// Expose the IPC bridge into the renderer
contextBridge.exposeInMainWorld("electronApi", api);

// Fallback for non-isolated contexts (defensive; contextIsolation is enabled)
if (!process.contextIsolated) {
  window.electronApi = api;
}
