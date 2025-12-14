import { useEffect, useMemo, useState } from "react";
import Sidebar from "./Sidebar"
import MediaCard from "./MediaCard"
import MediaModal from "./MediaModal"

const App = () => {
  const [media, setMedia] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const hasBridge = Boolean(window?.electronApi);

  const loadMedia = async () => {
    setIsLoading(true);
    try {
      if (!window.electronApi?.listMedia) {
        console.warn(
          "Electron bridge not available. Are you running in Electron?"
        );
        return;
      }
      const result = await window.electronApi.listMedia();
      setMedia(result.media || []);
      setTags(result.tags || []);
    } catch (error) {
      console.error("Failed to load media", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  const filteredMedia = useMemo(() => {
    if (selectedTag === "all") return media;
    return media.filter((item) =>
      item.tags?.some((tag) => tag.name === selectedTag)
    );
  }, [media, selectedTag]);

  const handleAddFolder = async () => {
    setIsAdding(true);
    try {
      if (!window.electronApi?.addFolder) {
        console.error(
          "Electron bridge not available. Run the app via Electron to add folders."
        );
        return;
      }
      const result = await window.electronApi.addFolder();
      if (result.media) {
        setMedia(result.media);
        setTags(result.tags || tags);
      }
    } catch (error) {
      console.error("Failed to add folder", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveMetadata = async (mediaId, tagList, description) => {
    const canUpdateTags = typeof window.electronApi?.updateTags === "function";
    const canUpdateDescription =
      typeof window.electronApi?.updateDescription === "function";

    if (!canUpdateTags && !canUpdateDescription) {
      console.error("Electron bridge not available. Cannot save changes.");
      return;
    }

    try {
      const tagResult = canUpdateTags
        ? await window.electronApi.updateTags(mediaId, tagList)
        : null;
      const descriptionResult = canUpdateDescription
        ? await window.electronApi.updateDescription(mediaId, description)
        : null;

      const latestMedia = descriptionResult?.media || tagResult?.media;
      const updatedTags = tagResult?.tags || tags;

      if (latestMedia) {
        setMedia((prev) =>
          prev.map((m) => (m.id === mediaId ? latestMedia : m))
        );
        setSelectedMedia(latestMedia);
      }
      setTags(updatedTags);
    } catch (error) {
      console.error("Failed to save changes", error);
    }
  };

  const handleDeleteMedia = async () => {
    if (!selectedMedia) return;
    if (typeof window.electronApi?.deleteMedia !== "function") {
      console.error("Electron bridge not available. Cannot delete media.");
      return;
    }

    try {
      const result = await window.electronApi.deleteMedia(selectedMedia.id);
      if (result?.media) setMedia(result.media);
      if (result?.tags) setTags(result.tags);
      setSelectedMedia(null);
    } catch (error) {
      console.error("Failed to delete media", error);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar
        tags={tags}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
      />
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-6 py-4 backdrop-blur">
          <div>
            {/* <p className="text-xs uppercase tracking-wide text-slate-500">
              Main Gallery
            </p> */}
            {/* <h2 className="text-xl font-semibold text-slate-900"> */}
            <h2 className="text-xl uppercase tracking-wide text-slate-500">
              Gallery
            </h2>
            {!hasBridge && (
              <p className="mt-1 text-xs text-amber-600">
                Electron bridge not detected. Start the app via Electron to use
                native dialogs.
              </p>
            )}
          </div>
          <button
            onClick={handleAddFolder}
            disabled={isAdding}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {/* <span className="text-lg">＋</span> */}
            {isAdding ? "Loading..." : "Add Folder"}
          </button>
        </header>
        <section className="flex-1 overflow-auto px-6 py-4 scrollbar-light">
          {isLoading ? (
            <div className="mt-10 text-center text-slate-500">
              Loading media...
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-10">
              <div className="text-3xl">🟢</div>
              <p className="text-sm font-semibold text-slate-700">
                No media found
              </p>
              <p className="text-sm text-slate-500">
                Import a folder to start organizing your pickleball highlights.
              </p>
              <button
                onClick={handleAddFolder}
                className="mt-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Add Folder
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredMedia.map((item) => (
                <MediaCard
                  key={item.id}
                  media={item}
                  onSelect={(media) => setSelectedMedia(media)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      {selectedMedia && (
        <MediaModal
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onSave={handleSaveMetadata}
          onDelete={handleDeleteMedia}
        />
      )}
    </div>
  );
};

export default App;
