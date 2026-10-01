import { For, Show } from "solid-js";

import type { Tag } from "@/types/media";

interface SidebarProps {
  tags: Tag[];
  selectedTag: string;
  onSelectTag: (tag: string) => void;
}

const Sidebar = (props: SidebarProps) => (
  <aside class="flex h-full w-64 flex-col border-r border-slate-200 bg-white/60 p-4 backdrop-blur">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500">Library</p>
      </div>
    </div>
    <div class="space-y-4">
      <div>
        <p class="text-[11px] uppercase tracking-wide text-slate-500">Views</p>
        <button
          onClick={() => props.onSelectTag("all")}
          class={`mt-2 flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold ${
            props.selectedTag === "all"
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <span>All Media</span>
        </button>
      </div>
      <div>
        <p class="text-[11px] uppercase tracking-wide text-slate-500">
          Categories
        </p>
        <div class="mt-2 space-y-2">
          <Show when={props.tags.length === 0}>
            <p class="text-xs text-slate-400">No tags yet.</p>
          </Show>
          <For each={props.tags}>
            {(tag) => (
              <button
                onClick={() => props.onSelectTag(tag.name)}
                class={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold ${
                  props.selectedTag === tag.name
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span class="capitalize">{tag.name}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  </aside>
);

export default Sidebar;
