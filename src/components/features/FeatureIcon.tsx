import {
  Building2, Wrench, Bell, Volume2, ShieldCheck, FileText, Briefcase,
  CalendarCheck, Receipt, Package, Inbox, Leaf, BarChart3, type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Building2, Wrench, Bell, Volume2, ShieldCheck, FileText, Briefcase,
  CalendarCheck, Receipt, Package, Inbox, Leaf, BarChart3,
};

export function FeatureIcon({ name, className }: { name: string; className?: string }) {
  const I = MAP[name] ?? Building2;
  return <I className={className} />;
}