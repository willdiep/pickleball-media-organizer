import { convertFileSrc } from "@tauri-apps/api/core";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { JSX } from "solid-js";

import VideoJS from "@/components/VideoJS";

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
  media: NormalizedMedia;
  onClose: () => void;
  onSave: (
    mediaId: number,
    tagList: string[],
    description: string
  ) => Promise<void>;
  onDelete: () => Promise<void>;
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

const MediaModal = (props: MediaModalProps) => {
  const [tagInput, setTagInput] = createSignal("");
  const [tagList, setTagList] = createSignal<string[]>([]);
  const [description, setDescription] = createSignal("");
  const [confirmingDelete, setConfirmingDelete] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);

  const fileUrl = () =>
    props.media.fileUrl || convertFileSrc(props.media.filepath);

  const mediaFilename = () =>
    props.media.filename && props.media.filename.length >= 80
      ? `${props.media.filename.slice(0, 80)}...`
      : props.media.filename;

  createEffect(() => {
    setTagList(props.media.tags?.map((tag) => tag.name) ?? []);
    setDescription(props.media.description ?? "");
  });

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isDeleting()) return;
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
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await props.onDelete();
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
    await props.onSave(props.media.id, tagList(), description());
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
        type: videoContentType(props.media.filename),
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
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div class="flex max-h-screen w-auto max-w-[90vw] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500">
              Preview
            </p>
            <h2 class="text-lg text-slate-900">{mediaFilename()}</h2>
          </div>
          <Button
            onClick={() => props.onClose()}
            class="bg-slate-100 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200"
          >
            Close
          </Button>
        </header>
        <div class="grid grid-cols-1 items-start gap-4 overflow-auto md:grid-cols-[minmax(0,1fr)_400px]">
          <div class="flex items-center justify-center rounded-2xl">
            <div class="flex w-full items-center justify-center">
              <Show
                when={props.media.mediatype === "PHOTO"}
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
                  src={fileUrl()}
                  class="h-[80vh] w-full bg-white object-contain shadow-sm"
                  alt={props.media.filename}
                />
              </Show>
            </div>
          </div>
          <div class="flex h-full flex-col gap-6 rounded-2xl bg-white py-4 pr-4">
            <div class="grid w-full gap-2">
              <p class="text-xs uppercase tracking-wide text-slate-500">
                Filepath
              </p>
              <p class="break-all text-sm text-slate-800">
                {props.media.filepath}
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
