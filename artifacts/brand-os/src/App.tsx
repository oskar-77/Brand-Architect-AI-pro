import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const BrandWizard = lazy(() => import("@/pages/BrandWizard"));
const BrandKit = lazy(() => import("@/pages/BrandKit"));
const BrandEdit = lazy(() => import("@/pages/BrandEdit"));
const CampaignList = lazy(() => import("@/pages/CampaignList"));
const CampaignWorkspace = lazy(() => import("@/pages/CampaignWorkspace"));
const MediaLibrary = lazy(() => import("@/pages/MediaLibrary"));
const Team = lazy(() => import("@/pages/Team"));
const Settings = lazy(() => import("@/pages/Settings"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 15,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
    </div>
  );
}

function AppLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  const { isLoading, user } = useAuth();

  if (isLoading) return <AppLoader />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route>
          {!user ? (
            <Redirect to="/login" />
          ) : (
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/brands/new" component={BrandWizard} />
                  <Route path="/brands/:id/edit" component={BrandEdit} />
                  <Route path="/brands/:id/campaigns" component={CampaignList} />
                  <Route path="/brands/:id" component={BrandKit} />
                  <Route path="/campaigns/:id" component={CampaignWorkspace} />
                  <Route path="/media" component={MediaLibrary} />
                  <Route path="/team" component={Team} />
                  <Route path="/settings" component={Settings} />
                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </Layout>
          )}
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
