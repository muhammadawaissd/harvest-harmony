import { Link, useLocation } from "@tanstack/react-router";
import { useSeason } from "@/lib/season";
import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Wallet, TrendingUp, Users, Sprout, Calendar, Settings, LogOut, Wheat } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/income", label: "Income", icon: TrendingUp },
  { to: "/farmers", label: "Farmers", icon: Sprout },
  { to: "/owners", label: "Owners", icon: Users },
  { to: "/seasons", label: "Seasons", icon: Calendar },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { seasons, current, setCurrentId } = useSeason();
  const { user, signOut } = useAuth();
  const loc = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <aside className="md:w-60 md:min-h-screen bg-sidebar border-b md:border-b-0 md:border-r border-sidebar-border flex md:flex-col">
        <div className="p-4 flex items-center gap-2 border-r md:border-r-0 md:border-b border-sidebar-border">
          <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Wheat className="size-5" />
          </div>
          <div className="hidden md:block">
            <div className="font-semibold text-sidebar-foreground leading-tight">Harvester</div>
            <div className="text-xs text-muted-foreground">Owners Ledger</div>
          </div>
        </div>
        <nav className="flex-1 flex md:flex-col gap-1 p-2 overflow-x-auto">
          {nav.map((n) => {
            const active = loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden md:inline">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block p-3 border-t border-sidebar-border text-xs text-muted-foreground">
          <div className="truncate mb-2">{user?.email}</div>
          <Button size="sm" variant="outline" className="w-full" onClick={() => signOut()}>
            <LogOut className="size-3 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">Active season</div>
            <div className="flex items-center gap-2">
              <Select value={current?.id ?? ""} onValueChange={setCurrentId}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Select season" /></SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
