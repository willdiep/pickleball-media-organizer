import { listen } from "@tauri-apps/api/event";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import AppMenuModal from "@/components/AppMenuModal";
import Sidebar from "@/components/Sidebar";
import MediaCard from "@/components/MediaCard";
import MediaModal from "@/components/MediaModal";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import * as mediaApi from "@/lib/media-api";

import type { NormalizedMedia, Tag } from "./types/media";

const App = () => {
  const [media, setMedia] = createSignal<NormalizedMedia[]>([]);
  const [tags, setTags] = createSignal<Tag[]>([]);
  const [selectedTag, setSelectedTag] = createSignal("all");
  const [selectedMedia, setSelectedMedia] =
    createSignal<NormalizedMedia | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isAdding, setIsAdding] = createSignal(false);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [appMenuOpen, setAppMenuOpen] = createSignal(false);

  const loadMedia = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await mediaApi.listMedia();
      setMedia(result.media || []);
      setTags(result.tags || []);
    } catch (error) {
      console.error("Failed to load media", error);
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  };

  onMount(() => {
    void loadMedia();

    const openAppMenu = () => setAppMenuOpen(true);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "," && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openAppMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    let unlisten: (() => void) | undefined;
    void listen("app-menu", openAppMenu).then((stop) => {
      unlisten = stop;
    });

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      unlisten?.();
    });
  });

  const filteredMedia = createMemo(() => {
    const tag = selectedTag();
    const items = media();
    if (tag === "all") return items;
    return items.filter((item) =>
      item.tags?.some((itemTag) => itemTag.name === tag)
    );
  });

  const handleAddFolder = async () => {
    setIsAdding(true);
    try {
      const result = await mediaApi.addFolder();
      if (result.media) {
        setMedia(result.media);
        setTags(result.tags || tags());
      }
    } catch (error) {
      console.error("Failed to add folder", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveMetadata = async (
    mediaId: number,
    tagList: string[],
    description: string
  ) => {
    try {
      const tagResult = await mediaApi.updateTags(mediaId, tagList);
      const descriptionResult = await mediaApi.updateDescription(
        mediaId,
        description
      );

      const latestMedia = descriptionResult?.media || tagResult?.media;
      const updatedTags = tagResult?.tags || tags();

      if (latestMedia) {
        setMedia((prev) =>
          prev.map((item) => (item.id === mediaId ? latestMedia : item))
        );
        setSelectedMedia(latestMedia);
      }
      setTags(updatedTags);
    } catch (error) {
      console.error("Failed to save changes", error);
    }
  };

  const handleDeleteMedia = async () => {
    const current = selectedMedia();
    if (!current) return;

    try {
      const result = await mediaApi.deleteMedia(current.id);
      if (result?.media) setMedia(result.media);
      if (result?.tags) setTags(result.tags);
      setSelectedMedia(null);
    } catch (error) {
      console.error("Failed to delete media", error);
    }
  };

  return (
    <div class="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar
        tags={tags()}
        selectedTag={selectedTag()}
        onSelectTag={setSelectedTag}
      />
      <main class="flex flex-1 flex-col">
        <header class="flex items-center justify-between border-b border-slate-200 bg-white/70 px-6 py-4 backdrop-blur">
          <div>
            <h2 class="text-xl uppercase tracking-wide text-slate-500">
              Gallery
            </h2>
            <Show when={loadError()}>
              <p class="mt-1 text-xs text-red-600">{loadError()}</p>
            </Show>
          </div>
          <Button
            onClick={handleAddFolder}
            disabled={isAdding()}
            class="bg-emerald-600 hover:bg-emerald-700"
          >
            <Show
              when={isAdding()}
              fallback="Add Folder"
            >
              <span class="flex gap-2">
                <Spinner /> Loading
              </span>
            </Show>
          </Button>
        </header>
        <section class="scrollbar-light flex-1 overflow-auto px-6 py-4">
          <Show
            when={!isLoading()}
            fallback={
              <div class="mt-10 text-center text-slate-500">
                Loading media...
              </div>
            }
          >
            <Show
              when={filteredMedia().length > 0}
              fallback={
                <div class="mt-10 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-10">
                  <div class="text-3xl">🟢</div>
                  <p class="text-sm font-semibold text-slate-700">
                    No media found
                  </p>
                  <p class="text-sm text-slate-500">
                    Import a folder to start organizing your pickleball
                    highlights.
                  </p>
                  <button
                    onClick={handleAddFolder}
                    class="mt-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Add Folder
                  </button>
                </div>
              }
            >
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <For each={filteredMedia()}>
                  {(item) => (
                    <MediaCard media={item} onSelect={setSelectedMedia} />
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </section>
      </main>
      <Show when={appMenuOpen()}>
        <AppMenuModal onClose={() => setAppMenuOpen(false)} />
      </Show>
      <Show when={selectedMedia()}>
        {(media) => (
          <MediaModal
            media={media()}
            onClose={() => setSelectedMedia(null)}
            onSave={handleSaveMetadata}
            onDelete={handleDeleteMedia}
          />
        )}
      </Show>
    </div>
  );
};

export default App;
