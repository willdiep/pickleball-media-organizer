import { listen } from "@tauri-apps/api/event";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import AppMenuModal from "@/components/AppMenuModal";
import Sidebar from "@/components/Sidebar";
import MediaCard from "@/components/MediaCard";
import MediaModal from "@/components/MediaModal";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { buildGalleryEntries } from "@/lib/gallery";
import * as mediaApi from "@/lib/media-api";

import type { NormalizedMedia, Tag } from "./types/media";

const App = () => {
  const [media, setMedia] = createSignal<NormalizedMedia[]>([]);
  const [tags, setTags] = createSignal<Tag[]>([]);
  const [selectedTag, setSelectedTag] = createSignal("all");
  const [openIds, setOpenIds] = createSignal<number[] | null>(null);
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

  const gallery = createMemo(() => {
    const tag = selectedTag();
    const entries = buildGalleryEntries(media());
    if (tag === "all") return entries;
    return entries.filter((entry) =>
      entry.items.some((item) =>
        item.tags?.some((itemTag) => itemTag.name === tag)
      )
    );
  });

  const openItems = createMemo(() => {
    const ids = openIds();
    if (!ids) return [];
    const byId = new Map(media().map((item) => [item.id, item]));
    return ids.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
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
      }
      setTags(updatedTags);
    } catch (error) {
      console.error("Failed to save changes", error);
    }
  };

  const handleDeleteAllMedia = async () => {
    const result = await mediaApi.deleteAllMedia();
    setMedia(result.media || []);
    setTags(result.tags || []);
    setOpenIds(null);
    setSelectedTag("all");
  };

  const handleDeleteMedia = async (mediaId: number) => {
    try {
      const result = await mediaApi.deleteMedia(mediaId);
      if (result?.media) setMedia(result.media);
      if (result?.tags) setTags(result.tags);
      setOpenIds((ids) => {
        if (!ids) return null;
        const next = ids.filter((id) => id !== mediaId);
        return next.length > 0 ? next : null;
      });
    } catch (error) {
      console.error("Failed to delete media", error);
      throw error;
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
              when={gallery().length > 0}
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
                <For each={gallery()}>
                  {(entry) => (
                    <MediaCard
                      title={entry.title}
                      items={entry.items}
                      grouped={entry.grouped}
                      onSelect={() =>
                        setOpenIds(entry.items.map((item) => item.id))
                      }
                    />
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </section>
      </main>
      <Show when={appMenuOpen()}>
        <AppMenuModal
          onClose={() => setAppMenuOpen(false)}
          onDeleteAll={handleDeleteAllMedia}
        />
      </Show>
      <Show when={openItems().length > 0}>
        <MediaModal
          items={openItems()}
          onClose={() => setOpenIds(null)}
          onSave={handleSaveMetadata}
          onDelete={handleDeleteMedia}
        />
      </Show>
    </div>
  );
};

export default App;
