import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Wrench, Ticket, Settings, FileText, Users, Bell,
  Truck, FileSignature, ClipboardList, CalendarClock, Package, ShoppingCart,
  Gauge, Receipt, MessageSquare, BarChart3, ScrollText, ExternalLink,
  ShieldCheck, UserCog, AlertTriangle, FileBarChart, Activity, TrendingUp, Workflow, Mail,
} from "lucide-react";

const groups: Array<{ label: string; items: Array<{ to: string; label: string; icon: any; exact?: boolean }> }> = [
  { label: "Operativo", items: [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/app/structure-kpi", label: "KPI struttura", icon: BarChart3 },
    { to: "/app/tickets", label: "Ticket", icon: Ticket },
    { to: "/app/messages", label: "Messaggi", icon: MessageSquare },
    { to: "/portal", label: "Portale Agenti", icon: ExternalLink },
  ]},
  { label: "Strutture & Asset", items: [
    { to: "/app/structures", label: "Strutture", icon: Building2 },
    { to: "/app/assets", label: "Asset & Impianti", icon: Wrench },
    { to: "/app/area-mapping", label: "Aree & reparti", icon: Building2 },
    { to: "/app/maintenance", label: "Manutenzione", icon: CalendarClock },
    { to: "/app/inventory", label: "Magazzino", icon: Package },
    { to: "/app/reorders", label: "Riordini & sotto-scorta", icon: ShoppingCart },
  ]},
  { label: "Fornitori & Acquisti", items: [
    { to: "/app/suppliers", label: "Fornitori", icon: Truck },
    { to: "/app/suppliers-compliance", label: "Compliance fornitori", icon: ShieldCheck },
    { to: "/app/contracts", label: "Contratti", icon: FileSignature },
    { to: "/app/work-orders", label: "Ordini di Lavoro", icon: ClipboardList },
    { to: "/app/purchase-orders", label: "Ordini d'Acquisto", icon: ShoppingCart },
  ]},
  { label: "Economato", items: [
    { to: "/app/utilities", label: "Utenze & Letture", icon: Gauge },
    { to: "/app/invoices", label: "Fatture & Bollette", icon: Receipt },
    { to: "/app/reports", label: "Report", icon: BarChart3 },
    { to: "/app/report-builder", label: "Report Builder", icon: FileBarChart },
    { to: "/app/statistics", label: "Statistiche", icon: Activity },
    { to: "/app/cost-analytics", label: "Costi per area (5★)", icon: TrendingUp },
  ]},
  { label: "Amministrazione", items: [
    { to: "/app/sla", label: "Regole SLA", icon: Bell },
    { to: "/app/sla-escalations", label: "Escalation SLA", icon: AlertTriangle },
    { to: "/app/sla-compliance", label: "Conformità SLA", icon: FileBarChart },
    { to: "/app/sla-notifications", label: "Notifiche SLA", icon: Bell },
    { to: "/app/penalties", label: "Penali & Violazioni", icon: AlertTriangle },
    { to: "/app/workflows", label: "Workflow & procedure", icon: Workflow },
    { to: "/app/notifications", label: "Notifiche Email & Teams", icon: Mail },
    { to: "/app/users", label: "Utenti & Ruoli", icon: Users },
    { to: "/app/permissions", label: "Permessi funzioni", icon: ShieldCheck },
    { to: "/app/delegations", label: "Deleghe", icon: UserCog },
    { to: "/app/delegations-history", label: "Storico deleghe", icon: ScrollText },
    { to: "/app/audit", label: "Audit log", icon: ScrollText },
    { to: "/app/delegation-audit", label: "Audit deleghe", icon: ScrollText },
    { to: "/app/delivery-queue", label: "Coda invii report", icon: Activity },
    { to: "/app/docs", label: "Documenti", icon: FileText },
    { to: "/app/settings", label: "Impostazioni", icon: Settings },
  ]},
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="flex flex-col gap-1 overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
      <div className="mb-4 flex items-center gap-2 px-2 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-display font-bold">H</div>
        <div>
          <div className="font-display text-base font-semibold leading-none">HotelOps</div>
          <div className="text-[10px] uppercase tracking-wide text-sidebar-foreground/60">Facility ops</div>
        </div>
      </div>
      <nav className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-0.5">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{g.label}</div>
            {g.items.map((it) => {
              const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
              const Icon = it.icon;
              return (
                <Link key={it.to} to={it.to} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground"
                         : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}>
                  <Icon className="h-4 w-4" />{it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-auto px-2 py-3 text-[10px] text-sidebar-foreground/50">v0.16 • Notifiche SLA · Documentazione impianti · Foto/video asset</div>
    </aside>
  );
}