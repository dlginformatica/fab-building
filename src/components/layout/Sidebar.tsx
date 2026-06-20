import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Wrench, Ticket, Settings, FileText, Users, Bell,
  Truck, FileSignature, ClipboardList, CalendarClock, Package, ShoppingCart,
  Gauge, Receipt, MessageSquare, BarChart3, ScrollText, ExternalLink,
  ShieldCheck, UserCog, AlertTriangle, FileBarChart, Activity, TrendingUp, Workflow, Mail, Sparkles,
  BedDouble, Inbox, Leaf, Wallet, Plug, QrCode, CreditCard, Crown, DatabaseBackup, ScrollText as ScrollIcon,
} from "lucide-react";
import { useMySubscription, useIsSuperAdmin } from "@/lib/use-subscription";

type Item = { to: string; label: string; icon: any; exact?: boolean; module?: string; superOnly?: boolean };
const groups: Array<{ label: string; items: Item[] }> = [
  { label: "Operativo", items: [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/app/onboarding", label: "Setup guidato", icon: Sparkles },
    { to: "/app/smart-inbox", label: "Smart Inbox", icon: Inbox, module: "smart_inbox" },
    { to: "/app/overview", label: "Overview unificata", icon: BarChart3, module: "overview" },
    { to: "/app/trends", label: "Trend YoY & benchmark", icon: TrendingUp, module: "statistics" },
    { to: "/app/alerts", label: "Alert & Scadenze", icon: Bell, module: "alerts" },
    { to: "/app/structure-kpi", label: "KPI struttura", icon: BarChart3, module: "statistics" },
    { to: "/app/tickets", label: "Ticket", icon: Ticket, module: "tickets" },
    { to: "/app/guest-issues", label: "Segnalazioni ospiti (QR)", icon: QrCode, module: "guest_issues" },
    { to: "/app/messages", label: "Messaggi", icon: MessageSquare, module: "messages" },
    { to: "/portal", label: "Portale Agenti", icon: ExternalLink },
  ]},
  { label: "Strutture & Asset", items: [
    { to: "/app/structures", label: "Strutture", icon: Building2, module: "rooms" },
    { to: "/app/housekeeping", label: "Housekeeping", icon: BedDouble, module: "housekeeping" },
    { to: "/app/assets", label: "Asset & Impianti", icon: Wrench, module: "assets" },
    { to: "/app/area-mapping", label: "Aree & reparti", icon: Building2, module: "assets" },
    { to: "/app/maintenance", label: "Manutenzione", icon: CalendarClock, module: "maintenance" },
    { to: "/app/inventory", label: "Magazzino", icon: Package, module: "inventory" },
    { to: "/app/reorders", label: "Riordini & sotto-scorta", icon: ShoppingCart, module: "inventory" },
  ]},
  { label: "Fornitori & Acquisti", items: [
    { to: "/app/suppliers", label: "Fornitori", icon: Truck, module: "suppliers" },
    { to: "/app/suppliers-compliance", label: "Compliance fornitori", icon: ShieldCheck, module: "suppliers" },
    { to: "/app/contracts", label: "Contratti", icon: FileSignature, module: "contracts" },
    { to: "/app/work-orders", label: "Ordini di Lavoro", icon: ClipboardList, module: "work_orders" },
    { to: "/app/purchase-orders", label: "Ordini d'Acquisto", icon: ShoppingCart, module: "purchase_orders" },
  ]},
  { label: "Economato", items: [
    { to: "/app/utilities", label: "Utenze & Letture", icon: Gauge, module: "utilities" },
    { to: "/app/invoices", label: "Fatture & Bollette", icon: Receipt, module: "invoices" },
    { to: "/app/cashbook", label: "Prima Nota / Cassa", icon: Wallet, module: "cashbook" },
    { to: "/app/sustainability", label: "Consumi & ESG", icon: Leaf, module: "sustainability" },
    { to: "/app/reports", label: "Report", icon: BarChart3, module: "reports" },
    { to: "/app/report-builder", label: "Report Builder", icon: FileBarChart, module: "reports" },
    { to: "/app/statistics", label: "Statistiche", icon: Activity, module: "statistics" },
    { to: "/app/cost-analytics", label: "Costi per area (5★)", icon: TrendingUp, module: "statistics" },
  ]},
  { label: "Abbonamento", items: [
    { to: "/app/billing", label: "Abbonamento & piano", icon: CreditCard },
    { to: "/app/super-admin/plans", label: "Piani (super admin)", icon: Crown, superOnly: true },
    { to: "/app/super-admin/subscription-audit", label: "Audit abbonamenti (super admin)", icon: ScrollIcon, superOnly: true },
    { to: "/app/backup", label: "Backup, Restore & Import", icon: DatabaseBackup },
    { to: "/app/super-admin/backup", label: "Backup globale (super admin)", icon: DatabaseBackup, superOnly: true },
  ]},
  { label: "Amministrazione", items: [
    { to: "/app/organization", label: "Organizzazione (multi-tenant)", icon: Building2, module: "organization" },
    { to: "/app/integrations", label: "Integrazioni (PMS, WA, SDI)", icon: Plug, module: "integrations" },
    { to: "/app/sla", label: "Regole SLA", icon: Bell, module: "sla" },
    { to: "/app/sla-escalations", label: "Escalation SLA", icon: AlertTriangle, module: "sla" },
    { to: "/app/sla-compliance", label: "Conformità SLA", icon: FileBarChart, module: "sla" },
    { to: "/app/sla-notifications", label: "Notifiche SLA", icon: Bell, module: "sla" },
    { to: "/app/sla-settings", label: "Preferenze SLA", icon: Bell, module: "sla_settings" },
    { to: "/app/scheduled-exports", label: "Export schedulati", icon: CalendarClock, module: "scheduled_exports" },
    { to: "/app/penalties", label: "Penali & Violazioni", icon: AlertTriangle, module: "penalties" },
    { to: "/app/workflows", label: "Workflow & procedure", icon: Workflow, superOnly: false, module: "organization" },
    { to: "/app/notifications", label: "Notifiche Email & Teams", icon: Mail, module: "notifications" },
    { to: "/app/users", label: "Utenti & Ruoli", icon: Users },
    { to: "/app/permissions", label: "Permessi funzioni", icon: ShieldCheck, module: "permissions" },
    { to: "/app/permissions-matrix", label: "Matrice permessi", icon: ShieldCheck, module: "permissions" },
    { to: "/app/module-dependencies", label: "Dipendenze moduli", icon: ShieldCheck, module: "permissions" },
    { to: "/app/delegations", label: "Deleghe", icon: UserCog, module: "delegations" },
    { to: "/app/delegations-history", label: "Storico deleghe", icon: ScrollText, module: "delegations" },
    { to: "/app/permission-audit", label: "Audit permessi", icon: ScrollText, module: "permissions" },
    { to: "/app/access-denied", label: "Accessi negati", icon: ShieldCheck, module: "permissions" },
    { to: "/app/admin-alerts", label: "Avvisi admin (deleghe)", icon: AlertTriangle, module: "delegations" },
    { to: "/app/notification-prefs", label: "Preferenze notifiche org", icon: Bell, module: "notifications" },
    { to: "/app/audit", label: "Audit log", icon: ScrollText, module: "audit" },
    { to: "/app/delegation-audit", label: "Audit deleghe", icon: ScrollText, module: "delegations" },
    { to: "/app/delivery-queue", label: "Coda invii report", icon: Activity, module: "scheduled_exports" },
    { to: "/app/docs", label: "Documenti", icon: FileText, module: "docs" },
    { to: "/app/settings", label: "Impostazioni", icon: Settings },
  ]},
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: sub } = useMySubscription();
  const { data: isSuper } = useIsSuperAdmin();
  const allowedModules = new Set(sub?.plan?.modules ?? []);
  const canSee = (it: Item) => {
    if (it.superOnly) return !!isSuper;
    if (isSuper) return true;
    if (!it.module) return true;
    return allowedModules.has(it.module);
  };
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
        {groups.map((g) => {
          const visible = g.items.filter(canSee);
          if (visible.length === 0) return null;
          return (
          <div key={g.label} className="flex flex-col gap-0.5">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{g.label}</div>
            {visible.map((it) => {
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
          );
        })}
      </nav>
      <div className="mt-auto px-2 py-3 text-[10px] text-sidebar-foreground/50">v0.16 • Notifiche SLA · Documentazione impianti · Foto/video asset</div>
    </aside>
  );
}