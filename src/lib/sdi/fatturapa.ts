// Generatore FatturaPA semplificato per export SDI.
// Per piccole strutture: emette XML conforme allo schema P/PR-12 (cliente privato persona fisica).

type SdiInput = {
  structure: {
    name: string; vat_number?: string | null; fiscal_code?: string | null;
    address?: string | null; city?: string | null; postal_code?: string | null; province?: string | null;
    country?: string | null; regime_fiscale?: string | null;
  };
  supplier?: { name?: string | null; vat_number?: string | null; fiscal_code?: string | null; sdi_code?: string | null; pec?: string | null; address?: string | null } | null;
  invoice: { number: string; issue_date: string; amount_net?: number | null; vat?: number | null; amount_total: number; description?: string | null };
};

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" } as any)[c]);
}

export function buildFatturaPaXml({ structure, supplier, invoice }: SdiInput): string {
  const numProgressivo = invoice.number.replace(/[^A-Z0-9]/gi, "").slice(0, 10) || "00001";
  const total = Number(invoice.amount_total || 0);
  const net = invoice.amount_net != null ? Number(invoice.amount_net) : +(total / 1.22).toFixed(2);
  const vatRate = 22;
  const vatAmt = invoice.vat != null ? Number(invoice.vat) : +(total - net).toFixed(2);
  const codiceDest = supplier?.sdi_code || "0000000";
  const pec = supplier?.pec || "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${esc(structure.vat_number || "00000000000")}</IdCodice></IdTrasmittente>
      <ProgressivoInvio>${esc(numProgressivo)}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${esc(codiceDest)}</CodiceDestinatario>
      ${pec ? `<PECDestinatario>${esc(pec)}</PECDestinatario>` : ""}
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${esc(structure.vat_number || "")}</IdCodice></IdFiscaleIVA>
        ${structure.fiscal_code ? `<CodiceFiscale>${esc(structure.fiscal_code)}</CodiceFiscale>` : ""}
        <Anagrafica><Denominazione>${esc(structure.name)}</Denominazione></Anagrafica>
        <RegimeFiscale>${esc(structure.regime_fiscale || "RF01")}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${esc(structure.address || "—")}</Indirizzo>
        <CAP>${esc(structure.postal_code || "00000")}</CAP>
        <Comune>${esc(structure.city || "—")}</Comune>
        ${structure.province ? `<Provincia>${esc(structure.province)}</Provincia>` : ""}
        <Nazione>${esc(structure.country || "IT")}</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        ${supplier?.vat_number ? `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${esc(supplier.vat_number)}</IdCodice></IdFiscaleIVA>` : ""}
        ${supplier?.fiscal_code ? `<CodiceFiscale>${esc(supplier.fiscal_code)}</CodiceFiscale>` : ""}
        <Anagrafica><Denominazione>${esc(supplier?.name || "Cliente")}</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede><Indirizzo>${esc(supplier?.address || "—")}</Indirizzo><CAP>00000</CAP><Comune>—</Comune><Nazione>IT</Nazione></Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${esc(invoice.issue_date)}</Data>
        <Numero>${esc(invoice.number)}</Numero>
        <ImportoTotaleDocumento>${total.toFixed(2)}</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>${esc(invoice.description || "Servizi")}</Descrizione>
        <PrezzoUnitario>${net.toFixed(2)}</PrezzoUnitario>
        <PrezzoTotale>${net.toFixed(2)}</PrezzoTotale>
        <AliquotaIVA>${vatRate.toFixed(2)}</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>${vatRate.toFixed(2)}</AliquotaIVA>
        <ImponibileImporto>${net.toFixed(2)}</ImponibileImporto>
        <Imposta>${vatAmt.toFixed(2)}</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
}

export function downloadFatturaPaXml(input: SdiInput) {
  const xml = buildFatturaPaXml(input);
  const vat = input.structure.vat_number || "00000000000";
  const prog = input.invoice.number.replace(/[^A-Z0-9]/gi, "").slice(0, 5) || "00001";
  const filename = `IT${vat}_${prog}.xml`;
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}