import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Accetta invito — HotelOps" }] }),
  component: Page,
});

function Page() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [orgName, setOrgName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [pwd, setPwd] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) setUser({ id: u.user.id, email: u.user.email! });
      const { data: invRows } = await (supabase as any).rpc("get_invitation_by_token", { _token: token });
      const inv = Array.isArray(invRows) ? invRows[0] : invRows;
      setInvite(inv ?? null);
      if (inv?.org_name) setOrgName(inv.org_name);
      setLoading(false);
    })();
  }, [token]);

  const isValid = invite && !invite.accepted_at && !invite.revoked_at && new Date(invite.expires_at) > new Date();

  const signUpAndAccept = async () => {
    const { error } = await supabase.auth.signUp({
      email: invite.email, password: pwd,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin + `/invite/${token}` },
    });
    if (error) return toast.error(error.message);
    toast.success("Account creato. Effettua il login per accettare l'invito.");
  };
  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: invite.email, password: pwd });
    if (error) return toast.error(error.message);
    location.reload();
  };
  const accept = async () => {
    const { error } = await (supabase as any).rpc("accept_org_invitation", { _token: token });
    if (error) return toast.error(error.message);
    toast.success(`Benvenuto in ${orgName}`);
    navigate({ to: "/app" });
  };

  if (loading) return <div className="grid min-h-screen place-items-center">Caricamento…</div>;
  if (!invite) return <div className="grid min-h-screen place-items-center text-muted-foreground">Invito non trovato.</div>;
  if (!isValid) return <div className="grid min-h-screen place-items-center text-muted-foreground">Invito non più valido (scaduto, revocato o già accettato).</div>;

  const emailMismatch = user && user.email.toLowerCase() !== invite.email.toLowerCase();

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2"><Building2 className="h-5 w-5" /><span className="font-display text-xl font-semibold">{orgName}</span></div>
          <CardTitle className="font-display">Sei stato invitato</CardTitle>
          <CardDescription>Email: <strong>{invite.email}</strong> · Ruolo: {invite.org_role} / {invite.app_role}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {invite.modules?.length > 0 && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
              <div className="flex items-center gap-1 font-semibold"><ShieldCheck className="h-3 w-3" />Moduli delegati</div>
              <div className="mt-1">{invite.modules.join(", ")}</div>
            </div>
          )}
          {!user && (
            <>
              <div className="space-y-2"><Label>Nome completo</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Password</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
              <Button className="w-full" onClick={signUpAndAccept} disabled={!pwd}>Crea account con questa email</Button>
              <p className="text-center text-xs text-muted-foreground">Hai già un account?</p>
              <Button variant="outline" className="w-full" onClick={signIn} disabled={!pwd}>Accedi</Button>
            </>
          )}
          {user && !emailMismatch && (
            <Button className="w-full" onClick={accept}>Accetta invito e accedi a {orgName}</Button>
          )}
          {user && emailMismatch && (
            <div className="text-xs text-destructive">Sei loggato come <strong>{user.email}</strong>, ma l'invito è per <strong>{invite.email}</strong>. Esci e accedi con l'email corretta.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}