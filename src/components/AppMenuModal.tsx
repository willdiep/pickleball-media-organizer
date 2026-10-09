import { onCleanup, onMount } from "solid-js";

import { Button } from "@/components/ui/button";

interface AppMenuModalProps {
  onClose: () => void;
}

const AppMenuModal = (props: AppMenuModalProps) => {
  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      props.onClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown, true));
  });

  return (
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4"
      onClick={() => props.onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-menu-title"
        data-testid="app-menu-modal"
        class="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p class="text-xs uppercase tracking-wide text-slate-500">Application</p>
        <h2 id="app-menu-title" class="mt-1 text-lg text-slate-900">
          pickleball-media-organizer
        </h2>
        <p class="mt-3 text-sm leading-relaxed text-slate-600">
          Organize pickleball photos and videos from a local folder.
        </p>
        <p class="mt-4 text-xs text-slate-400">Cmd + ,</p>
        <div class="mt-6 flex justify-end">
          <Button
            onClick={() => props.onClose()}
            class="bg-emerald-600 px-4 py-2 text-sm text-white shadow-sm hover:bg-emerald-700"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppMenuModal;
