import { listen } from "@tauri-apps/api/event";
import { FolderPlus, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import AppMenuModal from "@/components/AppMenuModal";
import MediaCard from "@/components/MediaCard";
import MediaModal from "@/components/MediaModal";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoryLabel, type MediaCategory } from "@/lib/categories";
import {
  buildGalleryEntries,
  filterMedia,
  folderName,
  libraryGridState,
  shouldClearSearch,
  type GallerySort,
  type MediaTypeFilter,
} from "@/lib/gallery";
import * as mediaApi from "@/lib/media-api";
import { cn } from "@/lib/utils";

import type {
  AddFolderResponse,
  IngestProgress,
  LibraryRoot,
  NormalizedMedia,
  Tag,
} from "./types/media";

const TYPE_OPTIONS: Array<{ value: MediaTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "PHOTO", label: "Photos" },
  { value: "VIDEO", label: "Videos" },
];

const SORT_OPTIONS: Array<{ value: GallerySort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

const App = () => {
  const [media, setMedia] = useState<NormalizedMedia[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<MediaCategory>("pickleball");
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [diskChange, setDiskChange] = useState<LibraryRoot | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<MediaTypeFilter>("all");
  const [sort, setSort] = useState<GallerySort>("newest");
  const searchRef = useRef<HTMLInputElement>(null);
  const [openIds, setOpenIds] = useState<number[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [importScanned, setImportScanned] = useState(0);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const addingRef = useRef(false);

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
        setRoots(result.roots || []);
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

    const stops: Array<() => void> = [];
    void listen("app-menu", openAppMenu).then((stop) => {
      if (!active) {
        stop();
        return;
      }
      stops.push(stop);
    });
    void listen<{ rootId: number; path: string }>(
      "library-root-changed",
      (event) => {
        setDiskChange({
          id: event.payload.rootId,
          path: event.payload.path,
          mediaCount: 0,
        });
      }
    ).then((stop) => {
      if (!active) {
        stop();
        return;
      }
      stops.push(stop);
    });

    return () => {
      active = false;
      window.removeEventListener("keydown", handleKeyDown);
      for (const stop of stops) stop();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !shouldClearSearch(
          event.key,
          query,
          event.target === searchRef.current
        )
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      setQuery("");
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [query]);

  const categoryMedia = useMemo(
    () => media.filter((item) => item.category === selectedCategory),
    [media, selectedCategory]
  );

  const visibleMedia = useMemo(
    () =>
      filterMedia(categoryMedia, {
        selectedTag,
        mediaType,
        query,
      }),
    [categoryMedia, selectedTag, mediaType, query]
  );

  const gallery = useMemo(
    () => buildGalleryEntries(visibleMedia, sort),
    [visibleMedia, sort]
  );

  const openItems = useMemo(() => {
    if (!openIds) return [];
    const byId = new Map(media.map((item) => [item.id, item]));
    return openIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [media, openIds]);

  const visibleCount = visibleMedia.length;
  const gridState = libraryGridState(
    isLoading,
    categoryMedia.length,
    visibleCount
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<MediaCategory, number> = {
      pickleball: 0,
      exercises: 0,
    };
    for (const item of media) {
      if (item.category === "pickleball" || item.category === "exercises") {
        counts[item.category] += 1;
      }
    }
    return counts;
  }, [media]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of categoryMedia) {
      for (const tag of item.tags ?? []) {
        counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1);
      }
    }
    return counts;
  }, [categoryMedia]);

  const handleSelectCategory = (category: MediaCategory) => {
    setSelectedCategory(category);
    setSelectedTag(null);
  };

  const applyLibrary = (
    nextMedia: NormalizedMedia[],
    nextTags: Tag[],
    nextRoots?: LibraryRoot[]
  ) => {
    setMedia(nextMedia);
    setTags(nextTags);
    if (nextRoots) setRoots(nextRoots);
    setSelectedTag((current) =>
      current && !nextTags.some((tag) => tag.name === current) ? null : current
    );
  };

  const summarizeImport = (result: AddFolderResponse) => {
    const parts = [`Added ${result.imported}`];
    if (result.alreadyPresent) {
      parts.push(`${result.alreadyPresent} already in the library`);
    }
    if (result.skipped) parts.push(`skipped ${result.skipped}`);
    if (result.missing) parts.push(`${result.missing} no longer on disk`);
    return parts.join(", ");
  };

  const runImport = async (action: () => Promise<AddFolderResponse>) => {
    if (addingRef.current) return;
    addingRef.current = true;
    setIsAdding(true);
    setImportSummary(null);
    setImportScanned(0);
    let unlisten = () => {};
    try {
      unlisten = await listen<IngestProgress>("ingest-progress", (event) => {
        setImportScanned(event.payload.scanned);
      });
      const result = await action();
      if (!result.media) return;
      applyLibrary(result.media, result.tags || tags, result.roots);
      setLoadError(null);
      setImportSummary(summarizeImport(result));
      setDiskChange(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      unlisten();
      addingRef.current = false;
      setIsAdding(false);
    }
  };

  const handleAddFolder = async () => {
    const category = selectedCategory;
    await runImport(() => mediaApi.addFolder(category));
  };

  const handleRescan = async (rootId: number) => {
    await runImport(() => mediaApi.rescanRoot(rootId));
  };

  const handleRemoveRoot = async (rootId: number) => {
    const result = await mediaApi.removeRoot(rootId);
    applyLibrary(result.media || [], result.tags || [], result.roots);
    setDiskChange((current) => (current?.id === rootId ? null : current));
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
    applyLibrary(result.media || [], result.tags || [], result.roots);
    setOpenIds(null);
    setSelectedTag(null);
    setDiskChange(null);
  };

  const handleDeleteMedia = async (mediaId: number) => {
    try {
      const result = await mediaApi.deleteMedia(mediaId);
      if (result?.media && result.tags) {
        applyLibrary(result.media, result.tags, result.roots);
      }
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
        selectedCategory={selectedCategory}
        selectedTag={selectedTag}
        categoryCounts={categoryCounts}
        tagCounts={tagCounts}
        onSelectCategory={handleSelectCategory}
        onSelectTag={setSelectedTag}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-start justify-between gap-4 px-8 py-5">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Library</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {categoryLabel(selectedCategory)}
            </h1>
            {isAdding ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Importing… {importScanned} files
              </p>
            ) : loadError ? (
              <p className="mt-1 text-sm text-destructive">{loadError}</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isLoading
                    ? "Loading the court…"
                    : `${visibleCount} ${visibleCount === 1 ? "file" : "files"}`}
                </p>
                {importSummary ? (
                  <p className="mt-1 text-sm text-muted-foreground">{importSummary}</p>
                ) : null}
              </>
            )}
            {diskChange && !isAdding ? (
              <div
                data-testid="disk-change"
                className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
              >
                <span>{folderName(diskChange.path)} changed on disk.</span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleRescan(diskChange.id)}
                >
                  Rescan
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            <label htmlFor="library-search" className="sr-only">
              Search
            </label>
            <Input
              ref={searchRef}
              id="library-search"
              value={query}
              placeholder="Search files, tags, descriptions"
              onChange={(event) => setQuery(event.target.value)}
              className="w-56"
            />
            <div
              role="group"
              aria-label="Media type"
              className="flex h-9 items-center rounded-md border border-input p-0.5"
            >
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mediaType === option.value}
                  className={cn(
                    "rounded px-2.5 py-1 text-sm",
                    mediaType === option.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setMediaType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label htmlFor="library-sort" className="sr-only">
              Sort
            </label>
            <select
              id="library-sort"
              aria-label="Sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as GallerySort)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              className="shrink-0"
              onClick={() => void handleAddFolder()}
              disabled={isAdding}
            >
              {isAdding ? (
                <Loader2 className="animate-spin" />
              ) : (
                <FolderPlus />
              )}
              {isAdding ? "Importing" : "Add folder"}
            </Button>
          </div>
        </header>
        <section className="scrollbar-light flex-1 overflow-auto px-8 pb-8">
          {gridState === "loading" ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading media
            </div>
          ) : gridState === "empty" ? (
            <div className="mx-auto mt-16 flex max-w-md flex-col items-center rounded-2xl border border-dashed border-border bg-card px-8 py-12 text-center shadow-sm">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-ball">
                <span className="h-4 w-4 rounded-full bg-court" />
              </span>
              <h2 className="mt-5 text-lg font-semibold">
                No {categoryLabel(selectedCategory)} media yet
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {`Add a folder of photos and videos for ${categoryLabel(selectedCategory)}. Subfolders become their own carousel, and files in the root stay as single clips.`}
              </p>
              <Button
                className="mt-6"
                onClick={() => void handleAddFolder()}
                disabled={isAdding}
              >
                {isAdding ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FolderPlus />
                )}
                {isAdding ? "Importing" : "Add folder"}
              </Button>
            </div>
          ) : (
            <div>
              {gridState === "no-matches" ? (
                <p data-testid="no-matches" className="mb-4 text-sm text-muted-foreground">
                  No matches
                </p>
              ) : null}
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
            </div>
          )}
        </section>
      </main>
      {appMenuOpen ? (
        <AppMenuModal
          roots={roots}
          busy={isAdding}
          onClose={() => setAppMenuOpen(false)}
          onDeleteAll={handleDeleteAllMedia}
          onRescan={handleRescan}
          onRemove={handleRemoveRoot}
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
