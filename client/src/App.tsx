import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteManagerSidebar } from "@/components/site-manager-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import { CompanyProvider, useCompany } from "@/lib/company";

// HQ Admin pages
import HqAdminDashboard from "@/pages/hq-admin/dashboard";
import HqAdminSites from "@/pages/hq-admin/sites";
import HqAdminUsers from "@/pages/hq-admin/users";
import HqAdminQRManagement from "@/pages/hq-admin/qr-management";
import HqAdminVacationRequests from "@/pages/hq-admin/vacation-requests";
import HqAdminVacationStatus from "@/pages/hq-admin/vacation-status";
import HqAdminManagers from "@/pages/hq-admin/managers";

// Site Manager pages
import SiteManagerDashboard from "@/pages/site-manager/dashboard";
import SiteManagerWorkers from "@/pages/site-manager/workers";
import SiteManagerAttendance from "@/pages/site-manager/attendance";
import SiteManagerVacations from "@/pages/site-manager/vacations";
import SiteManagerManagers from "@/pages/site-manager/managers";

// Worker pages
import WorkerHome from "@/pages/worker/home";
import WorkerVacation from "@/pages/worker/vacation";

import { PrintHeader } from "@/components/print-header";

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { company } = useCompany();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties} key={company.id}>
      <div className="flex h-screen w-full">
        <div className="print:hidden">
          <AppSidebar />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 items-center justify-between gap-4 border-b bg-card px-4 print:hidden">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 print:overflow-visible">
            <PrintHeader />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function SiteManagerLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <div className="print:hidden">
          <SiteManagerSidebar />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 items-center justify-between gap-4 border-b bg-card px-4 print:hidden">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 print:overflow-visible">
            <PrintHeader />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ProtectedHqAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Redirect to="/" />;
  if (user.role !== "hq_admin") {
    if (user.role === "site_manager") return <Redirect to="/site-manager" />;
    return <Redirect to="/worker" />;
  }

  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function ProtectedSiteManagerRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Redirect to="/" />;
  if (user.role !== "site_manager") {
    if (user.role === "hq_admin") return <Redirect to="/hq-admin" />;
    return <Redirect to="/worker" />;
  }

  return (
    <SiteManagerLayout>
      <Component />
    </SiteManagerLayout>
  );
}

function ProtectedWorkerRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Redirect to="/" />;
  if (user.role !== "worker") {
    if (user.role === "hq_admin") return <Redirect to="/hq-admin" />;
    return <Redirect to="/site-manager" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const getRedirectPath = () => {
    if (!user) return "/";
    switch (user.role) {
      case "hq_admin": return "/hq-admin";
      case "site_manager": return "/site-manager";
      case "worker": return "/worker";
      default: return "/";
    }
  };

  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to={getRedirectPath()} /> : <LoginPage />}
      </Route>

      {/* HQ Admin routes */}
      <Route path="/hq-admin">
        <ProtectedHqAdminRoute component={HqAdminDashboard} />
      </Route>
      <Route path="/hq-admin/sites">
        <ProtectedHqAdminRoute component={HqAdminSites} />
      </Route>
      <Route path="/hq-admin/users">
        <ProtectedHqAdminRoute component={HqAdminUsers} />
      </Route>
      <Route path="/hq-admin/qr">
        <ProtectedHqAdminRoute component={HqAdminQRManagement} />
      </Route>
      <Route path="/hq-admin/vacation-requests">
        <ProtectedHqAdminRoute component={HqAdminVacationRequests} />
      </Route>
      <Route path="/hq-admin/vacation-status">
        <ProtectedHqAdminRoute component={HqAdminVacationStatus} />
      </Route>
      <Route path="/hq-admin/managers">
        <ProtectedHqAdminRoute component={HqAdminManagers} />
      </Route>

      {/* Site Manager routes */}
      <Route path="/site-manager">
        <ProtectedSiteManagerRoute component={SiteManagerDashboard} />
      </Route>
      <Route path="/site-manager/workers">
        <ProtectedSiteManagerRoute component={SiteManagerWorkers} />
      </Route>
      <Route path="/site-manager/attendance">
        <ProtectedSiteManagerRoute component={SiteManagerAttendance} />
      </Route>
      <Route path="/site-manager/vacations">
        <ProtectedSiteManagerRoute component={SiteManagerVacations} />
      </Route>
      <Route path="/site-manager/managers">
        <ProtectedSiteManagerRoute component={SiteManagerManagers} />
      </Route>

      {/* Worker routes */}
      <Route path="/worker">
        <ProtectedWorkerRoute component={WorkerHome} />
      </Route>
      <Route path="/worker/vacation">
        <ProtectedWorkerRoute component={WorkerVacation} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}



function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CompanyProvider>
            <Toaster />
            <Router />
          </CompanyProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
