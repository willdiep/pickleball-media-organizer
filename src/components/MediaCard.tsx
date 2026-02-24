import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import TagBadge from "@/components/TagBadge";
import type { NormalizedMedia } from "@/types/media";

interface CardDemoProps {
  media: NormalizedMedia;
  onSelect: (media: NormalizedMedia) => void;
}

function MediaCard({ media, onSelect }: CardDemoProps) {
  const tagNames = media.tags?.map((t) => t.name) ?? [];
  const description =
    media.description && media.description.length >= 100
      ? `${media.description.slice(0, 100)}...`
      : media.description;
  const fileUrl =
    media?.fileUrl ?? (media ? encodeURI(`file://${media.filepath}`) : "");

  return (
    <Card
      className="w-full flex flex-col cursor-pointer transition hover:-translate-y-[1px] hover:border-emerald-200 hover:shadow-md"
      onClick={() => onSelect(media)}
    >
      <div className="relative w-full overflow-hidden rounded-t-xl bg-slate-100 aspect-video">
        {media.mediatype === "VIDEO" ? (
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
            alt={media.filename}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover bg-white"
          />
        )}
      </div>
      <div className="flex flex-col justify-between flex-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold break-all">
            {media.filename}
          </CardTitle>
          {description && (
            <CardDescription>
              <p>{description}</p>
            </CardDescription>
          )}
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-2">
          {tagNames.length ? (
            tagNames.map((name) => <TagBadge key={name} name={name} />)
          ) : (
            <span className="text-[11px] uppercase tracking-wide text-slate-400">
              No tags
            </span>
          )}
        </CardFooter>
      </div>
    </Card>
  );
}

export default MediaCard;
