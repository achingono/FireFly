import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? (Pages as Record<string, React.ComponentType>)[mainPageKey] : null;

// Pages that don't require authentication
const PUBLIC_PAGES = new Set(["Home", "Auth", "Onboarding"]);

const LayoutWrapper = ({ children, currentPageName }: { children: React.ReactNode; currentPageName: string }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const ProtectedRoute = ({ pageName, children }: { pageName: string; children: React.ReactNode }) => {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-violet-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Public pages — accessible without auth
  if (PUBLIC_PAGES.has(pageName)) {
    return <>{children}</>;
  }

  // Not authenticated — redirect to Auth
  if (!isAuthenticated) {
    return <Navigate to="/Auth" state={{ from: location.pathname }} replace />;
  }

  // Authenticated but not onboarded — redirect to Onboarding (unless already there)
  if (user && !user.onboarded && pageName !== "Onboarding") {
    return <Navigate to="/Onboarding" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={
        <ProtectedRoute pageName={mainPageKey}>
          <LayoutWrapper currentPageName={mainPageKey}>
            {MainPage && <MainPage />}
          </LayoutWrapper>
        </ProtectedRoute>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <ProtectedRoute pageName={path}>
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            </ProtectedRoute>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
