import { type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SubscriptionBanner } from "@/components/billing/SubscriptionBanner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <Sidebar />
        <div className="flex min-h-screen flex-col">
          <Topbar />
          <SubscriptionBanner />
          <main className="flex-1 overflow-x-hidden p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}