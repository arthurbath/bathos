import { useEffect } from 'react';

import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import AuthPage from '@/platform/components/AuthPage';
import { TasksShell } from '@/modules/tasks/components/TasksShell';
import { clearTaskNativeWidgetCache } from '@/modules/tasks/native/taskNativeWidgetBridge';
import { TasksRuntimeProvider } from '@/modules/tasks/runtime/TasksRuntime';

export default function TasksIndex() {
  const { user, loading: authLoading, isSigningOut, signOut, displayName } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      clearTaskNativeWidgetCache();
    }
  }, [authLoading, user]);

  if (authLoading || isSigningOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <TasksRuntimeProvider ownerId={user.id}>
      <TasksShell
        userId={user.id}
        displayName={displayName}
        onSignOut={signOut}
      />
    </TasksRuntimeProvider>
  );
}
