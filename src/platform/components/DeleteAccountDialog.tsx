import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useAuthContext } from '@/platform/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ isOpen, onOpenChange }: DeleteAccountDialogProps) {
  const { user, signOut } = useAuthContext();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    if (user?.email) setUserEmail(user.email);
  }, [user]);

  const handleOpenChange = (open: boolean) => {
    if (!open) setConfirmText('');
    onOpenChange(open);
  };

  const handleDelete = async () => {
    if (!user || confirmText.toLowerCase() !== userEmail.toLowerCase()) return;
    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-user-account');
      if (error) throw new Error(error.message || 'Failed to delete account');
      if (!data?.success) throw new Error(data?.error || 'Account deletion failed');

      await signOut();
      window.location.href = '/';
    } catch (error) {
      toast({
        title: 'Deletion failed',
        description: error instanceof Error ? error.message : 'There was an error deleting your account.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md z-[90]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">Delete account</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>This action cannot be undone. All your data will be permanently removed. Type your email address to confirm.</p>
              <Input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={userEmail}
                autoComplete="off"
                className="border-destructive/30 focus:border-destructive"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={confirmText.toLowerCase() !== userEmail.toLowerCase() || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
