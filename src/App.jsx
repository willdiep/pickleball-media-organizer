import { useEffect, useMemo, useState, useRef } from "react";
import VideoJS from "./VideoJS";

const VIDEO = "VIDEO";
const PHOTO = "PHOTO";

const TagBadge = ({ name }) => (
  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
    {name}
  </span>
);

const MediaCard = ({ media, onSelect }) => {
  const tagNames = media.tags?.map((t) => t.name) ?? [];
  const description =
    media.description && media.description.length > 100
      ? `${media.description.slice(0, 100)}...`
      : media.description;
  const fileUrl =
    media?.fileUrl ?? (media ? encodeURI(`file://${media.filepath}`) : "");

  return (
    <button
      onClick={() => onSelect(media)}
      className="group h-full flex-col rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-200 hover:shadow-md inline-flex"
    >
      <div className="w-full flex flex-col gap-3">
        <div className="relative w-full overflow-hidden rounded-t-xl border border-slate-200 bg-slate-100 aspect-video">
          {media.mediatype === VIDEO ? (
            <video
              src={fileUrl}
              muted
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <img
              src={fileUrl}
              alt={media.filename}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover bg-white"
            />
          )}
        </div>
      </div>
      <div className="p-4 flex flex-col justify-between h-44">
        <div>
          <div className="text-sm font-semibold text-slate-900 break-all">
            {media.filename}
          </div>
          {description ? (
            <p className="text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tagNames.length ? (
            tagNames.map((name) => <TagBadge key={name} name={name} />)
          ) : (
            <span className="text-[11px] uppercase tracking-wide text-slate-400">
              No tags
            </span>
          )}
        </div>
        {/* <div className="mt-3 flex items-center justify-between text-xs text-emerald-600 opacity-0 transition group-hover:opacity-100">
        <span>View</span>
        <span>{media.mediatype === "VIDEO" ? "Video" : "Photo"}</span>
      </div> */}
      </div>
    </button>
  );
};

const MediaModal = ({ media, onClose, onSave }) => {
  const [tagInput, setTagInput] = useState("");
  const [tagList, setTagList] = useState([]);
  const [description, setDescription] = useState("");
  const fileUrl =
    media?.fileUrl ?? (media ? encodeURI(`file://${media.filepath}`) : "");

  useEffect(() => {
    if (media?.tags) {
      setTagList(media.tags.map((t) => t.name));
    }
    setDescription(media?.description ?? "");
  }, [media]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
    await onSave(media.id, tagList, description);
    onClose();
  };

  const playerRef = useRef(null);

  const videoJsOptions = {
    // autoplay: true,
    controls: true,
    responsive: false,
    fluid: false,
    fill: true,
    sources: [
      {
        src: fileUrl,
        type: "video/mp4",
      },
    ],
  };

  // Explicit container sizing so the player can fill it without relying on Video.js fluid/aspect sizing
  const videoContainerStyle = {
    aspectRatio: "9 / 16",
    height: "80vh",
    maxHeight: "80vh",
    width: "min(80vw, calc(80vh * 9 / 16))",
  };

  const handlePlayerReady = (player) => {
    playerRef.current = player;

    // You can handle player events here, for example:
    player.on("waiting", () => {
      console.log("player is waiting");
    });

    player.on("dispose", () => {
      console.log("player will dispose");
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      {/* <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"> */}
      <div className="flex w-auto max-w-[90vw] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[90vh]">
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
        <div className="grid grid-cols-1 items-start gap-6 overflow-auto p-6 md:grid-cols-[minmax(0,1fr)_320px]">
          {/* <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4"> */}
          <div className="flex items-center justify-center rounded-2xl">
            <div className="flex w-full items-center justify-center">
              {media.mediatype === PHOTO ? (
                <img
                  src={fileUrl}
                  className="max-h-[75vh] w-auto max-w-full rounded-xl bg-white object-contain shadow-sm"
                  alt={media.filename}
                />
              ) : (
                <div
                  className="overflow-hidden rounded-xl bg-black shadow-sm"
                  style={videoContainerStyle}
                >
                  <VideoJS
                    options={videoJsOptions}
                    onReady={handlePlayerReady}
                    className="h-full w-full"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl bg-white">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Filepath
              </p>
              <p className="break-all text-sm text-slate-800">
                {media.filepath}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Description
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                className="min-h-40 resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
              />
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
                Save Changes
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
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Library
        </p>
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
        />
      )}
    </div>
  );
};

export default App;
