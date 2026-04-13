import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import BrandWizard from "@/pages/BrandWizard";
import BrandKit from "@/pages/BrandKit";
import BrandEdit from "@/pages/BrandEdit";
import CampaignList from "@/pages/CampaignList";
import CampaignWorkspace from "@/pages/CampaignWorkspace";
import Layout from "@/components/Layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/brands/new" component={BrandWizard} />
        <Route path="/brands/:id/edit" component={BrandEdit} />
        <Route path="/brands/:id/campaigns" component={CampaignList} />
        <Route path="/brands/:id" component={BrandKit} />
        <Route path="/campaigns/:id" component={CampaignWorkspace} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
