import { convertFileSrc } from "@tauri-apps/api/core";
import { Film, ImageIcon, Images } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import TagBadge from "@/components/TagBadge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { groupCardDescription } from "@/lib/gallery";
import type { NormalizedMedia } from "@/types/media";

interface MediaCardProps {
  title: string;
  items: NormalizedMedia[];
  grouped: boolean;
  onSelect: () => void;
}

const posters = new Map<string, string>();

function fileSrc(item: NormalizedMedia): string {
  return item.fileUrl || convertFileSrc(item.filepath);
}

function MediaCard({ title, items, grouped, onSelect }: MediaCardProps) {
  const preview =
    items.find(
      (item) =>
        item.mediatype === "PHOTO" && !item.fileMissing && !item.previewUnavailable
    ) ??
    items.find((item) => !item.fileMissing && !item.previewUnavailable) ??
    items.find((item) => item.mediatype === "PHOTO") ??
    items[0];
  const previewBlocked = Boolean(
    preview?.fileMissing || preview?.previewUnavailable
  );
  const tagNames = [
    ...new Set(items.flatMap((item) => item.tags?.map((tag) => tag.name) ?? [])),
  ];
  const description = groupCardDescription(items, grouped);
  const countLabel = items.length === 1 ? "1 item" : `${items.length} items`;

  return (
    <Card
      className="group flex w-full cursor-pointer flex-col overflow-hidden border-border/80 bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-ball/70"
      data-testid="gallery-card"
      data-grouped={grouped ? "true" : "false"}
      onClick={onSelect}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-court/10">
        {preview && !previewBlocked ? (
          <MediaPreview item={preview} title={title} />
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-court/50 to-transparent" />
        {preview?.fileMissing ? (
          <span
            data-testid="file-missing"
            className="absolute right-3 top-3 z-10 inline-flex items-center rounded-full bg-court/80 px-2.5 py-1 text-xs font-medium text-court-foreground"
          >
            File missing
          </span>
        ) : preview?.previewUnavailable ? (
          <span
            data-testid="preview-unavailable"
            className="absolute right-3 top-3 z-10 inline-flex items-center rounded-full bg-court/80 px-2.5 py-1 text-xs font-medium text-court-foreground"
          >
            Preview unavailable
          </span>
        ) : grouped ? (
          <span
            data-testid="group-count"
            className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-ball px-2.5 py-1 text-xs font-semibold text-ball-foreground shadow-sm"
          >
            <Images className="h-3.5 w-3.5" />
            {countLabel}
          </span>
        ) : preview?.mediatype === "VIDEO" ? (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-court/80 px-2.5 py-1 text-xs font-medium text-court-foreground">
            <Film className="h-3.5 w-3.5" />
            Video
          </span>
        ) : preview ? (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-court/80 px-2.5 py-1 text-xs font-medium text-court-foreground">
            <ImageIcon className="h-3.5 w-3.5" />
            Image
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
            <CardDescription data-testid="gallery-card-description" className="line-clamp-2">
              {description}
            </CardDescription>
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

function MediaPreview({ item, title }: { item: NormalizedMedia; title: string }) {
  if (item.mediatype === "VIDEO") {
    return <VideoPreview src={fileSrc(item)} />;
  }
  return (
    <img
      src={fileSrc(item)}
      alt={item.filename || title}
      loading="lazy"
      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
    />
  );
}

function VideoPreview({ src }: { src: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sought = useRef(false);
  const [poster, setPoster] = useState(() => posters.get(src) ?? "");
  const [visible, setVisible] = useState(false);
  const [anonymous, setAnonymous] = useState(true);

  useEffect(() => {
    sought.current = false;
    setAnonymous(true);
    const cached = posters.get(src) ?? "";
    setPoster(cached);
    setVisible(false);
    if (cached) return;

    const node = hostRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "240px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [src]);

  useEffect(() => {
    sought.current = false;
  }, [anonymous]);

  const rememberFrame = (video: HTMLVideoElement) => {
    if (posters.has(src) || video.videoWidth === 0 || video.videoHeight === 0) return;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration > 0.35 && video.currentTime < 0.05) return;
    const longest = Math.max(video.videoWidth, video.videoHeight);
    const scale = Math.min(1, 720 / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return;
    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/jpeg", 0.8);
      posters.set(src, url);
      setPoster(url);
    } catch {
      // A tainted canvas still leaves the decoded video frame on screen.
    }
  };

  const showFrame = (video: HTMLVideoElement) => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const target = duration > 0.35 ? Math.min(0.5, Math.max(0.12, duration * 0.02)) : 0;
    // WebKit leaves the element blank until the playhead leaves 0.
    if (!sought.current && target > 0 && video.currentTime < 0.05) {
      sought.current = true;
      video.currentTime = target;
      return;
    }
    rememberFrame(video);
  };

  return (
    <div ref={hostRef} className="absolute inset-0">
      {poster ? (
        <img
          src={poster}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
      ) : visible ? (
        <video
          key={anonymous ? "cors" : "plain"}
          src={`${src}#t=0.1`}
          muted
          playsInline
          preload="auto"
          crossOrigin={anonymous ? "anonymous" : undefined}
          aria-hidden="true"
          className="pointer-events-none h-full w-full object-cover"
          onLoadedData={(event) => showFrame(event.currentTarget)}
          onSeeked={(event) => rememberFrame(event.currentTarget)}
          onError={() => {
            if (anonymous) setAnonymous(false);
          }}
        />
      ) : null}
    </div>
  );
}

export default MediaCard;
