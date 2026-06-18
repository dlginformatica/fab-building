import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Wrench, Ticket, Settings, FileText, Users, Bell,
} from "lucide-react";

const items = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/structures", label: "Strutture", icon: Building2 },
  { to: "/app/assets", label: "Asset & Impianti", icon: Wrench },
  { to: "/app/tickets", label: "Ticket", icon: Ticket },
  { to: "/app/sla", label: "Regole SLA", icon: Bell },
  { to: "/app/users", label: "Utenti & Ruoli", icon: Users },
  { to: "/app/docs", label: "Documenti", icon: FileText },
  { to: "/app/settings", label: "Impostazioni", icon: Settings },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="flex flex-col gap-1 border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
      <div className="mb-4 flex items-center gap-2 px-2 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-display font-bold">H</div>
        <div>
          <div className="font-display text-base font-semibold leading-none">HotelOps</div>
          <div className="text-[10px] uppercase tracking-wide text-sidebar-foreground/60">Facility ops</div>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-2 py-3 text-[10px] text-sidebar-foreground/50">v0.1 • Fase 0–1</div>
    </aside>
  );
}