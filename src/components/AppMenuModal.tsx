import { createSignal, onCleanup, onMount, Show } from "solid-js";

import { Button } from "@/components/ui/button";

interface AppMenuModalProps {
  onClose: () => void;
  onDeleteAll: () => Promise<void>;
}

const AppMenuModal = (props: AppMenuModalProps) => {
  const [confirming, setConfirming] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isDeleting()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (confirming()) {
        setConfirming(false);
        setDeleteError(null);
        return;
      }
      props.onClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown, true));
  });

  const confirmDeleteAll = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await props.onDeleteAll();
      props.onClose();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4"
      onClick={() => {
        if (!confirming() && !isDeleting()) props.onClose();
      }}
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
        <div class="mt-6 flex items-center justify-between gap-3">
          <Button
            variant="destructive"
            onClick={() => setConfirming(true)}
            class="px-4 py-2 text-sm"
          >
            Delete all
          </Button>
          <Button
            onClick={() => props.onClose()}
            class="bg-emerald-600 px-4 py-2 text-sm text-white shadow-sm hover:bg-emerald-700"
          >
            Close
          </Button>
        </div>
      </div>
      <Show when={confirming()}>
        <div
          class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 px-4"
          onClick={() => {
            if (!isDeleting()) setConfirming(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-all-title"
            data-testid="delete-all-confirm"
            class="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p class="text-xs uppercase tracking-wide text-slate-500">
              Confirm
            </p>
            <h2 id="delete-all-title" class="mt-1 text-lg text-slate-900">
              Delete all media?
            </h2>
            <p class="mt-3 text-sm leading-relaxed text-slate-600">
              Are you sure you wish to delete all media? This removes every
              photo and video from the library. Files on disk are left in
              place.
            </p>
            <Show when={deleteError()}>
              <p class="mt-3 text-sm text-red-600">{deleteError()}</p>
            </Show>
            <div class="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                disabled={isDeleting()}
                onClick={() => {
                  setConfirming(false);
                  setDeleteError(null);
                }}
                class="px-4 py-2 text-sm"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting()}
                onClick={() => void confirmDeleteAll()}
                class="px-4 py-2 text-sm"
              >
                {isDeleting() ? "Deleting..." : "Delete all"}
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AppMenuModal;
