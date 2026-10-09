import { convertFileSrc } from "@tauri-apps/api/core";
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
  title: string;
  items: NormalizedMedia[];
  grouped: boolean;
  onSelect: () => void;
}

function MediaCard(props: MediaCardProps) {
  const preview = () =>
    props.items.find((item) => item.mediatype === "PHOTO") ?? props.items[0];
  const tagNames = () => {
    const names = props.items.flatMap(
      (item) => item.tags?.map((tag) => tag.name) ?? []
    );
    return [...new Set(names)];
  };
  const description = () => {
    if (props.grouped && props.items.length > 1) return "";
    const text = props.items[0]?.description;
    if (!text) return "";
    return text.length >= 100 ? `${text.slice(0, 100)}...` : text;
  };
  const fileUrl = () => {
    const item = preview();
    if (!item) return "";
    return item.fileUrl || convertFileSrc(item.filepath);
  };
  const countLabel = () =>
    props.items.length === 1 ? "1 item" : `${props.items.length} items`;

  return (
    <Card
      class="flex w-full cursor-pointer flex-col transition hover:-translate-y-[1px] hover:border-emerald-200 hover:shadow-md"
      data-testid="gallery-card"
      data-grouped={props.grouped ? "true" : "false"}
      onClick={() => props.onSelect()}
    >
      <div class="relative aspect-video w-full overflow-hidden rounded-t-xl bg-slate-100">
        <Show
          when={preview()?.mediatype === "VIDEO"}
          fallback={
            <img
              src={fileUrl()}
              alt={preview()?.filename ?? props.title}
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
        <Show when={props.grouped}>
          <span
            data-testid="group-count"
            class="absolute right-2 top-2 rounded-full bg-slate-900/80 px-2 py-1 text-xs font-semibold text-white"
          >
            {countLabel()}
          </span>
        </Show>
      </div>
      <div class="flex flex-1 flex-col justify-between">
        <CardHeader class="pb-2">
          <CardTitle
            data-testid="gallery-card-title"
            class="break-all text-sm font-semibold"
          >
            {props.title}
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
