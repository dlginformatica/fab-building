import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStructure } from "@/lib/structure-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LogOut, Volume2, VolumeX } from "lucide-react";
import { useSpeaker } from "@/components/tts/SpeakerProvider";
import { SpeakerPanel } from "@/components/tts/SpeakerPanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationsBell } from "@/components/layout/NotificationsBell";

export function Topbar() {
  const navigate = useNavigate();
  const { activeStructureId, setActiveStructureId } = useActiveStructure();
  const { enabled, isSpeaking } = useSpeaker();
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? ""));
  }, []);

  const { data: structures } = useQuery({
    queryKey: ["structures-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("structures").select("id,name,code").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!activeStructureId && structures && structures.length > 0) {
      setActiveStructureId(structures[0].id);
    }
  }, [structures, activeStructureId, setActiveStructureId]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-card/40 px-6 py-3 glass">
      <div className="flex items-center gap-3">
        <Select value={activeStructureId ?? ""} onValueChange={(v) => setActiveStructureId(v)}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Seleziona struttura" />
          </SelectTrigger>
          <SelectContent>
            {(structures ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}{s.code ? ` · ${s.code}` : ""}</SelectItem>
            ))}
            {(!structures || structures.length === 0) && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Nessuna struttura — creane una</div>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsBell />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className={isSpeaking ? "sla-pulse" : ""}>
              {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80"><SpeakerPanel /></PopoverContent>
        </Popover>
        <span className="hidden text-xs text-muted-foreground md:inline">{userEmail}</span>
        <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
      </div>
    </header>
  );
}