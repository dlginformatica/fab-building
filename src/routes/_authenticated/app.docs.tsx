import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import funzionaliMd from "@/../docs/REQUISITI_FUNZIONALI.md?raw";
import nonFunzionaliMd from "@/../docs/REQUISITI_NON_FUNZIONALI.md?raw";
import manualeMd from "@/../docs/MANUALE_OPERATIVO.md?raw";

export const Route = createFileRoute("/_authenticated/app/docs")({ component: Page });

function Page() {
  const docs = [
    { key: "rf", title: "Requisiti Funzionali", body: funzionaliMd },
    { key: "rnf", title: "Requisiti Non Funzionali", body: nonFunzionaliMd },
    { key: "man", title: "Manuale Operativo", body: manualeMd },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Documenti</h1>
        <p className="text-sm text-muted-foreground">Aggiornati a ogni interazione con la chat di sviluppo.</p>
      </div>
      <Tabs defaultValue="rf">
        <TabsList>{docs.map((d) => <TabsTrigger key={d.key} value={d.key}>{d.title}</TabsTrigger>)}</TabsList>
        {docs.map((d) => (
          <TabsContent key={d.key} value={d.key}>
            <Card>
              <CardHeader><CardTitle className="font-display">{d.title}</CardTitle></CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">{d.body}</pre>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}