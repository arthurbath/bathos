import { useState, type ChangeEvent } from 'react';
import { DatabaseBackup, Download, Upload } from 'lucide-react';

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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  getTaskExportFilename,
  parseTaskExport,
  serializeTaskExport,
  TASK_REPLACE_RESTORE_CONFIRMATION,
  type TaskExportV12,
  type TaskPortableExport,
  type TaskPortabilityService,
  type TaskReplaceRestorePreparation,
  type TaskRestoreReport,
} from '@/modules/tasks/data/taskPortability';

export function TaskDataPortabilityDialog({
  service,
  replaceAvailable,
  replaceUnavailableReason,
  triggerVariant = 'icon',
}: {
  service: TaskPortabilityService;
  replaceAvailable: boolean;
  replaceUnavailableReason?: string;
  triggerVariant?: 'icon' | 'config';
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taskExport, setTaskExport] = useState<TaskPortableExport | null>(null);
  const [restorePreview, setRestorePreview] = useState<TaskRestoreReport | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparation, setPreparation] = useState<TaskReplaceRestorePreparation | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const resetRestore = () => {
    setTaskExport(null);
    setRestorePreview(null);
    setFileName(null);
    setError(null);
    setPreparation(null);
    setReplaceOpen(false);
    setBackupDownloaded(false);
    setConfirmation('');
    setReplaceError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && busy) return;
    setOpen(nextOpen);
    if (!nextOpen) resetRestore();
  };

  const createBackup = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await service.createExport();
      downloadTaskExport(created, getTaskExportFilename(created.created_at));
      toast({ title: 'Task Backup Downloaded' });
    } catch (exportError) {
      setError(getErrorMessage(exportError));
    } finally {
      setBusy(false);
    }
  };

  const selectRestoreFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    setBusy(true);
    resetRestore();
    setFileName(file.name);
    try {
      const parsed = parseTaskExport(JSON.parse(await file.text()));
      const preview = await service.previewRestore(parsed);
      setTaskExport(parsed);
      setRestorePreview(preview);
    } catch (restoreError) {
      setError(getErrorMessage(restoreError));
    } finally {
      setBusy(false);
    }
  };

  const mergeRestore = async () => {
    if (!taskExport || !restorePreview || busy || countRestoreReport(restorePreview).conflicts > 0) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await service.mergeRestore(taskExport);
      toast({ title: 'Task Backup Merged' });
      resetRestore();
      setOpen(false);
    } catch (restoreError) {
      setError(getErrorMessage(restoreError));
    } finally {
      setBusy(false);
    }
  };

  const prepareReplace = async () => {
    if (
      !taskExport
      || taskExport.schema_version !== 12
      || !replaceAvailable
      || busy
    ) return;
    setBusy(true);
    setError(null);
    setReplaceError(null);
    setBackupDownloaded(false);
    setConfirmation('');
    try {
      const prepared = await service.prepareReplace(taskExport);
      setPreparation(prepared);
      setReplaceOpen(true);
    } catch (prepareError) {
      setError(getErrorMessage(prepareError));
    } finally {
      setBusy(false);
    }
  };

  const downloadPreRestoreBackup = () => {
    if (!preparation) return;
    const timestamp = preparation.backup.created_at.replaceAll(':', '-');
    downloadTaskExport(
      preparation.backup,
      `bathos-tasks-pre-replace-${timestamp}.json`,
    );
    setBackupDownloaded(true);
  };

  const confirmReplace = async () => {
    if (
      !taskExport
      || taskExport.schema_version !== 12
      || !preparation
      || !backupDownloaded
      || !replaceAvailable
      || confirmation !== TASK_REPLACE_RESTORE_CONFIRMATION
      || busy
      || replaceError
    ) return;
    setBusy(true);
    try {
      await service.replace({
        taskExport,
        preparation,
        confirmation,
      });
      toast({ title: 'Task Data Replaced', description: 'Synchronized views will update shortly.' });
      resetRestore();
      setOpen(false);
    } catch (replacementError) {
      setReplaceError(getErrorMessage(replacementError));
    } finally {
      setBusy(false);
    }
  };

  const previewTotals = restorePreview ? countRestoreReport(restorePreview) : null;
  const currentRecordCount = preparation ? countRecord(preparation.current_counts) : 0;
  const incomingRecordCount = preparation ? countRecord(preparation.incoming_counts) : 0;
  const replacementReady = Boolean(
    preparation
    && backupDownloaded
    && replaceAvailable
    && !replaceError
    && confirmation === TASK_REPLACE_RESTORE_CONFIRMATION,
  );

  return (
    <>
      {triggerVariant === 'config' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          aria-label="Open Task Backup and Restore"
          onClick={() => setOpen(true)}
        >
          <DatabaseBackup className="h-4 w-4" aria-hidden="true" />
          Manage Backups
        </Button>
      ) : (
        <Button
          type="button"
          variant="clear"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          aria-label="Task Backup and Restore"
          onClick={() => setOpen(true)}
        >
          <DatabaseBackup className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Task Backup and Restore</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-6">
            <section className="space-y-3" aria-labelledby="task-backup-heading">
              <div>
                <h3 id="task-backup-heading" className="text-sm font-medium">Create Backup</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Download a checksum-protected JSON copy of task data, history, templates, and schedules.
                </p>
              </div>
              <Button type="button" variant="outline" className="gap-2" disabled={busy} onClick={() => void createBackup()}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Download Backup
              </Button>
            </section>

            <section className="space-y-3 border-t border-border pt-5" aria-labelledby="task-restore-heading">
              <div>
                <h3 id="task-restore-heading" className="text-sm font-medium">Restore Backup</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select a BathOS Tasks JSON backup to validate it before any data is written.
                </p>
              </div>
              <label className="inline-flex">
                <span className="sr-only">Select Task Backup</span>
                <Input
                  type="file"
                  accept="application/json,.json"
                  disabled={busy}
                  className="max-w-full file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
                  onChange={(event) => void selectRestoreFile(event)}
                />
              </label>

              {fileName ? <p className="text-xs text-muted-foreground">{fileName}</p> : null}
              {previewTotals ? (
                <div className="space-y-2 rounded-md border border-border p-3 text-sm">
                  <p>
                    Schema {taskExport?.schema_version}: {previewTotals.inserts} inserts,
                    {' '}{previewTotals.matches} matches, and {previewTotals.conflicts} conflicts.
                  </p>
                  {previewTotals.conflicts > 0 ? (
                    <p className="text-warning">
                      Merge restore cannot write while stable identifiers conflict with current data.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {taskExport && restorePreview ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || previewTotals!.conflicts > 0}
                    onClick={() => void mergeRestore()}
                  >
                    Merge Backup
                  </Button>
                  {taskExport.schema_version === 12 ? (
                    <Button
                      type="button"
                      variant="outline-destructive"
                      disabled={busy || !replaceAvailable}
                      title={!replaceAvailable ? replaceUnavailableReason : undefined}
                      onClick={() => void prepareReplace()}
                    >
                      Replace Current Data
                    </Button>
                  ) : (
                    <p className="self-center text-xs text-muted-foreground">
                      Legacy backups support merge restore only.
                    </p>
                  )}
                </div>
              ) : null}
              {taskExport?.schema_version === 12 && !replaceAvailable ? (
                <p role="status" className="text-sm text-warning">
                  {replaceUnavailableReason ?? 'Connect and synchronize task changes before replacing data.'}
                </p>
              ) : null}
            </section>

            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={replaceOpen} onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) {
          setReplaceOpen(false);
          setPreparation(null);
          setBackupDownloaded(false);
          setConfirmation('');
          setReplaceError(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace All Task Data</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogBody className="space-y-4">
            <AlertDialogDescription>
              This removes the current synchronized task graph and restores the selected backup in one transaction.
            </AlertDialogDescription>
            {preparation ? (
              <div className="rounded-md border border-border p-3 text-sm">
                <p>{currentRecordCount} current records will be replaced by {incomingRecordCount} backup records.</p>
                <p className="mt-1 text-muted-foreground">
                  Delivery credentials stay registered. Old task delivery diagnostics are removed.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Button type="button" variant="outline" className="gap-2" disabled={busy} onClick={downloadPreRestoreBackup}>
                <Download className="h-4 w-4" aria-hidden="true" />
                {backupDownloaded ? 'Download Backup Again' : 'Download Required Backup'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Replacement stays disabled until this verified pre-restore backup is downloaded.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="task-replace-confirmation" className="text-sm font-medium">
                Confirmation <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <p className="text-xs text-muted-foreground">
                Enter <span className="font-mono text-foreground">{TASK_REPLACE_RESTORE_CONFIRMATION}</span> to continue.
              </p>
              <Input
                id="task-replace-confirmation"
                value={confirmation}
                autoComplete="off"
                aria-required="true"
                disabled={busy || Boolean(replaceError)}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
            {!replaceAvailable ? (
              <p role="status" className="text-sm text-warning">
                {replaceUnavailableReason ?? 'Reconnect and synchronize task changes before continuing.'}
              </p>
            ) : null}
            {replaceError ? (
              <p role="alert" className="text-sm text-destructive">
                {replaceError} Close this confirmation and prepare a fresh backup before retrying.
              </p>
            ) : null}
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep Current Data</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !replacementReady}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmReplace();
              }}
            >
              Replace Task Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function countRestoreReport(report: TaskRestoreReport) {
  return Object.values(report).reduce(
    (totals, value) => {
      if (
        typeof value === 'object'
        && value !== null
        && 'inserts' in value
        && 'matches' in value
        && 'conflicts' in value
      ) {
        totals.inserts += Number(value.inserts);
        totals.matches += Number(value.matches);
        totals.conflicts += Number(value.conflicts);
      }
      return totals;
    },
    { inserts: 0, matches: 0, conflicts: 0 },
  );
}

function countRecord(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

function downloadTaskExport(taskExport: TaskExportV12 | TaskPortableExport, fileName: string) {
  const url = URL.createObjectURL(new Blob([serializeTaskExport(taskExport)], {
    type: 'application/json',
  }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not be completed';
}
