import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads a generated PDF blob to the private `report-previews` bucket
 * under the current user's folder, registers the metadata row and returns
 * a signed download URL valid 24h.
 */
export async function uploadPdfPreview(opts: {
  blob: Blob;
  templateName: string;
  templateId?: string | null;
  recipient?: string | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user) throw new Error("Sessione utente mancante");

  const safe = (opts.templateName || "report").replace(/[^a-z0-9-_]+/gi, "_");
  const filename = `${Date.now()}_${safe}.pdf`;
  const path = `${user.id}/${filename}`;

  const { error: upErr } = await supabase.storage
    .from("report-previews")
    .upload(path, opts.blob, { contentType: "application/pdf", upsert: false });
  if (upErr) throw upErr;

  const { data: signed, error: sErr } = await supabase.storage
    .from("report-previews")
    .createSignedUrl(path, 60 * 60 * 24);
  if (sErr || !signed) throw sErr ?? new Error("Impossibile generare il link firmato");

  await (supabase as any).from("report_pdf_previews").insert({
    owner_id: user.id,
    template_id: opts.templateId ?? null,
    template_name: opts.templateName,
    recipient: opts.recipient ?? null,
    path,
    size_bytes: opts.blob.size,
  });

  return { path, signedUrl: signed.signedUrl };
}