import React, { useEffect, useMemo, useState } from "react";

const TagBadge = ({ name }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
    <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
    {name}
  </span>
);

const MediaRow = ({ media, onSelect }) => {
  const tagNames = media.tags?.map((t) => t.name) ?? [];
  return (
    <button
      onClick={() => onSelect(media)}
      className="group flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          {media.mediatype === "VIDEO" ? "🎬" : "📸"}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {media.filename}
          </div>
          <div className="text-xs text-slate-500 truncate max-w-[460px]">
            {media.filepath}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {tagNames.length ? (
              tagNames.map((name) => <TagBadge key={name} name={name} />)
            ) : (
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                No tags
              </span>
            )}
          </div>
        </div>
      </div>
      <span className="text-xs font-medium text-emerald-600 opacity-0 transition group-hover:opacity-100">
        View & Tag
      </span>
    </button>
  );
};

const MediaModal = ({ media, onClose, onSave }) => {
  const [tagInput, setTagInput] = useState("");
  const [tagList, setTagList] = useState([]);
  const fileUrl = media ? encodeURI(`file://${media.filepath}`) : "";

  useEffect(() => {
    if (media?.tags) {
      setTagList(media.tags.map((t) => t.name));
    }
  }, [media]);

  const addTagFromInput = () => {
    const raw = tagInput.trim().toLowerCase();
    if (!raw) return;
    if (!tagList.includes(raw)) {
      setTagList([...tagList, raw]);
    }
    setTagInput("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTagFromInput();
    }
  };

  const removeTag = (tag) => {
    setTagList(tagList.filter((t) => t !== tag));
  };

  const saveTags = async () => {
    await onSave(media.id, tagList);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Preview
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              {media.filename}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-auto p-6 md:grid-cols-2">
          <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {media.mediatype === "PHOTO" ? (
              <img
                src={fileUrl}
                className="h-full w-full rounded-xl object-contain bg-white"
                alt={media.filename}
              />
            ) : (
              <video
                src={fileUrl}
                controls
                className="h-full w-full rounded-xl bg-black"
              />
            )}
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Filepath
              </p>
              <p className="break-all text-sm text-slate-800">
                {media.filepath}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tagList.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-xs text-emerald-700 hover:text-emerald-900"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {!tagList.length && (
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  No tags yet
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add tag (press Enter or comma)"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                onClick={addTagFromInput}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              >
                Add
              </button>
            </div>
            <div className="mt-auto flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={saveTags}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Save Tags
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ tags, selectedTag, onSelectTag }) => (
  <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white/60 p-4 backdrop-blur">
    <div className="mb-6 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Library</p>
        {/* <h1 className="text-xl font-bold text-slate-900">
          Pickleball Media
        </h1> */}
      </div>
      {/* <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        All
      </span> */}
    </div>
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          Views
        </p>
        <button
          onClick={() => onSelectTag("all")}
          className={`mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${
            selectedTag === "all"
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <span>All Media</span>
        </button>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          Categories
        </p>
        <div className="mt-2 space-y-2">
          {tags.length === 0 && (
            <p className="text-xs text-slate-400">No tags yet.</p>
          )}
          {tags.map((tag) => (
            <button
              key={tag.name}
              onClick={() => onSelectTag(tag.name)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${
                selectedTag === tag.name
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="capitalize">{tag.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  </aside>
);

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
        console.warn("Electron bridge not available. Are you running in Electron?");
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
        console.error("Electron bridge not available. Run the app via Electron to add folders.");
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

  const handleSaveTags = async (mediaId, tagList) => {
    if (!window.electronApi?.updateTags) {
      console.error("Electron bridge not available. Cannot save tags.");
      return;
    }
    const result = await window.electronApi.updateTags(mediaId, tagList);
    if (result?.media) {
      setMedia((prev) =>
        prev.map((m) => (m.id === mediaId ? result.media : m))
      );
      setTags(result.tags || tags);
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
            <h2 className="text-xl font-semibold text-slate-900">
              Gallery
            </h2>
            {!hasBridge && (
              <p className="mt-1 text-xs text-amber-600">
                Electron bridge not detected. Start the app via Electron to use native dialogs.
              </p>
            )}
          </div>
          <button
            onClick={handleAddFolder}
            disabled={isAdding}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <span className="text-lg">＋</span>
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
            <div className="space-y-3">
              {filteredMedia.map((item) => (
                <MediaRow
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
          onSave={handleSaveTags}
        />
      )}
    </div>
  );
};

export default App;
