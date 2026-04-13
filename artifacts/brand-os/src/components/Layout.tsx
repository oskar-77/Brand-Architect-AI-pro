import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Sparkles, PlusCircle, Menu, X,
  ImageIcon, Users, Settings, LogOut, Building2, ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDashboardSummaryQueryKey, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/brands/new", label: "New Brand", icon: PlusCircle, exact: true },
  { href: "/media", label: "Media Library", icon: ImageIcon, exact: false },
  { href: "/team", label: "Team", icon: Users, exact: false },
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
];

function usePrefetchCoreData() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const prefetchIfMissing = async (queryKey: unknown[], url: string) => {
      const existing = queryClient.getQueryData(queryKey);
      if (existing) return;
      try {
        const res = await fetch(`${baseUrl}${url}`);
        if (res.ok) queryClient.setQueryData(queryKey, await res.json());
      } catch {}
    };
    prefetchIfMissing(getGetDashboardSummaryQueryKey(), "/api/dashboard/summary");
    prefetchIfMissing(getListBrandsQueryKey(), "/api/brands");
  }, [queryClient]);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wsDropdown, setWsDropdown] = useState(false);
  const { user, workspace, workspaces, logout, switchWorkspace } = useAuth();
  usePrefetchCoreData();

  const topNav = navItems.slice(0, 2);
  const bottomNav = navItems.slice(2);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo + Workspace */}
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
          </div>

          {workspace ? (
            <div className="flex-1 min-w-0 relative">
              <button
                onClick={() => setWsDropdown((v) => !v)}
                className="flex items-center gap-1.5 w-full text-left group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate">{workspace.name}</p>
                  <p className="text-[10px] text-sidebar-foreground/40 capitalize">{workspace.role ?? "member"}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/40 flex-shrink-0" />
              </button>

              {wsDropdown && workspaces.length > 1 && (
                <div className="absolute left-0 top-full mt-2 w-52 bg-popover border border-border rounded-xl shadow-lg py-1 z-50">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => { switchWorkspace(ws); setWsDropdown(false); }}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                        ws.id === workspace.id ? "text-primary font-medium" : "text-foreground"
                      )}
                    >
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{ws.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">Brand OS</span>
          )}

          <button
            className="ml-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground flex-shrink-0"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {topNav.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? location === item.href : location.startsWith(item.href) && item.href !== "/";
            const rootActive = item.exact && item.href === "/" && location === "/";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  (active || rootActive)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}

          <div className="pt-4 pb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/30">Tools</p>
          </div>

          {bottomNav.map((item) => {
            const Icon = item.icon;
            const active = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="px-3 py-4 border-t border-sidebar-border">
          {user ? (
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold text-xs">{user.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-sidebar-foreground/40 truncate">{user.email}</p>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="px-2">
              <p className="text-[11px] text-sidebar-foreground/40 font-medium tracking-wider uppercase">AI Brand OS</p>
              <p className="text-[11px] text-sidebar-foreground/30 mt-0.5">v2.0 SaaS</p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="lg:hidden h-14 border-b border-border flex items-center px-4 bg-background/95 backdrop-blur sticky top-0 z-30">
          <button className="text-foreground/60 hover:text-foreground" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm text-foreground">Brand OS</span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
