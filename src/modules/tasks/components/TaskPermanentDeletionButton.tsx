import { useState } from 'react';
import { Trash2 } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  TASK_PERMANENT_DELETION_CONFIRMATION,
  type TaskPermanentDeletionPreview,
  type TaskPermanentDeletionResult,
  type TaskPermanentDeletionRootType,
  type TaskPermanentDeletionService,
} from '@/modules/tasks/data/taskPermanentDeletionService';

export function TaskPermanentDeletionButton({
  rootType,
  rootId,
  title,
  service,
  available,
  unavailableReason,
  onDeleted,
}: {
  rootType: TaskPermanentDeletionRootType;
  rootId: string;
  title: string;
  service: TaskPermanentDeletionService;
  available: boolean;
  unavailableReason?: string;
  onDeleted: (result: TaskPermanentDeletionResult) => Promise<void> | void;
}) {
  const [preview, setPreview] = useState<TaskPermanentDeletionPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (deleting) return;
    setPreview(null);
    setConfirmation('');
    setError(null);
  };

  const openPreview = async () => {
    if (!available || loadingPreview) return;
    setLoadingPreview(true);
    setError(null);
    try {
      setPreview(await service.preview(rootType, rootId));
    } catch (previewError) {
      toast({
        title: 'Permanent Deletion Could Not Be Previewed',
        description: getErrorMessage(previewError),
        variant: 'destructive',
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const confirmDeletion = async () => {
    if (
      !preview
      || deleting
      || !available
      || confirmation !== TASK_PERMANENT_DELETION_CONFIRMATION
    ) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await service.execute(preview, confirmation);
      await onDeleted(result);
      toast({ title: `${rootType === 'project' ? 'Project' : 'Task'} Permanently Deleted` });
      setPreview(null);
      setConfirmation('');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  };

  const hierarchyCount = preview ? countArrays(preview.hierarchy) : 0;
  const relatedCount = preview ? countArrays(preview.related) : 0;
  const preservedCount = preview ? countArrays(preview.preserved_receipts) : 0;

  return (
    <>
      <Button
        type="button"
        variant="outline-destructive"
        size="sm"
        disabled={!available || loadingPreview}
        title={!available ? unavailableReason : undefined}
        aria-label={`Permanently Delete ${title}`}
        className="gap-1.5"
        onClick={() => void openPreview()}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete Permanently
      </Button>

      <AlertDialog open={preview !== null} onOpenChange={(open) => { if (!open) close(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently Delete {rootType === 'project' ? 'Project' : 'Task'}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody className="space-y-4">
            <AlertDialogDescription>
              This action cannot be undone. The server will erase the current deletion scope for
              {' '}<span className="font-medium text-foreground">{preview?.root.title}</span>.
            </AlertDialogDescription>
            {preview ? (
              <div className="space-y-2 rounded-md border border-border p-3 text-sm">
                <p>
                  <span className="font-medium">{preview.erased_record_count}</span>
                  {' '}records will be erased: {hierarchyCount} hierarchy records and {relatedCount}
                  {' '}history, Mail, or reminder records.
                </p>
                <p className="text-muted-foreground">
                  {preservedCount} content-free duplicate-suppression
                  {' '}{preservedCount === 1 ? 'receipt will' : 'receipts will'} remain.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <label htmlFor={`permanent-delete-${rootId}`} className="text-sm font-medium">
                Confirmation <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <p className="text-xs text-muted-foreground">
                Enter <span className="font-mono text-foreground">{TASK_PERMANENT_DELETION_CONFIRMATION}</span>
                {' '}to continue.
              </p>
              <Input
                id={`permanent-delete-${rootId}`}
                value={confirmation}
                disabled={deleting}
                autoComplete="off"
                aria-required="true"
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {!available ? (
              <p role="status" className="text-sm text-warning">
                {unavailableReason ?? 'Wait for current server state before continuing'}
              </p>
            ) : null}
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep in Trash</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                deleting
                || !available
                || confirmation !== TASK_PERMANENT_DELETION_CONFIRMATION
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDeletion();
              }}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function countArrays(value: Record<string, string[]>): number {
  return Object.values(value).reduce((total, items) => total + items.length, 0);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not be completed';
}
