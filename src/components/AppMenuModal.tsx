import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { LibraryRoot } from "@/types/media";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AppMenuModalProps {
  roots: LibraryRoot[];
  busy: boolean;
  onClose: () => void;
  onDeleteAll: () => Promise<void>;
  onRescan: (rootId: number) => Promise<void>;
  onRemove: (rootId: number) => Promise<void>;
}

const AppMenuModal = ({
  roots,
  busy,
  onClose,
  onDeleteAll,
  onRescan,
  onRemove,
}: AppMenuModalProps) => {
  const [confirming, setConfirming] = useState(false);
  const [pendingRoot, setPendingRoot] = useState<LibraryRoot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isDeleting || isRemoving) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (pendingRoot) {
        setPendingRoot(null);
        setRemoveError(null);
        return;
      }
      if (confirming) {
        setConfirming(false);
        setDeleteError(null);
        return;
      }
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [confirming, isDeleting, isRemoving, onClose, pendingRoot]);

  const confirmDeleteAll = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteAll();
      if (mounted.current) onClose();
    } catch (error) {
      if (!mounted.current) return;
      setDeleteError(error instanceof Error ? error.message : String(error));
    } finally {
      if (mounted.current) setIsDeleting(false);
    }
  };

  const confirmRemove = async () => {
    if (!pendingRoot) return;
    setIsRemoving(true);
    setRemoveError(null);
    try {
      await onRemove(pendingRoot.id);
      if (mounted.current) setPendingRoot(null);
    } catch (error) {
      if (!mounted.current) return;
      setRemoveError(error instanceof Error ? error.message : String(error));
    } finally {
      if (mounted.current) setIsRemoving(false);
    }
  };

  const blocked = confirming || pendingRoot !== null || isDeleting || isRemoving;

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !blocked) onClose();
        }}
      >
        <DialogContent
          data-testid="app-menu-modal"
          className="max-w-md"
          onEscapeKeyDown={(event) => {
            if (blocked) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (blocked) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>pickleball-media-organizer</DialogTitle>
            <DialogDescription>
              Organize pickleball photos and videos from a local folder.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Shortcut: Ctrl + ,</p>
          <div className="max-h-64 space-y-3 overflow-auto" data-testid="library-roots">
            <p className="text-xs font-medium text-muted-foreground">Folders</p>
            {roots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No folders imported yet</p>
            ) : (
              roots.map((root) => (
                <div key={root.id} className="space-y-2 rounded-lg border px-3 py-2">
                  <p className="break-all font-mono text-xs">{root.path}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {root.mediaCount} {root.mediaCount === 1 ? "file" : "files"}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void onRescan(root.id)}
                      >
                        Rescan
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setRemoveError(null);
                          setPendingRoot(root);
                        }}
                      >
                        Remove from library
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              Delete all
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setConfirming(open);
          if (!open) setDeleteError(null);
        }}
      >
        <AlertDialogContent data-testid="delete-all-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all media?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you wish to delete all media? This removes every
              photo and video from the library. Files on disk are left in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteAll();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingRoot !== null}
        onOpenChange={(open) => {
          if (isRemoving) return;
          if (!open) {
            setPendingRoot(null);
            setRemoveError(null);
          }
        }}
      >
        <AlertDialogContent data-testid="remove-root-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this folder from the library?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {pendingRoot?.mediaCount ?? 0}{" "}
              {pendingRoot?.mediaCount === 1 ? "file" : "files"} from{" "}
              {pendingRoot?.path}? This drops those library rows. Files on disk
              are left in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removeError ? (
            <p className="text-sm text-destructive">{removeError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmRemove();
              }}
            >
              {isRemoving ? "Removing..." : "Remove from library"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AppMenuModal;
