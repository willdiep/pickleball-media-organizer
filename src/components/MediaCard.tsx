import { convertFileSrc } from "@tauri-apps/api/core";
import { Film, Images } from "lucide-react";

import TagBadge from "@/components/TagBadge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { NormalizedMedia } from "@/types/media";

interface MediaCardProps {
  title: string;
  items: NormalizedMedia[];
  grouped: boolean;
  onSelect: () => void;
}

function MediaCard({ title, items, grouped, onSelect }: MediaCardProps) {
  const preview = items.find((item) => item.mediatype === "PHOTO") ?? items[0];
  const tagNames = [
    ...new Set(items.flatMap((item) => item.tags?.map((tag) => tag.name) ?? [])),
  ];
  const rawDescription =
    grouped && items.length > 1 ? "" : (items[0]?.description ?? "");
  const description =
    rawDescription.length >= 100
      ? `${rawDescription.slice(0, 100)}...`
      : rawDescription;
  const fileUrl = preview
    ? preview.fileUrl || convertFileSrc(preview.filepath)
    : "";
  const countLabel = items.length === 1 ? "1 item" : `${items.length} items`;

  return (
    <Card
      className="group flex w-full cursor-pointer flex-col overflow-hidden border-border/80 bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-ball/70"
      data-testid="gallery-card"
      data-grouped={grouped ? "true" : "false"}
      onClick={onSelect}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-court/10">
        {preview?.mediatype === "VIDEO" ? (
          <video
            src={fileUrl}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={fileUrl}
            alt={preview?.filename ?? title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-court/50 to-transparent" />
        {grouped ? (
          <span
            data-testid="group-count"
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-ball px-2.5 py-1 text-xs font-semibold text-ball-foreground shadow-sm"
          >
            <Images className="h-3.5 w-3.5" />
            {countLabel}
          </span>
        ) : preview?.mediatype === "VIDEO" ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-court/80 px-2.5 py-1 text-xs font-medium text-court-foreground">
            <Film className="h-3.5 w-3.5" />
            Video
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <CardTitle
            data-testid="gallery-card-title"
            className="break-all text-base font-semibold leading-snug"
          >
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="line-clamp-2">{description}</CardDescription>
          ) : null}
        </div>
        <div className="mt-auto flex flex-wrap gap-1.5">
          {tagNames.length > 0 ? (
            tagNames.map((name) => <TagBadge key={name} name={name} />)
          ) : (
            <span className="text-xs text-muted-foreground">No tags</span>
          )}
        </div>
      </div>
    </Card>
  );
}

export default MediaCard;
