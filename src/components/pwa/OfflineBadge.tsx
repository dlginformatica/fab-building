import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloudOff, CloudUpload, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function OfflineBadge() {
  const { online, queue, flush } = useOfflineSync();
  if (online && queue.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-lg">
      {!online ? (
        <Badge variant="outline" className="bg-amber-500/15 text-amber-500 border-amber-500/30"><CloudOff className="h-3 w-3 mr-1" />Offline</Badge>
      ) : (
        <Badge variant="outline" className="bg-success/15 text-success border-success/30"><CloudUpload className="h-3 w-3 mr-1" />Online</Badge>
      )}
      {queue.length > 0 && (
        <>
          <span className="text-xs text-muted-foreground">{queue.length} in coda</span>
          {online && (
            <Button size="sm" variant="outline" className="h-7"
              onClick={async () => { const r = await flush(); toast.success(`Sincronizzati ${r.ok}${r.fail ? ` (${r.fail} falliti)` : ""}`); }}>
              <RefreshCw className="h-3 w-3 mr-1" />Sync
            </Button>
          )}
        </>
      )}
    </div>
  );
}