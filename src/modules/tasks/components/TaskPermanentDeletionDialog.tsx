import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { TaskPermanentDeletionPreview } from '@/modules/tasks/data/taskPermanentDeletionService';

export function TaskPermanentDeletionDialog({
  preview,
  pending,
  onCancel,
  onConfirm,
}: {
  preview: TaskPermanentDeletionPreview | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const recordLabel = preview?.erased_record_count === 1 ? 'record' : 'records';

  return (
    <AlertDialog
      open={preview !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Task Permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogBody>
          {preview ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{preview.root.title}</p>
              <p className="text-muted-foreground">
                {preview.erased_record_count} {recordLabel} will be permanently deleted.
              </p>
            </div>
          ) : null}
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-destructive-foreground"
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {pending ? 'Deleting...' : 'Delete Permanently'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
