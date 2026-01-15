import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import AdminDashboard from "@/pages/admin/dashboard";
import SitesPage from "@/pages/admin/sites";
import GuardHome from "@/pages/guard/home";

function ProtectedRoute({
  component: Component,
  role,
}: {
  component: React.ComponentType;
  role?: "admin" | "guard";
}) {
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

  if (role && user.role !== role) {
    return <Redirect to={user.role === "admin" ? "/admin" : "/guard"} />;
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
        <ProtectedRoute component={AdminDashboard} role="admin" />
      </Route>
      <Route path="/admin/sites">
        <ProtectedRoute component={SitesPage} role="admin" />
      </Route>
      <Route path="/guard">
        <ProtectedRoute component={GuardHome} role="guard" />
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
