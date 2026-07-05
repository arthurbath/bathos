import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider } from "@/platform/contexts/AuthContext";
import LauncherPage from "@/platform/components/LauncherPage";
import AccountPage from "@/platform/components/AccountPage";
import ForgotPasswordPage from "@/platform/components/ForgotPasswordPage";
import ResetPasswordPage from "@/platform/components/ResetPasswordPage";
import TermsPage from "@/platform/components/TermsPage";
import AdminPage from "@/platform/components/AdminPage";
import HelpPage from "@/platform/components/HelpPage";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import TermsGate from "@/platform/components/TermsGate";
import AuthCallbackToasts from "@/platform/components/AuthCallbackToasts";
import { useDocumentHead } from "@/platform/hooks/useDocumentHead";
import { useCommandEnterSubmit } from "@/platform/hooks/useCommandEnterSubmit";
import { isLikelyNetworkError } from "@/lib/networkErrors";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DataGridHistoryProvider } from "@/components/ui/data-grid-history";
import Index from "./pages/Index";
import DrawersIndex from "@/modules/drawers/DrawersIndex";
import GarageIndex from "@/modules/garage/GarageIndex";
import SnakeIndex from "@/modules/snake/SnakeIndex";
import WardrobeIndex from "@/modules/wardrobe/WardrobeIndex";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (failureCount >= 3) return false;
        return isLikelyNetworkError(error);
      },
      staleTime: 30_000,
    },
  },
});

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

function GlobalCommandEnterSubmit() {
  useCommandEnterSubmit();
  return null;
}

export function ScrollToTopOnPathnameChange() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}

function AppRoutes() {
  return (
    <PullToRefresh>
      <GlobalCommandEnterSubmit />
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

        {/* Budget module */}
        <Route path="/budget" element={<Navigate to="/budget/summary" replace />} />
        <Route path="/budget/incomes" element={<Index />} />
        <Route path="/budget/expenses" element={<Index />} />
        <Route path="/budget/summary" element={<Index />} />
        <Route path="/budget/config" element={<Index />} />
        <Route path="/budget/restore" element={<Navigate to="/budget/config" replace />} />

        {/* Drawers module */}
        <Route path="/drawers" element={<Navigate to="/drawers/plan" replace />} />
        <Route path="/drawers/plan" element={<DrawersIndex />} />
        <Route path="/drawers/config" element={<DrawersIndex />} />

        {/* Garage module */}
        <Route path="/garage" element={<Navigate to="/garage/due" replace />} />
        <Route path="/garage/due" element={<GarageIndex />} />
        <Route path="/garage/services" element={<GarageIndex />} />
        <Route path="/garage/servicings" element={<GarageIndex />} />
        <Route path="/garage/config" element={<GarageIndex />} />

        {/* Snake module */}
        <Route path="/snake" element={<Navigate to="/snake/weights" replace />} />
        <Route path="/snake/weights" element={<SnakeIndex />} />
        <Route path="/snake/config" element={<SnakeIndex />} />

        {/* Wardrobe module */}
        <Route path="/wardrobe" element={<Navigate to="/wardrobe/items" replace />} />
        <Route path="/wardrobe/items" element={<WardrobeIndex />} />

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

function RouteScopedDataGridHistory({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <DataGridHistoryProvider key={location.pathname}>
      {children}
    </DataGridHistoryProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AuthCallbackToasts />
          <DocumentHead />
          <TermsGate />
          <RouteScopedDataGridHistory>
            <AppRoutes />
          </RouteScopedDataGridHistory>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
