import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Mail, Trash2, Crown, Copy, ShieldCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/organization")({
  head: () => ({ meta: [{ title: "Organizzazione — HotelOps" }] }),
  component: Page,
});

const APP_ROLES = ["direttore","facility_manager","manutentore","fornitore","economato","viewer"] as const;
const ORG_ROLES = ["admin","member"] as const;
const MODULES = [
  "tickets","assets","maintenance","inventory","suppliers","contracts","work_orders",
  "purchase_orders","utilities","invoices","reports","sla","penalties","housekeeping",
  "guest_issues","statistics","docs","messages","integrations",
];

type Membership = { id: string; org_id: string; user_id: string; role: "owner"|"admin"|"member"; created_at: string };
type Profile = { id: string; email: string; full_name: string | null };
type Org = { id: string; name: string; owner_id: string; max_users: number; slug: string | null };
type Invitation = {
  id: string; org_id: string; email: string; org_role: string; app_role: string;
  modules: string[]; structure_ids: string[]; token: string; expires_at: string;
  accepted_at: string | null; revoked_at: string | null; created_at: string;
};
type Dep = { module: string; depends_on: string };

function Page() {
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  const { data: org } = useQuery<Org | null>({
    queryKey: ["org-current", me],
    enabled: !!me,
    queryFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", me!).maybeSingle();
      const orgId = (prof as any)?.organization_id as string | undefined;
      if (!orgId) return null;
      const { data } = await (supabase as any).from("organizations").select("*").eq("id", orgId).maybeSingle();
      return data;
    },
  });

  const { data: members } = useQuery<Membership[]>({
    queryKey: ["org-members", org?.id],
    enabled: !!org?.id,
    queryFn: async () => ((await (supabase as any).from("org_memberships").select("*").eq("org_id", org!.id).order("created_at")).data ?? []),
  });
  const { data: profiles } = useQuery<Profile[]>({
    queryKey: ["profiles_for_org", (members ?? []).map(m => m.user_id).join(",")],
    enabled: !!(members && members.length),
    queryFn: async () => ((await supabase.from("profiles").select("id,email,full_name").in("id", members!.map(m=>m.user_id))).data ?? []) as any,
  });
  const { data: invitations } = useQuery<Invitation[]>({
    queryKey: ["org-invitations", org?.id],
    enabled: !!org?.id,
    queryFn: async () => ((await (supabase as any).from("org_invitations").select("*").eq("org_id", org!.id).order("created_at",{ascending:false})).data ?? []),
  });
  const { data: structures } = useQuery({
    queryKey: ["structures-org", org?.id],
    enabled: !!org?.id,
    queryFn: async () => ((await supabase.from("structures").select("id,name").eq("organization_id", org!.id).order("name")).data ?? []),
  });
  const { data: deps } = useQuery<Dep[]>({
    queryKey: ["module-deps"],
    queryFn: async () => ((await (supabase as any).from("module_dependencies").select("*")).data ?? []),
  });

  const isOwner = !!(org && me && org.owner_id === me);

  // --- Org rename ---
  const [orgName, setOrgName] = useState("");
  useEffect(() => { if (org) setOrgName(org.name); }, [org?.id]);
  const saveOrg = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("organizations").update({ name: orgName }).eq("id", org!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Organizzazione aggiornata"); qc.invalidateQueries({ queryKey: ["org-current"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Invite form ---
  const [invForm, setInvForm] = useState({
    email: "", org_role: "member" as "admin"|"member", app_role: "manutentore",
    modules: [] as string[], structure_ids: [] as string[],
  });
  const expandedModules = useMemo(() => {
    if (!deps) return invForm.modules;
    const set = new Set(invForm.modules);
    let added = true;
    while (added) {
      added = false;
      for (const d of deps) if (set.has(d.module) && !set.has(d.depends_on)) { set.add(d.depends_on); added = true; }
    }
    return Array.from(set).sort();
  }, [invForm.modules, deps]);
  const autoAddedDeps = expandedModules.filter(m => !invForm.modules.includes(m));

  const seatsUsed = (members?.length ?? 0) + (invitations?.filter(i => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date()).length ?? 0);
  const seatsLeft = (org?.max_users ?? 6) - seatsUsed;

  const sendInvite = useMutation({
    mutationFn: async () => {
      if (!org) throw new Error("Nessuna organizzazione");
      if (!invForm.email) throw new Error("Email obbligatoria");
      if (seatsLeft <= 0) throw new Error("Limite utenti raggiunto");
      const { error } = await (supabase as any).from("org_invitations").insert({
        org_id: org.id, email: invForm.email.toLowerCase().trim(),
        invited_by: me, org_role: invForm.org_role, app_role: invForm.app_role,
        modules: expandedModules, structure_ids: invForm.structure_ids,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invito creato. Condividi il link copiandolo dalla lista.");
      setInvForm({ email: "", org_role: "member", app_role: "manutentore", modules: [], structure_ids: [] });
      qc.invalidateQueries({ queryKey: ["org-invitations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("org_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-invitations"] }),
  });

  const removeMember = useMutation({
    mutationFn: async (m: Membership) => {
      if (m.role === "owner") throw new Error("Non puoi rimuovere il proprietario");
      const { error } = await (supabase as any).from("org_memberships").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Membro rimosso"); qc.invalidateQueries({ queryKey: ["org-members"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const transfer = useMutation({
    mutationFn: async (newOwner: string) => {
      const { error } = await (supabase as any).rpc("transfer_org_ownership", { _org: org!.id, _new_owner: newOwner });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Proprietà trasferita"); qc.invalidateQueries({ queryKey: ["org-current"] }); qc.invalidateQueries({ queryKey: ["org-members"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyInvite = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link invito copiato");
  };

  if (!org) {
    return <div className="space-y-2"><h1 className="font-display text-2xl font-bold">Organizzazione</h1>
      <p className="text-sm text-muted-foreground">Nessuna organizzazione associata al tuo account.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6" />{org.name}</h1>
          <p className="text-sm text-muted-foreground">Gestione multi-tenant: utenti, deleghe e proprietà dell'organizzazione.</p>
        </div>
        <Badge variant={seatsLeft > 0 ? "secondary" : "destructive"}>{seatsUsed}/{org.max_users} posti utilizzati</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Dati organizzazione</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="space-y-1"><Label>Nome</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!isOwner} /></div>
            <div className="flex items-end"><Button disabled={!isOwner || saveOrg.isPending || orgName === org.name} onClick={() => saveOrg.mutate()}>Salva</Button></div>
          </div>
          {!isOwner && <p className="mt-2 text-xs text-muted-foreground">Solo il proprietario può modificare i dati dell'organizzazione.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Mail className="h-4 w-4" />Invita un nuovo utente</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2"><Label>Email</Label>
              <Input type="email" value={invForm.email} onChange={(e) => setInvForm({ ...invForm, email: e.target.value })} disabled={!isOwner || seatsLeft <= 0} /></div>
            <div className="space-y-1"><Label>Ruolo organizzazione</Label>
              <Select value={invForm.org_role} onValueChange={(v: any) => setInvForm({ ...invForm, org_role: v })} disabled={!isOwner}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ORG_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Ruolo applicativo</Label>
              <Select value={invForm.app_role} onValueChange={(v) => setInvForm({ ...invForm, app_role: v })} disabled={!isOwner}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{APP_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Moduli delegati (le dipendenze obbligatorie vengono aggiunte automaticamente)</Label>
            <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
              {MODULES.map(m => (
                <label key={m} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs">
                  <Checkbox checked={invForm.modules.includes(m)}
                    onCheckedChange={(c) => setInvForm({ ...invForm, modules: c ? [...invForm.modules, m] : invForm.modules.filter(x=>x!==m) })}
                    disabled={!isOwner}/>
                  <span>{m}</span>
                </label>
              ))}
            </div>
            {autoAddedDeps.length > 0 && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
                <ShieldCheck className="h-3 w-3 text-amber-500" />
                Dipendenze auto-aggiunte: <strong>{autoAddedDeps.join(", ")}</strong>
              </div>
            )}
          </div>
          <div>
            <Label className="mb-2 block">Strutture (vuoto = tutte quelle dell'organizzazione)</Label>
            <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
              {(structures ?? []).map((s: any) => (
                <label key={s.id} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1 text-xs">
                  <Checkbox checked={invForm.structure_ids.includes(s.id)}
                    onCheckedChange={(c) => setInvForm({ ...invForm, structure_ids: c ? [...invForm.structure_ids, s.id] : invForm.structure_ids.filter(x=>x!==s.id) })}
                    disabled={!isOwner}/>
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <Button disabled={!isOwner || sendInvite.isPending || seatsLeft <= 0 || !invForm.email} onClick={() => sendInvite.mutate()}>
            {seatsLeft <= 0 ? "Limite utenti raggiunto" : "Crea invito"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Membri ({members?.length ?? 0}/{org.max_users})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2">Utente</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Ruolo org</th><th className="px-4 py-2 text-right">Azioni</th></tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => {
                const p = (profiles ?? []).find(x => x.id === m.user_id);
                const isThisOwner = m.role === "owner";
                return (
                  <tr key={m.id} className="border-b border-border/60">
                    <td className="px-4 py-2 flex items-center gap-2">{isThisOwner && <Crown className="h-3 w-3 text-amber-500" />}{p?.full_name ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p?.email ?? m.user_id}</td>
                    <td className="px-4 py-2"><Badge variant={isThisOwner ? "default" : "secondary"}>{m.role}</Badge></td>
                    <td className="px-4 py-2 text-right space-x-1">
                      {isOwner && !isThisOwner && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { if (confirm(`Trasferire la proprietà a ${p?.email}? Diventerai admin.`)) transfer.mutate(m.user_id); }}>
                            <Crown className="mr-1 h-3 w-3" />Trasferisci
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => removeMember.mutate(m)}><Trash2 className="h-4 w-4" /></Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Inviti</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-2">Email</th><th className="px-4 py-2">Ruolo</th><th className="px-4 py-2">Moduli</th><th className="px-4 py-2">Stato</th><th className="px-4 py-2 text-right">Azioni</th></tr>
            </thead>
            <tbody>
              {(invitations ?? []).length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">Nessun invito.</td></tr>}
              {(invitations ?? []).map(i => {
                const expired = new Date(i.expires_at) < new Date();
                const stato = i.revoked_at ? "Revocato" : i.accepted_at ? "Accettato" : expired ? "Scaduto" : "In attesa";
                return (
                  <tr key={i.id} className="border-b border-border/60">
                    <td className="px-4 py-2 font-mono text-xs">{i.email}</td>
                    <td className="px-4 py-2">{i.org_role} / {i.app_role}</td>
                    <td className="px-4 py-2 text-xs">{i.modules.length === 0 ? <span className="text-muted-foreground">tutti</span> : i.modules.join(", ")}</td>
                    <td className="px-4 py-2"><Badge variant={stato === "In attesa" ? "secondary" : stato === "Accettato" ? "default" : "outline"}>{stato}</Badge></td>
                    <td className="px-4 py-2 text-right space-x-1">
                      {!i.accepted_at && !i.revoked_at && !expired && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => copyInvite(i.token)}><Copy className="mr-1 h-3 w-3" />Copia link</Button>
                          {isOwner && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>Revoca</Button>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {!isOwner && (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4" /> Sei membro dell'organizzazione. Solo il proprietario può invitare/rimuovere utenti e trasferire la proprietà.
        </div>
      )}
    </div>
  );
}