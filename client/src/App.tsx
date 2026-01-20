import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import AdminDashboard from "@/pages/admin/dashboard";
import SitesPage from "@/pages/admin/sites";
import QRManagementPage from "@/pages/admin/qr-management";
import UsersPage from "@/pages/admin/users";
import ContactsPage from "@/pages/admin/contacts";
import GuardHome from "@/pages/guard/home";
import GuardVacation from "@/pages/guard/vacation";
import AdminVacationRequests from "@/pages/admin/vacation-requests";
import AdminVacationStatus from "@/pages/admin/vacation-status";

function AdminLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 items-center justify-between gap-4 border-b bg-card px-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ProtectedAdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  if (user.role !== "admin") {
    return <Redirect to="/guard" />;
  }

  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function ProtectedGuardRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  if (user.role !== "guard") {
    return <Redirect to="/admin" />;
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

  return (
    <Switch>
      <Route path="/">
        {user ? (
          <Redirect to={user.role === "admin" ? "/admin" : "/guard"} />
        ) : (
          <LoginPage />
        )}
      </Route>
      <Route path="/admin">
        <ProtectedAdminRoute component={AdminDashboard} />
      </Route>
      <Route path="/admin/qr">
        <ProtectedAdminRoute component={QRManagementPage} />
      </Route>
      <Route path="/admin/sites">
        <ProtectedAdminRoute component={SitesPage} />
      </Route>
      <Route path="/admin/users">
        <ProtectedAdminRoute component={UsersPage} />
      </Route>
      <Route path="/admin/contacts">
        <ProtectedAdminRoute component={ContactsPage} />
      </Route>
      <Route path="/admin/vacation-requests">
        <ProtectedAdminRoute component={AdminVacationRequests} />
      </Route>
      <Route path="/admin/vacation-status">
        <ProtectedAdminRoute component={AdminVacationStatus} />
      </Route>
      <Route path="/guard">
        <ProtectedGuardRoute component={GuardHome} />
      </Route>
      <Route path="/guard/vacation">
        <ProtectedGuardRoute component={GuardVacation} />
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
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
