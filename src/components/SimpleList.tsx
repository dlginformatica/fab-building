import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SimpleList<T extends { id: string }>({
  title, subtitle, items, empty, renderItem, header,
}: {
  title: string; subtitle?: string; items: T[]; empty?: string;
  renderItem: (it: T) => ReactNode; header?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex gap-2">{header}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3"><CardContent className="p-10 text-center text-sm text-muted-foreground">{empty ?? "Nessun elemento."}</CardContent></Card>
        ) : items.map((it) => <div key={it.id}>{renderItem(it)}</div>)}
      </div>
    </div>
  );
}

export function ListCard({ title, meta, badges, footer }: {
  title: string; meta?: ReactNode; badges?: ReactNode; footer?: ReactNode;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-display text-base">{title}</CardTitle>
          <div className="flex gap-1">{badges}</div>
        </div>
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
      </CardHeader>
      {footer && <CardContent className="text-xs text-muted-foreground">{footer}</CardContent>}
    </Card>
  );
}