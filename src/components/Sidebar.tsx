import { Dumbbell, Images, Library } from "lucide-react";

import { MEDIA_CATEGORIES, type MediaCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { Tag } from "@/types/media";

interface SidebarProps {
  tags: Tag[];
  selectedCategory: MediaCategory;
  selectedTag: string | null;
  categoryCounts: Record<MediaCategory, number>;
  tagCounts: Map<string, number>;
  onSelectCategory: (category: MediaCategory) => void;
  onSelectTag: (tag: string | null) => void;
}

const categoryIcons: Record<MediaCategory, typeof Library> = {
  pickleball: Library,
  exercises: Dumbbell,
};

const Sidebar = ({
  tags,
  selectedCategory,
  selectedTag,
  categoryCounts,
  tagCounts,
  onSelectCategory,
  onSelectTag,
}: SidebarProps) => {
  const visibleTags = tags.filter((tag) => (tagCounts.get(tag.name) ?? 0) > 0);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-court text-court-foreground">
      <div className="flex items-center gap-3 px-5 pb-2 pt-6">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-ball shadow-sm">
          <span className="h-3 w-3 rounded-full bg-court" />
        </span>
        <div>
          <p className="text-sm font-semibold leading-none">Pickleball</p>
          <p className="mt-1 text-xs text-ball">Media library</p>
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-6 overflow-auto px-3 pb-6">
        <div>
          <p className="px-3 text-xs font-medium text-court-foreground/50">Browse</p>
          <div className="mt-2 space-y-1">
            {MEDIA_CATEGORIES.map((category) => {
              const Icon = categoryIcons[category.id];
              const selected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onSelectCategory(category.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition",
                    selected
                      ? "bg-ball text-ball-foreground"
                      : "text-court-foreground/80 hover:bg-white/10"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {category.label}
                  </span>
                  <span className="text-xs tabular-nums opacity-70">
                    {categoryCounts[category.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="px-3 text-xs font-medium text-court-foreground/50">Tags</p>
          <div className="mt-2 space-y-1">
            {visibleTags.length === 0 ? (
              <p className="px-3 py-2 text-sm text-court-foreground/45">No tags yet</p>
            ) : (
              visibleTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onSelectTag(tag.name)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium capitalize transition",
                    selectedTag === tag.name
                      ? "bg-ball text-ball-foreground"
                      : "text-court-foreground/80 hover:bg-white/10"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Images className="h-4 w-4" />
                    {tag.name}
                  </span>
                  <span className="text-xs tabular-nums opacity-70">
                    {tagCounts.get(tag.name) ?? 0}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
