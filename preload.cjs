const { contextBridge, ipcRenderer } = require("electron");

const api = {
  listMedia: () => ipcRenderer.invoke("media:list"),
  addFolder: () => ipcRenderer.invoke("media:add-folder"),
  getMedia: (mediaId) => ipcRenderer.invoke("media:get", mediaId),
  updateTags: (mediaId, tags) =>
    ipcRenderer.invoke("media:update-tags", { mediaId, tags }),
  listTags: () => ipcRenderer.invoke("tags:list"),
};

// Expose the IPC bridge into the renderer
contextBridge.exposeInMainWorld("electronApi", api);

// Fallback for non-isolated contexts (defensive; contextIsolation is enabled)
if (!process.contextIsolated) {
  window.electronApi = api;
}
