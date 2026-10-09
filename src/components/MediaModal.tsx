import { convertFileSrc } from "@tauri-apps/api/core";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import type { JSX } from "solid-js";

import VideoJS from "@/components/VideoJS";
import { folderName } from "@/lib/gallery";

import { Button } from "@/components/ui/button";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea,
} from "@/components/ui/text-field";

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

const videoContainerStyle = {
  "aspect-ratio": "9 / 16",
  height: "90vh",
  "max-height": "90vh",
  "max-width": "min(90vw, calc(90vh * 9 / 16))",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
    return true;
  }
  return Boolean(target.closest("video, .video-js"));
}

const MediaModal = (props: MediaModalProps) => {
  const [tagInput, setTagInput] = createSignal("");
  const [tagList, setTagList] = createSignal<string[]>([]);
  const [description, setDescription] = createSignal("");
  const [confirmingDelete, setConfirmingDelete] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  const [index, setIndex] = createSignal(0);
  let seenIds = "";

  const current = (): NormalizedMedia | undefined =>
    props.items[index()] ?? props.items[0];

  const fileUrl = () => {
    const item = current();
    if (!item) return "";
    return item.fileUrl || convertFileSrc(item.filepath);
  };

  const mediaFilename = () => {
    const filename = current()?.filename ?? "";
    return filename.length >= 80 ? `${filename.slice(0, 80)}...` : filename;
  };

  const groupLabel = () => {
    const path = current()?.groupPath;
    if (!path) return null;
    if (!props.items.every((item) => item.groupPath === path)) return null;
    return folderName(path);
  };

  const step = (direction: -1 | 1) => {
    const count = props.items.length;
    if (count < 2 || confirmingDelete() || isDeleting()) return;
    setConfirmingDelete(false);
    setDeleteError(null);
    setIndex((value) => (value + direction + count) % count);
  };

  createEffect(() => {
    const ids = props.items.map((item) => item.id).join(",");
    if (ids === seenIds) return;
    const previous = seenIds.split(",").filter(Boolean);
    const subset =
      previous.length > 0 &&
      props.items.every((item) => previous.includes(String(item.id)));
    seenIds = ids;
    if (!subset) {
      setIndex(0);
      return;
    }
    setIndex((value) => Math.min(value, Math.max(props.items.length - 1, 0)));
  });

  createEffect(
    on(
      () => current()?.id,
      () => {
        const item = current();
        if (!item) return;
        setTagList(item.tags?.map((tag) => tag.name) ?? []);
        setDescription(item.description ?? "");
        setTagInput("");
      }
    )
  );

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDeleting()) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        if (props.items.length < 2 || confirmingDelete()) return;
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        step(event.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (confirmingDelete()) {
        setConfirmingDelete(false);
        setDeleteError(null);
        return;
      }
      props.onClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    onCleanup(() =>
      window.removeEventListener("keydown", handleKeyDown, true)
    );
  });

  const confirmDelete = async () => {
    const item = current();
    if (!item) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await props.onDelete(item.id);
      setConfirmingDelete(false);
      setIsDeleting(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : String(error));
      setIsDeleting(false);
    }
  };

  const addTagFromInput = () => {
    const raw = tagInput().trim().toLowerCase();
    if (!raw) return;
    if (!tagList().includes(raw)) {
      setTagList([...tagList(), raw]);
    }
    setTagInput("");
  };

  const handleKeyDown: JSX.EventHandler<HTMLInputElement, KeyboardEvent> = (
    event
  ) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTagFromInput();
    }
  };

  const removeTag = (tag: string) => {
    setTagList(tagList().filter((item) => item !== tag));
  };

  const saveTags = async () => {
    const item = current();
    if (!item) return;
    await props.onSave(item.id, tagList(), description());
    props.onClose();
  };

  const videoJsOptions = createMemo(() => ({
    controls: true,
    responsive: false,
    fluid: false,
    fill: true,
    sources: [
      {
        src: fileUrl(),
        type: videoContentType(current()?.filename ?? ""),
      },
    ],
  }));

  const handlePlayerReady = (instance: Player) => {
    instance.on("waiting", () => {
      console.log("player is waiting");
    });
    instance.on("dispose", () => {
      console.log("player will dispose");
    });
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      data-testid="media-modal"
    >
      <div class="flex max-h-screen w-auto max-w-[90vw] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header class="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500">
              {groupLabel() ?? "Preview"}
            </p>
            <h2
              data-testid="media-filename"
              class="text-lg text-slate-900"
            >
              {mediaFilename()}
            </h2>
          </div>
          <div class="flex items-center gap-3">
            <Show when={props.items.length > 1}>
              <p
                data-testid="carousel-position"
                class="text-sm font-semibold tabular-nums text-slate-600"
              >
                {index() + 1} / {props.items.length}
              </p>
            </Show>
            <Button
              onClick={() => props.onClose()}
              class="bg-slate-100 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200"
            >
              Close
            </Button>
          </div>
        </header>
        <div class="grid grid-cols-1 items-start gap-4 overflow-auto md:grid-cols-[minmax(0,1fr)_400px]">
          <div class="relative flex items-center justify-center rounded-2xl">
            <Show when={props.items.length > 1}>
              <button
                type="button"
                data-testid="carousel-prev"
                aria-label="Previous"
                class="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-2xl leading-none text-slate-800 shadow"
                onClick={() => step(-1)}
              >
                ‹
              </button>
            </Show>
            <div class="flex w-full items-center justify-center">
              <Show when={current()} keyed>
                {(item) => (
                  <Show
                    when={item.mediatype === "PHOTO"}
                    fallback={
                      <div
                        class="cursor-pointer overflow-hidden bg-black shadow-sm"
                        style={videoContainerStyle}
                      >
                        <VideoJS
                          options={videoJsOptions()}
                          onReady={handlePlayerReady}
                          class="h-full w-full"
                        />
                      </div>
                    }
                  >
                    <img
                      src={item.fileUrl || convertFileSrc(item.filepath)}
                      class="h-[80vh] w-full bg-white object-contain shadow-sm"
                      alt={item.filename}
                    />
                  </Show>
                )}
              </Show>
            </div>
            <Show when={props.items.length > 1}>
              <button
                type="button"
                data-testid="carousel-next"
                aria-label="Next"
                class="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-2xl leading-none text-slate-800 shadow"
                onClick={() => step(1)}
              >
                ›
              </button>
            </Show>
          </div>
          <div class="flex h-full flex-col gap-6 rounded-2xl bg-white py-4 pr-4">
            <div class="grid w-full gap-2">
              <p class="text-xs uppercase tracking-wide text-slate-500">
                Filepath
              </p>
              <p
                data-testid="media-filepath"
                class="break-all text-sm text-slate-800"
              >
                {current()?.filepath}
              </p>
            </div>

            <TextField
              class="grid w-full gap-2"
              value={description()}
              onChange={setDescription}
            >
              <TextFieldLabel class="text-xs uppercase tracking-wide text-slate-500">
                Description
              </TextFieldLabel>
              <TextFieldTextArea
                placeholder="Add a description"
                class="h-40 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-100"
              />
            </TextField>

            <section class="grid w-full gap-4">
              <p class="text-xs uppercase tracking-wide text-slate-500">Tags</p>
              <div class="flex flex-wrap gap-2">
                <For each={tagList()}>
                  {(tag) => (
                    <span class="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        class="text-xs text-emerald-700 hover:text-emerald-900"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </For>
                <Show when={tagList().length === 0}>
                  <span class="text-[11px] uppercase tracking-wide text-slate-400">
                    No tags yet
                  </span>
                </Show>
              </div>
              <div class="flex items-center gap-2">
                <TextField
                  class="flex-1"
                  value={tagInput()}
                  onChange={setTagInput}
                >
                  <TextFieldInput
                    placeholder="Add tag (press Enter or comma)"
                    onKeyDown={handleKeyDown}
                    class="focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </TextField>
                <Button
                  onClick={addTagFromInput}
                  class="bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                >
                  Add
                </Button>
              </div>
            </section>

            <footer class="mt-auto flex justify-between">
              <div>
                <Button
                  onClick={() => setConfirmingDelete(true)}
                  variant="destructive"
                >
                  Delete
                </Button>
              </div>
              <div class="flex gap-2">
                <Button
                  onClick={() => props.onClose()}
                  variant="outline"
                  class="px-4 py-2 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveTags}
                  class="bg-emerald-600 px-4 py-2 text-sm text-white shadow-sm hover:bg-emerald-700"
                >
                  Save Changes
                </Button>
              </div>
            </footer>
          </div>
        </div>
      </div>
      <Show when={confirmingDelete()}>
        <div
          class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 px-4"
          onClick={() => {
            if (!isDeleting()) {
              setConfirmingDelete(false);
              setDeleteError(null);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-media-title"
            data-testid="delete-media-confirm"
            class="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p class="text-xs uppercase tracking-wide text-slate-500">
              Confirm
            </p>
            <h2 id="delete-media-title" class="mt-1 text-lg text-slate-900">
              Delete this media?
            </h2>
            <p class="mt-3 text-sm leading-relaxed text-slate-600">
              Are you sure you wish to delete {mediaFilename()}? This removes
              it from the library. The file on disk is left in place.
            </p>
            <Show when={deleteError()}>
              <p class="mt-3 text-sm text-red-600">{deleteError()}</p>
            </Show>
            <div class="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                disabled={isDeleting()}
                onClick={() => {
                  setConfirmingDelete(false);
                  setDeleteError(null);
                }}
                class="px-4 py-2 text-sm"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting()}
                onClick={() => void confirmDelete()}
                class="px-4 py-2 text-sm"
              >
                {isDeleting() ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default MediaModal;
