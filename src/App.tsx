import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { AuthProvider } from "@/platform/contexts/AuthContext";
import LauncherPage from "@/platform/components/LauncherPage";
import AccountPage from "@/platform/components/AccountPage";
import ForgotPasswordPage from "@/platform/components/ForgotPasswordPage";
import ResetPasswordPage from "@/platform/components/ResetPasswordPage";
import TermsPage from "@/platform/components/TermsPage";
import AdminPage from "@/platform/components/AdminPage";
import HelpPage from "@/platform/components/HelpPage";
import OAuthConsentPage from "@/platform/components/OAuthConsentPage";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import TermsGate from "@/platform/components/TermsGate";
import AuthCallbackToasts from "@/platform/components/AuthCallbackToasts";
import { InstalledAppNavigationBoundary } from "@/platform/components/InstalledAppNavigationBoundary";
import { useDocumentHead } from "@/platform/hooks/useDocumentHead";
import { useAuthContext } from "@/platform/contexts/AuthContext";
import { useIsAdmin } from "@/platform/hooks/useIsAdmin";
import { useModuleAccess } from "@/platform/hooks/useModuleAccess";
import { getModuleById, type PlatformModuleId } from "@/platform/modules";
import { useBathosFormInteractions } from "@/platform/hooks/useCommandEnterSubmit";
import { queryClient } from "@/platform/queryClient";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DataGridHistoryProvider } from "@/components/ui/data-grid-history";
import Index from "./pages/Index";
import DrawersIndex from "@/modules/drawers/DrawersIndex";
import GarageIndex from "@/modules/garage/GarageIndex";
import SnakeIndex from "@/modules/snake/SnakeIndex";
import WardrobeIndex from "@/modules/wardrobe/WardrobeIndex";
import { isSupportedTaskRoute } from "@/modules/tasks/routes";
import NotFound from "./pages/NotFound";

const TasksIndex = lazy(() => import("@/modules/tasks/TasksIndex"));

function DeferredNotFound() {
  const location = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(false);
    const timer = window.setTimeout(() => setShow(true), 250);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search, location.hash]);

  if (!show) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return <NotFound />;
}

function DocumentHead() {
  useDocumentHead();
  return null;
}

function GlobalFormInteractions() {
  useBathosFormInteractions();
  return null;
}

function ModuleAccessRoute({
  moduleId,
  children,
}: {
  moduleId: Exclude<PlatformModuleId, 'admin'>;
  children: ReactNode;
}) {
  const { user, loading: authLoading } = useAuthContext();
  const { isAdmin, loading: roleLoading, resolved: roleResolved } = useIsAdmin(user?.id);
  const { access, loading: accessLoading, resolved: accessResolved } = useModuleAccess(user?.id);

  if (authLoading || (!!user && (roleLoading || !roleResolved || accessLoading || !accessResolved))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  const moduleAccess = access[moduleId];
  const isRestricted = moduleAccess?.isRestricted
    ?? getModuleById(moduleId)?.restrictedByDefault === true;
  if (user && !isAdmin && isRestricted && moduleAccess?.hasAccess !== true) {
    return <NotFound />;
  }

  return children;
}

function TasksRoute() {
  const location = useLocation();

  if (!isSupportedTaskRoute(location.pathname)) {
    return <DeferredNotFound />;
  }

  return (
    <ModuleAccessRoute moduleId="tasks">
      <Suspense
        fallback={(
          <div className="flex min-h-screen items-center justify-center bg-background">
            <LoadingSpinner />
          </div>
        )}
      >
        <TasksIndex />
      </Suspense>
    </ModuleAccessRoute>
  );
}

export function ScrollToTopOnPathnameChange() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}

export function AppRoutes() {
  const location = useLocation();
  const tasksOwnPullGesture = location.pathname === '/tasks'
    || location.pathname.startsWith('/tasks/');

  return (
    <PullToRefresh disabled={tasksOwnPullGesture}>
      <GlobalFormInteractions />
      <InstalledAppNavigationBoundary />
      <ScrollToTopOnPathnameChange />
      <Routes>
        <Route path="/" element={<LauncherPage />} />
        <Route path="/signin" element={<LauncherPage />} />
        <Route path="/signup" element={<LauncherPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsentPage />} />

        {/* Budget module */}
        <Route path="/budget" element={<Navigate to="/budget/summary" replace />} />
        <Route path="/budget/incomes" element={<ModuleAccessRoute moduleId="budget"><Index /></ModuleAccessRoute>} />
        <Route path="/budget/expenses" element={<ModuleAccessRoute moduleId="budget"><Index /></ModuleAccessRoute>} />
        <Route path="/budget/summary" element={<ModuleAccessRoute moduleId="budget"><Index /></ModuleAccessRoute>} />
        <Route path="/budget/config" element={<ModuleAccessRoute moduleId="budget"><Index /></ModuleAccessRoute>} />
        <Route path="/budget/restore" element={<Navigate to="/budget/config" replace />} />

        {/* Drawers module */}
        <Route path="/drawers" element={<Navigate to="/drawers/plan" replace />} />
        <Route path="/drawers/plan" element={<ModuleAccessRoute moduleId="drawers"><DrawersIndex /></ModuleAccessRoute>} />
        <Route path="/drawers/config" element={<ModuleAccessRoute moduleId="drawers"><DrawersIndex /></ModuleAccessRoute>} />

        {/* Garage module */}
        <Route path="/garage" element={<Navigate to="/garage/due" replace />} />
        <Route path="/garage/due" element={<ModuleAccessRoute moduleId="garage"><GarageIndex /></ModuleAccessRoute>} />
        <Route path="/garage/services" element={<ModuleAccessRoute moduleId="garage"><GarageIndex /></ModuleAccessRoute>} />
        <Route path="/garage/servicings" element={<ModuleAccessRoute moduleId="garage"><GarageIndex /></ModuleAccessRoute>} />
        <Route path="/garage/config" element={<ModuleAccessRoute moduleId="garage"><GarageIndex /></ModuleAccessRoute>} />

        {/* Snake module */}
        <Route path="/snake" element={<Navigate to="/snake/weights" replace />} />
        <Route path="/snake/weights" element={<ModuleAccessRoute moduleId="snake"><SnakeIndex /></ModuleAccessRoute>} />
        <Route path="/snake/config" element={<ModuleAccessRoute moduleId="snake"><SnakeIndex /></ModuleAccessRoute>} />

        {/* Wardrobe module */}
        <Route path="/wardrobe" element={<Navigate to="/wardrobe/items" replace />} />
        <Route path="/wardrobe/items" element={<ModuleAccessRoute moduleId="wardrobe"><WardrobeIndex /></ModuleAccessRoute>} />
        <Route path="/wardrobe/config" element={<ModuleAccessRoute moduleId="wardrobe"><WardrobeIndex /></ModuleAccessRoute>} />

        {/* Tasks module */}
        <Route path="/tasks" element={<Navigate to="/tasks/today" replace />} />
        <Route path="/tasks/inbox" element={<Navigate to="/tasks/today" replace />} />
        <Route path="/tasks/logbook" element={<Navigate to="/tasks/done" replace />} />
        <Route path="/tasks/trash" element={<Navigate to="/tasks/done" replace />} />
        <Route path="/tasks/*" element={<TasksRoute />} />

        {/* Legacy routes */}
        <Route path="/incomes" element={<Navigate to="/budget/incomes" replace />} />
        <Route path="/expenses" element={<Navigate to="/budget/expenses" replace />} />
        <Route path="/summary" element={<Navigate to="/budget/summary" replace />} />
        <Route path="/config" element={<Navigate to="/budget/config" replace />} />
        <Route path="/restore" element={<Navigate to="/budget/config" replace />} />

        <Route path="*" element={<DeferredNotFound />} />
      </Routes>
    </PullToRefresh>
  );
}

export function RouteScopedDataGridHistory({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <DataGridHistoryProvider resetKey={location.pathname}>
      {children}
    </DataGridHistoryProvider>
  );
}

export function BathOSBrowserRouter({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BathOSBrowserRouter>
          <AuthCallbackToasts />
          <DocumentHead />
          <TermsGate />
          <RouteScopedDataGridHistory>
            <AppRoutes />
          </RouteScopedDataGridHistory>
        </BathOSBrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
