import {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  KeyboardEvent,
} from "react";

import VideoJS from "@/components/VideoJS";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input"

import type Player from "video.js/dist/types/player";
import type { NormalizedMedia } from "@/types/media";

interface MediaModalProps {
  media: NormalizedMedia;
  onClose: () => void;
  onSave: (
    mediaId: number,
    tagList: string[],
    description: string
  ) => Promise<void>;
  onDelete: () => Promise<void>;
}

const MediaModal = ({ media, onClose, onSave, onDelete }: MediaModalProps) => {
  const [tagInput, setTagInput] = useState("");
  const [tagList, setTagList] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const fileUrl =
    media?.fileUrl ?? (media ? encodeURI(`file://${media.filepath}`) : "");

  const mediaFilename =
    media.filename && media.filename.length >= 80
      ? `${media.filename.slice(0, 80)}...`
      : media.filename;

  useEffect(() => {
    if (media?.tags) {
      setTagList(media.tags.map((t) => t.name));
    }
    setDescription(media?.description ?? "");
  }, [media]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
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

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTagFromInput();
    }
  };

  const removeTag = (tag: string) => {
    setTagList(tagList.filter((t) => t !== tag));
  };

  const saveTags = async () => {
    await onSave(media.id, tagList, description);
    onClose();
  };

  const playerRef = useRef<Player | null>(null);

  const videoJsOptions = useMemo(
    () => ({
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

  const handlePlayerReady = useCallback((player: Player) => {
    playerRef.current = player;

    // You can handle player events here, for example:
    player.on("waiting", () => {
      console.log("player is waiting");
    });

    player.on("dispose", () => {
      console.log("player will dispose");
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="flex w-auto max-w-[90vw] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl max-h-screen">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-500">
              Preview
            </Label>
            <h2 className="text-lg text-slate-900">
              {mediaFilename}
            </h2>
          </div>
          <Button
            onClick={onClose}
            className="bg-slate-100 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200"
          >
            Close
          </Button>
        </header>
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
          <div className="flex flex-col gap-6 rounded-2xl bg-white py-4 pr-4 h-full">
            <div className="grid gap-2 w-full">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                Filepath
              </Label>
              <p className="break-all text-sm text-slate-800">
                {media.filepath}
              </p>
            </div>

            <section className="grid w-full gap-2">
              <Label
                className="text-xs uppercase tracking-wide text-slate-500"
                htmlFor="description"
              >
                Description
              </Label>
              <Textarea
                placeholder="Add a description"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-40 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-100"
              />
            </section>

            <section className="grid w-full gap-4">
              <Label
                className="text-xs uppercase tracking-wide text-slate-500"
                htmlFor="description"
              >
                TAGS
              </Label>
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
                {/* <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add tag (press Enter or comma)"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                /> */}
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add tag (press Enter or comma)"
                  className="focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                />
                <Button
                  onClick={addTagFromInput}
                  className="bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                >
                  Add
                </Button>
              </div>
            </section>

            <footer className="flex justify-between mt-auto">
              <div>
                <Button
                  onClick={onDelete}
                  variant="destructive"
                  className=""
                >
                  Delete
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="px-4 py-2 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveTags}
                  className="bg-emerald-600 px-4 py-2 text-sm text-white shadow-sm hover:bg-emerald-700"
                >
                  Save Changes
                </Button>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaModal;
