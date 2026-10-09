import { convertFileSrc } from "@tauri-apps/api/core";
import { ChevronLeft, ChevronRight, Film, ImageIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import VideoJS from "@/components/VideoJS";
import { folderName } from "@/lib/gallery";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type Player from "video.js/dist/types/player";
import type { NormalizedMedia } from "@/types/media";

interface MediaModalProps {
  items: NormalizedMedia[];
  onClose: () => void;
  onSave: (
    mediaId: number,
    tagList: string[],
    description: string
  ) => Promise<void>;
  onDelete: (mediaId: number) => Promise<void>;
}

function videoContentType(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "webm":
      return "video/webm";
    case "mov":
    case "m4v":
      return "video/quicktime";
    case "avi":
      return "video/x-msvideo";
    default:
      return "video/mp4";
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
    return true;
  }
  return Boolean(target.closest("video, .video-js"));
}

const MediaModal = ({ items, onClose, onSave, onDelete }: MediaModalProps) => {
  const [tagInput, setTagInput] = useState("");
  const [tagList, setTagList] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const seenIds = useRef("");
  const mounted = useRef(true);

  const current = items[index] ?? items[0];

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const ids = items.map((item) => item.id).join(",");
    if (ids === seenIds.current) return;
    const previous = seenIds.current.split(",").filter(Boolean);
    const subset =
      previous.length > 0 &&
      items.every((item) => previous.includes(String(item.id)));
    seenIds.current = ids;
    if (!subset) {
      setIndex(0);
      return;
    }
    setIndex((value) => Math.min(value, Math.max(items.length - 1, 0)));
  }, [items]);

  useEffect(() => {
    if (!current) return;
    setTagList(current.tags?.map((tag) => tag.name) ?? []);
    setDescription(current.description ?? "");
    setTagInput("");
  }, [current]);

  const step = (direction: -1 | 1) => {
    const count = items.length;
    if (count < 2 || confirmingDelete || isDeleting) return;
    setConfirmingDelete(false);
    setDeleteError(null);
    setIndex((value) => (value + direction + count) % count);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDeleting) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (items.length < 2 || confirmingDelete) return;
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        step(event.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (confirmingDelete) {
        setConfirmingDelete(false);
        setDeleteError(null);
        return;
      }
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [confirmingDelete, isDeleting, items, onClose]);

  const fileUrl = current
    ? current.fileUrl || convertFileSrc(current.filepath)
    : "";
  const mediaFilename = current
    ? current.filename.length >= 80
      ? `${current.filename.slice(0, 80)}...`
      : current.filename
    : "";
  const groupLabel = (() => {
    const path = current?.groupPath;
    if (!path) return null;
    if (!items.every((item) => item.groupPath === path)) return null;
    return folderName(path);
  })();

  const confirmDelete = async () => {
    if (!current) return;
    const mediaId = current.id;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(mediaId);
      if (!mounted.current) return;
      setConfirmingDelete(false);
      setIsDeleting(false);
    } catch (error) {
      if (!mounted.current) return;
      setDeleteError(error instanceof Error ? error.message : String(error));
      setIsDeleting(false);
    }
  };

  const addTagFromInput = () => {
    const raw = tagInput.trim().toLowerCase();
    if (!raw) return;
    setTagList((list) => (list.includes(raw) ? list : [...list, raw]));
    setTagInput("");
  };

  const saveTags = async () => {
    if (!current) return;
    setIsSaving(true);
    try {
      await onSave(current.id, tagList, description);
      if (mounted.current) onClose();
    } finally {
      if (mounted.current) setIsSaving(false);
    }
  };

  const videoJsOptions = useMemo(
    () => ({
      controls: true,
      responsive: false,
      fluid: false,
      fill: true,
      sources: [
        {
          src: fileUrl,
          type: videoContentType(current?.filename ?? ""),
        },
      ],
    }),
    [fileUrl, current?.filename]
  );

  const handlePlayerReady = (instance: Player) => {
    instance.on("waiting", () => {
      console.log("player is waiting");
    });
    instance.on("dispose", () => {
      console.log("player will dispose");
    });
  };

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !confirmingDelete && !isDeleting) onClose();
        }}
      >
        <DialogContent
          data-testid="media-modal"
          className="max-h-[92vh] max-w-5xl gap-0 overflow-hidden p-0"
          onEscapeKeyDown={(event) => {
            if (confirmingDelete || isDeleting) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (confirmingDelete || isDeleting) event.preventDefault();
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4 pr-12">
            <div>
              <DialogDescription className="text-xs font-medium uppercase tracking-wide text-primary">
                {groupLabel ?? "Preview"}
              </DialogDescription>
              <DialogTitle
                data-testid="media-filename"
                className="mt-1 flex items-center gap-2 text-lg"
              >
                {current?.mediatype === "VIDEO" ? (
                  <Film className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                )}
                {mediaFilename}
              </DialogTitle>
            </div>
            {items.length > 1 ? (
              <p
                data-testid="carousel-position"
                className="pt-1 text-sm font-semibold tabular-nums text-muted-foreground"
              >
                {index + 1} / {items.length}
              </p>
            ) : null}
          </div>

          <div className="grid max-h-[calc(92vh-4.5rem)] grid-cols-1 overflow-auto md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative flex min-h-[360px] items-center justify-center bg-court px-14 py-6">
              {items.length > 1 ? (
                <button
                  type="button"
                  data-testid="carousel-prev"
                  aria-label="Previous"
                  className="absolute left-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ball text-ball-foreground shadow-md transition hover:bg-ball/90"
                  onClick={() => step(-1)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              ) : null}
              {current?.mediatype === "PHOTO" ? (
                <img
                  src={fileUrl}
                  alt={current.filename}
                  className="max-h-[62vh] w-full object-contain"
                />
              ) : (
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-sm">
                  <VideoJS
                    key={current?.id}
                    options={videoJsOptions}
                    onReady={handlePlayerReady}
                    className="h-full w-full"
                  />
                </div>
              )}
              {items.length > 1 ? (
                <button
                  type="button"
                  data-testid="carousel-next"
                  aria-label="Next"
                  className="absolute right-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ball text-ball-foreground shadow-md transition hover:bg-ball/90"
                  onClick={() => step(1)}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-5 border-t p-5 md:border-l md:border-t-0">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">File path</p>
                <p
                  data-testid="media-filepath"
                  className="break-all font-mono text-xs leading-relaxed text-foreground"
                >
                  {current?.filepath}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="media-description">Description</Label>
                <Textarea
                  id="media-description"
                  value={description}
                  placeholder="Add a description"
                  className="min-h-28 resize-none"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {tagList.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove ${tag}`}
                        className="rounded-full text-secondary-foreground/70 hover:text-foreground"
                        onClick={() =>
                          setTagList((list) => list.filter((item) => item !== tag))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {tagList.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No tags yet</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={tagInput}
                    placeholder="Add a tag"
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addTagFromInput();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addTagFromInput}>
                    Add
                  </Button>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => void saveTags()} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmingDelete}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setConfirmingDelete(open);
          if (!open) setDeleteError(null);
        }}
      >
        <AlertDialogContent data-testid="delete-media-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this media?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you wish to delete {mediaFilename}? This removes it
              from the library. The file on disk is left in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MediaModal;
