import { listen } from "@tauri-apps/api/event";
import { FolderPlus, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AppMenuModal from "@/components/AppMenuModal";
import MediaCard from "@/components/MediaCard";
import MediaModal from "@/components/MediaModal";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { buildGalleryEntries } from "@/lib/gallery";
import * as mediaApi from "@/lib/media-api";

import type { NormalizedMedia, Tag } from "./types/media";

const App = () => {
  const [media, setMedia] = useState<NormalizedMedia[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState("all");
  const [openIds, setOpenIds] = useState<number[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appMenuOpen, setAppMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadMedia = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const result = await mediaApi.listMedia();
        if (!active) return;
        setMedia(result.media || []);
        setTags(result.tags || []);
      } catch (error) {
        console.error("Failed to load media", error);
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) setIsLoading(false);
      }
    };

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

    return () => {
      active = false;
      window.removeEventListener("keydown", handleKeyDown);
      unlisten?.();
    };
  }, []);

  const gallery = useMemo(() => {
    const entries = buildGalleryEntries(media);
    if (selectedTag === "all") return entries;
    return entries.filter((entry) =>
      entry.items.some((item) =>
        item.tags?.some((itemTag) => itemTag.name === selectedTag)
      )
    );
  }, [media, selectedTag]);

  const openItems = useMemo(() => {
    if (!openIds) return [];
    const byId = new Map(media.map((item) => [item.id, item]));
    return openIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [media, openIds]);

  const visibleCount = gallery.reduce((sum, entry) => sum + entry.items.length, 0);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of media) {
      for (const tag of item.tags ?? []) {
        counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1);
      }
    }
    return counts;
  }, [media]);

  const handleAddFolder = async () => {
    setIsAdding(true);
    try {
      const result = await mediaApi.addFolder();
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
      const updatedTags = tagResult?.tags || tags;

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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        tags={tags}
        selectedTag={selectedTag}
        totalCount={media.length}
        tagCounts={tagCounts}
        onSelectTag={setSelectedTag}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-8 py-5">
          <div>
            <p className="text-sm text-muted-foreground">Highlights</p>
            <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
            {loadError ? (
              <p className="mt-1 text-sm text-destructive">{loadError}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {isLoading
                  ? "Loading the court…"
                  : `${visibleCount} ${visibleCount === 1 ? "file" : "files"}`}
              </p>
            )}
          </div>
          <Button onClick={() => void handleAddFolder()} disabled={isAdding}>
            {isAdding ? (
              <Loader2 className="animate-spin" />
            ) : (
              <FolderPlus />
            )}
            {isAdding ? "Importing" : "Add folder"}
          </Button>
        </header>
        <section className="scrollbar-light flex-1 overflow-auto px-8 pb-8">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading media
            </div>
          ) : gallery.length === 0 ? (
            <div className="mx-auto mt-16 flex max-w-md flex-col items-center rounded-2xl border border-dashed border-border bg-card px-8 py-12 text-center shadow-sm">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-ball">
                <span className="h-4 w-4 rounded-full bg-court" />
              </span>
              <h2 className="mt-5 text-lg font-semibold">No highlights yet</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Add a folder of photos and videos. Subfolders become their own
                carousel, and files in the root stay as single clips.
              </p>
              <Button className="mt-6" onClick={() => void handleAddFolder()}>
                <FolderPlus />
                Add folder
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {gallery.map((entry) => (
                <MediaCard
                  key={entry.key}
                  title={entry.title}
                  items={entry.items}
                  grouped={entry.grouped}
                  onSelect={() =>
                    setOpenIds(entry.items.map((item) => item.id))
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>
      {appMenuOpen ? (
        <AppMenuModal
          onClose={() => setAppMenuOpen(false)}
          onDeleteAll={handleDeleteAllMedia}
        />
      ) : null}
      {openItems.length > 0 ? (
        <MediaModal
          items={openItems}
          onClose={() => setOpenIds(null)}
          onSave={handleSaveMetadata}
          onDelete={handleDeleteMedia}
        />
      ) : null}
    </div>
  );
};

export default App;
