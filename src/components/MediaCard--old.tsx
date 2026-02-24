import TagBadge from "@/components/TagBadge";
import type { NormalizedMedia } from '@/types/media';

interface MediaCardProps {
  media: NormalizedMedia;
  onSelect: (media: NormalizedMedia) => void;
}

const MediaCard = ({ media, onSelect }: MediaCardProps) => {
  const tagNames = media.tags?.map((t) => t.name) ?? [];
  const description =
    media.description && media.description.length >= 100
      ? `${media.description.slice(0, 100)}...`
      : media.description;
  const fileUrl =
    media?.fileUrl ?? (media ? encodeURI(`file://${media.filepath}`) : "");

  return (
    <button
      onClick={() => onSelect(media)}
      className="group h-full flex-col rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-200 hover:shadow-md inline-flex"
    >
      <div className="w-full flex flex-col gap-3">
        <div className="relative w-full overflow-hidden rounded-t-xl border border-slate-200 bg-slate-100 aspect-video">
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
      </div>
      <div className="p-4 flex flex-col justify-between h-44">
        <div>
          <div className="text-sm font-semibold text-slate-900 break-all">
            {media.filename}
          </div>
          {description ? (
            <p className="text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tagNames.length ? (
            tagNames.map((name) => <TagBadge key={name} name={name} />)
          ) : (
            <span className="text-[11px] uppercase tracking-wide text-slate-400">
              No tags
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default MediaCard;
