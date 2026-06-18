import { useSpeaker } from "./SpeakerProvider";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const VOICES = ["alloy","ash","ballad","coral","echo","sage","shimmer","verse","marin","cedar"] as const;

export function SpeakerPanel() {
  const { enabled, setEnabled, voice, setVoice, volume, setVolume, speak } = useSpeaker();
  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-sm font-semibold">Speaker TTS</div>
        <div className="text-xs text-muted-foreground">Annuncia ticket critici e SLA in violazione.</div>
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="tts-enabled">Attivo</Label>
        <Switch id="tts-enabled" checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <div className="space-y-2">
        <Label>Voce</Label>
        <Select value={voice} onValueChange={(v) => setVoice(v as typeof VOICES[number])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{VOICES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Volume: {Math.round(volume * 100)}%</Label>
        <Slider value={[volume]} min={0} max={1} step={0.05} onValueChange={(v) => setVolume(v[0])} />
      </div>
      <Button variant="outline" className="w-full" onClick={() => speak("Speaker HotelOps attivo. Verrai avvisato in viva voce per ticket critici e SLA in violazione.")}>Prova voce</Button>
    </div>
  );
}