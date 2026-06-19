import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM = `Sei un assistente esperto di estrazione dati da fatture italiane (anche bollette utenze).
Estrai SOLO i campi richiesti in JSON valido. Importi come numeri (punto decimale). Date come YYYY-MM-DD.
Se un campo non è presente, restituisci null. Non inventare dati.`;

const SCHEMA_HINT = `Restituisci un JSON con questa forma:
{
  "supplier_name": string|null,
  "supplier_vat": string|null,
  "supplier_iban": string|null,
  "invoice_number": string|null,
  "issue_date": "YYYY-MM-DD"|null,
  "due_date": "YYYY-MM-DD"|null,
  "amount_net": number|null,
  "vat": number|null,
  "amount_total": number|null,
  "currency": string|null,
  "utility_type": "elettricita"|"gas"|"acqua"|"gasolio"|"teleriscaldamento"|"altro"|null,
  "line_items": [{ "description": string, "quantity": number|null, "unit_price": number|null, "total": number|null }],
  "notes": string|null
}`;

export const extractInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { filename: string; mimeType: string; dataBase64: string }) => d)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY mancante");

    const isPdf = data.mimeType === "application/pdf";
    const dataUrl = `data:${data.mimeType};base64,${data.dataBase64}`;
    const content: any[] = [{ type: "text", text: SCHEMA_HINT }];
    if (isPdf) {
      content.push({ type: "file", file: { filename: data.filename, file_data: dataUrl } });
    } else {
      content.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
      }),
    });
    if (res.status === 429) throw new Error("Limite richieste AI raggiunto. Riprova più tardi.");
    if (res.status === 402) throw new Error("Crediti AI esauriti. Aggiungi crediti dal workspace.");
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OCR fallito: ${res.status} ${t.slice(0, 300)}`);
    }
    const json: any = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { _raw: raw }; }
    return { extracted: parsed, model: "google/gemini-2.5-flash" };
  });