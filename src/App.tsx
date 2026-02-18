import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/platform/contexts/AuthContext";
import { useHostModule } from "@/platform/hooks/useHostModule";
import LauncherPage from "@/platform/components/LauncherPage";
import AccountPage from "@/platform/components/AccountPage";
import ForgotPasswordPage from "@/platform/components/ForgotPasswordPage";
import ResetPasswordPage from "@/platform/components/ResetPasswordPage";
import TermsPage from "@/platform/components/TermsPage";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

function BudgetRoutes() {
  return (
    <>
      <Route path="/incomes" element={<Index />} />
      <Route path="/expenses" element={<Index />} />
      <Route path="/summary" element={<Index />} />
      <Route path="/config" element={<Index />} />
      <Route path="/restore" element={<Index />} />
    </>
  );
}

function AppRoutes() {
  const module = useHostModule();

  // Budget module via subdomain (budget.bath.garden)
  if (module === 'budget') {
    const isSubdomain = window.location.hostname.endsWith('.bath.garden');

    if (isSubdomain) {
      return (
        <Routes>
          <Route path="/" element={<Navigate to="/summary" replace />} />
          {BudgetRoutes()}
          <Route path="/account" element={<AccountPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      );
    }
  }

  // Platform root + path-based budget fallback for dev/preview
  return (
    <Routes>
      <Route path="/" element={<LauncherPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/terms" element={<TermsPage />} />

      {/* Path-based budget routes for dev/preview */}
      <Route path="/budget" element={<Navigate to="/budget/summary" replace />} />
      <Route path="/budget/incomes" element={<Index />} />
      <Route path="/budget/expenses" element={<Index />} />
      <Route path="/budget/summary" element={<Index />} />
      <Route path="/budget/config" element={<Index />} />
      <Route path="/budget/restore" element={<Index />} />

      {/* Legacy routes - redirect to path-based */}
      <Route path="/incomes" element={<Navigate to="/budget/incomes" replace />} />
      <Route path="/expenses" element={<Navigate to="/budget/expenses" replace />} />
      <Route path="/summary" element={<Navigate to="/budget/summary" replace />} />
      <Route path="/config" element={<Navigate to="/budget/config" replace />} />
      <Route path="/restore" element={<Navigate to="/budget/restore" replace />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
