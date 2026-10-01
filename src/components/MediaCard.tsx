import { For, Show } from "solid-js";

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import TagBadge from "@/components/TagBadge";
import type { NormalizedMedia } from "@/types/media";

interface MediaCardProps {
  media: NormalizedMedia;
  onSelect: (media: NormalizedMedia) => void;
}

function MediaCard(props: MediaCardProps) {
  const tagNames = () => props.media.tags?.map((tag) => tag.name) ?? [];
  const description = () => {
    const text = props.media.description;
    if (!text) return "";
    return text.length >= 100 ? `${text.slice(0, 100)}...` : text;
  };
  const fileUrl = () =>
    props.media.fileUrl ?? encodeURI(`file://${props.media.filepath}`);

  return (
    <Card
      class="flex w-full cursor-pointer flex-col transition hover:-translate-y-[1px] hover:border-emerald-200 hover:shadow-md"
      onClick={() => props.onSelect(props.media)}
    >
      <div class="relative aspect-video w-full overflow-hidden rounded-t-xl bg-slate-100">
        <Show
          when={props.media.mediatype === "VIDEO"}
          fallback={
            <img
              src={fileUrl()}
              alt={props.media.filename}
              loading="lazy"
              class="absolute inset-0 h-full w-full bg-white object-cover"
            />
          }
        >
          <video
            src={fileUrl()}
            muted
            playsinline
            preload="metadata"
            class="absolute inset-0 h-full w-full object-cover"
          />
        </Show>
      </div>
      <div class="flex flex-1 flex-col justify-between">
        <CardHeader class="pb-2">
          <CardTitle class="break-all text-sm font-semibold">
            {props.media.filename}
          </CardTitle>
          <Show when={description()}>
            <CardDescription>{description()}</CardDescription>
          </Show>
        </CardHeader>
        <CardFooter class="flex flex-wrap gap-2">
          <Show
            when={tagNames().length > 0}
            fallback={
              <span class="text-[11px] uppercase tracking-wide text-slate-400">
                No tags
              </span>
            }
          >
            <For each={tagNames()}>
              {(name) => <TagBadge name={name} />}
            </For>
          </Show>
        </CardFooter>
      </div>
    </Card>
  );
}

export default MediaCard;
