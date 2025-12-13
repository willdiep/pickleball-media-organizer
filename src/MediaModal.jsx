import { useEffect, useMemo, useState, useRef } from "react";
import VideoJS from "./VideoJS";

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

  const videoJsOptions = useMemo(
    () => ({
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
    }),
    [fileUrl]
  );

  // Explicit container sizing so the player can fill it without relying on Video.js fluid/aspect sizing
  const videoContainerStyle = useMemo(
    () => ({
      aspectRatio: "9 / 16",
      height: "90vh",
      maxHeight: "90vh",
      maxWidth: "min(90vw, calc(90vh * 9 / 16))",
    }),
    []
  );

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
      <div className="flex w-auto max-w-[90vw] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl max-h-screen">
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
        <div className="grid grid-cols-1 items-start gap-4 overflow-auto md:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex items-center justify-center rounded-2xl">
            <div className="flex w-full items-center justify-center">
              {media.mediatype === "PHOTO" ? (
                <img
                  src={fileUrl}
                  className="h-[80vh] w-full bg-white object-contain shadow-sm"
                  alt={media.filename}
                />
              ) : (
                <div
                  className="overflow-hidden bg-black shadow-sm cursor-pointer"
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
          <div className="flex flex-col gap-4 rounded-2xl bg-white py-4 pr-4 h-full">
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
                className="h-40 resize-y border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
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

export default MediaModal;