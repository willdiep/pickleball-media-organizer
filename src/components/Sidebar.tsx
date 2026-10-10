import { Images, Library } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Tag } from "@/types/media";

interface SidebarProps {
  tags: Tag[];
  selectedTag: string;
  totalCount: number;
  tagCounts: Map<string, number>;
  onSelectTag: (tag: string) => void;
}

const Sidebar = ({
  tags,
  selectedTag,
  totalCount,
  tagCounts,
  onSelectTag,
}: SidebarProps) => (
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
        <button
          type="button"
          onClick={() => onSelectTag("all")}
          className={cn(
            "mt-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition",
            selectedTag === "all"
              ? "bg-ball text-ball-foreground"
              : "text-court-foreground/80 hover:bg-white/10"
          )}
        >
          <span className="flex items-center gap-2">
            <Library className="h-4 w-4" />
            All media
          </span>
          <span className="text-xs tabular-nums opacity-70">{totalCount}</span>
        </button>
      </div>

      <div>
        <p className="px-3 text-xs font-medium text-court-foreground/50">Tags</p>
        <div className="mt-2 space-y-1">
          {tags.length === 0 ? (
            <p className="px-3 py-2 text-sm text-court-foreground/45">No tags yet</p>
          ) : (
            tags.map((tag) => (
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

export default Sidebar;
