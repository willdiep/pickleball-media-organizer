import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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
  onClose: () => void;
  onDeleteAll: () => Promise<void>;
}

const AppMenuModal = ({ onClose, onDeleteAll }: AppMenuModalProps) => {
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isDeleting) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (confirming) {
        setConfirming(false);
        setDeleteError(null);
        return;
      }
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [confirming, isDeleting, onClose]);

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

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !confirming && !isDeleting) onClose();
        }}
      >
        <DialogContent
          data-testid="app-menu-modal"
          className="max-w-sm"
          onEscapeKeyDown={(event) => {
            if (confirming || isDeleting) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (confirming || isDeleting) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>pickleball-media-organizer</DialogTitle>
            <DialogDescription>
              Organize pickleball photos and videos from a local folder.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Shortcut: Ctrl + ,</p>
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
    </>
  );
};

export default AppMenuModal;
