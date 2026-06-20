// Catalogo delle funzionalità pubblicizzate in home, /features e /brochure.
// Aggiornare ad ogni modifica funzionale rilevante (regola permanente).

export type FeatureCategory = "operativa" | "governance" | "finanza" | "intelligenza";

export type FeatureItem = {
  slug: string;
  title: string;
  tagline: string;
  category: FeatureCategory;
  icon: string; // lucide icon name
  bullets: string[];
  benefits: string[];
  flow: string[]; // passi operativi tipici
  modules: string[]; // moduli interni HotelOps coperti
  rfRefs: string[]; // riferimenti requisiti funzionali
  appPath: string; // dove vive la funzione in app
  screenshots: { src: string; caption: string }[]; // path /screens/<slug>/*.png
};

export const FEATURE_CATALOG: FeatureItem[] = [
  {
    slug: "asset-impianti",
    title: "Asset & Impianti",
    tagline: "Censisci impianti, attrezzature e ambienti con QR e storico vivo.",
    category: "operativa",
    icon: "Building2",
    bullets: [
      "Anagrafica gerarchica struttura → area → asset",
      "QR code stampabili, scansionabili dal manutentore",
      "Documenti, foto, libretti d'uso, certificazioni",
      "Storico interventi e KPI per asset (MTBF, MTTR, costi)",
    ],
    benefits: [
      "Zero ricerche manuali: scansioni il QR e vedi tutto",
      "Audit e conformità sempre pronti",
      "Decisioni data-driven su sostituzioni/manutenzione",
    ],
    flow: [
      "Onboarding crea categorie e ambienti standard hotel",
      "Aggiungi asset (manuale o import CSV) con foto e libretti",
      "Stampa QR e applicalo sull'apparecchiatura",
      "Da QR apri ticket, vedi storico e KPI dell'asset",
    ],
    modules: ["assets", "structures"],
    rfRefs: ["RF-AS-01", "RF-AS-02", "RF-AS-03"],
    appPath: "/app/assets",
    screenshots: [
      { src: "/screens/asset-impianti/list.png", caption: "Elenco asset filtrabile per categoria/area" },
      { src: "/screens/asset-impianti/detail.png", caption: "Scheda asset con storico, documenti e KPI" },
    ],
  },
  {
    slug: "ticketing",
    title: "Trouble Ticketing",
    tagline: "Dal guasto alla risoluzione in pochi tap, con foto e commenti.",
    category: "operativa",
    icon: "Wrench",
    bullets: [
      "Apertura da QR, da web o da Smart Inbox",
      "Kanban per stato (aperto/assegnato/in corso/risolto/chiuso)",
      "Allegati foto/video, commenti, intervention report PDF",
      "Assegnazione a tecnico interno o fornitore esterno",
    ],
    benefits: [
      "Tempi di risposta dimezzati grazie al kanban",
      "Tracciabilità totale chi-fa-cosa-quando",
      "Comunicazione integrata con ospite e fornitore",
    ],
    flow: [
      "Housekeeping/Front Office apre il ticket (anche da mobile)",
      "Il sistema applica SLA e priorità",
      "Il manutentore prende in carico, aggiorna stato e foto",
      "Chiusura con rapporto intervento + firma digitale",
    ],
    modules: ["tickets", "assets", "guest_issues"],
    rfRefs: ["RF-TK-01", "RF-TK-02", "RF-TK-03"],
    appPath: "/app/tickets",
    screenshots: [
      { src: "/screens/ticketing/kanban.png", caption: "Vista Kanban dei ticket" },
      { src: "/screens/ticketing/detail.png", caption: "Scheda ticket con timeline, foto e rapporto" },
    ],
  },
  {
    slug: "sla-engine",
    title: "SLA Engine",
    tagline: "Tempi di presa in carico e risoluzione automatici, con escalation.",
    category: "operativa",
    icon: "Bell",
    bullets: [
      "Calcolo SLA per priorità e categoria",
      "Pre-allerta configurabile per utente/struttura",
      "Escalation automatica al ruolo superiore",
      "Compliance dashboard (% rispettati, top breach)",
    ],
    benefits: [
      "Niente sorprese: l'allerta arriva PRIMA del breach",
      "Compliance verso direttore e proprietà",
      "Identifica colli di bottiglia per fornitore/categoria",
    ],
    flow: [
      "Definisci policy SLA per priorità",
      "Configura pre-allerta e canali (in-app/email/push)",
      "Sistema avvisa progressivamente fino al breach",
      "Report mensile compliance per management",
    ],
    modules: ["sla", "sla_settings", "sla_compliance", "sla_escalations"],
    rfRefs: ["RF-SLA-01", "RF-SLP-01", "RF-SLN-01"],
    appPath: "/app/sla",
    screenshots: [
      { src: "/screens/sla-engine/compliance.png", caption: "Dashboard compliance SLA" },
      { src: "/screens/sla-engine/settings.png", caption: "Preferenze SLA per utente/struttura" },
    ],
  },
  {
    slug: "tts-speaker",
    title: "TTS Speaker",
    tagline: "Annuncio vocale dei guasti critici e degli SLA in violazione.",
    category: "operativa",
    icon: "Volume2",
    bullets: [
      "Voce naturale (Lovable AI) in italiano",
      "Trigger su ticket critici, SLA in breach, nuove escalation",
      "Pannello speaker installabile su tablet di reception/control room",
      "Mute notturno e fascia di silenzio configurabile",
    ],
    benefits: [
      "Reazione immediata anche senza guardare lo schermo",
      "Ideale per control room o desk operativo",
      "Aumenta la consapevolezza condivisa del team",
    ],
    flow: [
      "Attiva il pannello speaker su un device fisso",
      "Configura eventi/priorità annunciabili",
      "Le emergenze vengono lette ad alta voce",
      "Storico annunci consultabile in app",
    ],
    modules: ["tts", "alerts", "sla"],
    rfRefs: ["RF-TTS-01"],
    appPath: "/app",
    screenshots: [
      { src: "/screens/tts-speaker/panel.png", caption: "Pannello speaker su tablet" },
    ],
  },
  {
    slug: "multi-tenant-ruoli",
    title: "Multi-tenant, Organizzazioni & Ruoli",
    tagline: "Una piattaforma, tante organizzazioni, ruoli granulari e deleghe sicure.",
    category: "governance",
    icon: "ShieldCheck",
    bullets: [
      "Ogni utente crea la propria organizzazione (max 6 utenti)",
      "Ruoli applicativi: direttore, facility_manager, manutentore, fornitore, economato, viewer",
      "Deleghe granulari per modulo e per struttura con dipendenze auto-espanse",
      "Trasferimento proprietà organizzazione",
      "Matrice permessi utenti×moduli e audit completo",
    ],
    benefits: [
      "Isolamento dati garantito da RLS sul DB",
      "Onboarding di nuovi membri in 1 minuto via invito",
      "Coerenza tra UI e backend: stessa primitiva di accesso",
    ],
    flow: [
      "Owner invita membro con email, ruolo, moduli, strutture",
      "Sistema espande dipendenze moduli obbligatorie",
      "Membro accetta invito via link /invite/{token}",
      "Owner monitora deleghe e audit, può rollback versioni",
    ],
    modules: ["organization", "users", "delegations", "permissions", "permission_audit", "admin_alerts", "notification_prefs"],
    rfRefs: ["RF-MT-01", "RF-MT-02", "RF-MT-03", "RF-MT-04", "RF-MT-07", "RF-PM-01"],
    appPath: "/app/organization",
    screenshots: [
      { src: "/screens/multi-tenant-ruoli/org.png", caption: "Gestione organizzazione e inviti" },
      { src: "/screens/multi-tenant-ruoli/matrix.png", caption: "Matrice permessi utenti×moduli" },
    ],
  },
  {
    slug: "documenti-vivi",
    title: "Documenti vivi",
    tagline: "Requisiti, manuale e brochure aggiornati a ogni iterazione di sviluppo.",
    category: "governance",
    icon: "FileText",
    bullets: [
      "Requisiti funzionali e non funzionali versionati",
      "Manuale operativo consultabile in app e pubblicamente",
      "Brochure HTML + PDF scaricabile",
      "Pagine descrittive per ogni funzione",
    ],
    benefits: [
      "Onboarding clienti più rapido",
      "Audit-ready: tutto è documentato",
      "Marketing e supporto allineati con il prodotto reale",
    ],
    flow: [
      "Apri /manual per consultare il manuale operativo",
      "Apri /brochure per scaricare il PDF commerciale",
      "In app: /app/docs per tutti i documenti tecnici",
    ],
    modules: ["docs"],
    rfRefs: ["RF-DOC-01"],
    appPath: "/app/docs",
    screenshots: [
      { src: "/screens/documenti-vivi/docs.png", caption: "Documenti vivi nell'app" },
    ],
  },
  {
    slug: "fornitori",
    title: "Fornitori & Contratti",
    tagline: "Albo fornitori, contratti, compliance documentale e ordini.",
    category: "governance",
    icon: "Briefcase",
    bullets: [
      "Anagrafica fornitori con compliance documentale (DURC, assicurazioni)",
      "Contratti con scadenze e alert 30g",
      "Ordini d'acquisto (PO) e ordini di lavoro (WO)",
      "Penali e SLA contrattuali",
    ],
    benefits: [
      "Niente più contratti scaduti senza preavviso",
      "Visibilità su affidabilità fornitore",
      "Gestione end-to-end della spesa esterna",
    ],
    flow: [
      "Carica fornitore e documenti compliance",
      "Lega contratti e SLA contrattuali",
      "Emetti PO o WO collegati a ticket/manutenzione",
      "Sistema avvisa scadenze e applica penali",
    ],
    modules: ["suppliers", "suppliers_compliance", "contracts", "purchase_orders", "work_orders", "penalties"],
    rfRefs: ["RF-SUP-01", "RF-CT-01", "RF-PO-01", "RF-WO-01"],
    appPath: "/app/suppliers",
    screenshots: [
      { src: "/screens/fornitori/list.png", caption: "Albo fornitori con stato compliance" },
      { src: "/screens/fornitori/contracts.png", caption: "Contratti e scadenze" },
    ],
  },
  {
    slug: "manutenzione",
    title: "Manutenzione preventiva",
    tagline: "Piani periodici per asset critici, checklist e firma digitale.",
    category: "operativa",
    icon: "CalendarCheck",
    bullets: [
      "Piani periodici (mensile/trimestrale/annuale) per asset",
      "Checklist con punti di controllo obbligatori",
      "Generazione automatica work order alla scadenza",
      "Firma digitale del tecnico a chiusura",
    ],
    benefits: [
      "Riduce i guasti del 30-50%",
      "Compliance normativa garantita (es. antincendio)",
      "Storico utile in caso di assicurazione/incidente",
    ],
    flow: [
      "Definisci piano sull'asset (frequenza + checklist)",
      "Sistema genera WO 7g prima della scadenza",
      "Tecnico esegue checklist e firma",
      "Asset history aggiornato automaticamente",
    ],
    modules: ["maintenance", "work_orders", "assets"],
    rfRefs: ["RF-MNT-01", "RF-MNT-02"],
    appPath: "/app/maintenance",
    screenshots: [
      { src: "/screens/manutenzione/plans.png", caption: "Piani di manutenzione attivi" },
    ],
  },
  {
    slug: "bollette-ocr",
    title: "Bollette & Fatture (OCR + SDI)",
    tagline: "Carica un PDF, l'AI estrae i dati. Export SDI nativo.",
    category: "finanza",
    icon: "Receipt",
    bullets: [
      "OCR AI su PDF bolletta (Lovable AI Gateway)",
      "Riconciliazione contratto fornitura ↔ fattura",
      "Trend consumi energia/acqua/gas per struttura",
      "Export Fattura Elettronica SDI (XML)",
    ],
    benefits: [
      "Data entry quasi azzerato",
      "Anomalie consumo evidenziate in dashboard",
      "Compliance fiscale italiana out-of-the-box",
    ],
    flow: [
      "Carica PDF bolletta in app o via email",
      "AI estrae periodo, importo, consumo, fornitore",
      "Conferma e archivia, sistema aggiorna trend",
      "Export XML SDI per commercialista",
    ],
    modules: ["invoices", "utilities", "contracts"],
    rfRefs: ["RF-INV-01", "RF-UT-01", "RF-SDI-01"],
    appPath: "/app/invoices",
    screenshots: [
      { src: "/screens/bollette-ocr/upload.png", caption: "Upload bolletta con estrazione AI" },
      { src: "/screens/bollette-ocr/trend.png", caption: "Trend consumi YoY" },
    ],
  },
  {
    slug: "inventario",
    title: "Inventario & Riordini",
    tagline: "Ricambi e materiali sotto controllo, riordini automatici.",
    category: "operativa",
    icon: "Package",
    bullets: [
      "Anagrafica articoli con scorta minima",
      "Movimenti carico/scarico legati ai ticket/WO",
      "Riordino automatico al raggiungimento soglia",
      "Cassa contabile collegata a movimenti",
    ],
    benefits: [
      "Niente fermo manutenzione per pezzi mancanti",
      "Costi materiali tracciati per asset/ticket",
      "Pianificazione acquisti basata su consumi reali",
    ],
    flow: [
      "Carica anagrafica articoli con soglie minime",
      "Movimenti generati da WO/ticket o manuali",
      "Riordino crea proposta PO al fornitore",
      "Approvazione e invio PO automatico",
    ],
    modules: ["inventory", "reorders", "purchase_orders", "cashbook"],
    rfRefs: ["RF-INV-S-01", "RF-RE-01"],
    appPath: "/app/inventory",
    screenshots: [
      { src: "/screens/inventario/list.png", caption: "Magazzino con stato scorta" },
    ],
  },
  {
    slug: "smart-inbox",
    title: "Smart Inbox & Notifiche",
    tagline: "Tutto ciò che richiede attenzione, in un unico flusso.",
    category: "intelligenza",
    icon: "Inbox",
    bullets: [
      "Ticket critici, SLA breach, scadenze, accessi negati, alert admin",
      "Stato nuovo / letto / risolto con azioni rapide",
      "Notifiche multicanale (in-app, email, push)",
      "Preferenze per organizzazione e per utente",
    ],
    benefits: [
      "Riduce il rumore: solo cose che contano",
      "Decisioni più rapide grazie al contesto",
      "Coordinamento tra owner, admin e tecnici",
    ],
    flow: [
      "Apri Smart Inbox a inizio turno",
      "Risolvi o delega le voci in elenco",
      "Imposta preferenze notifiche per categoria",
      "Admin riceve alert su accessi negati",
    ],
    modules: ["smart_inbox", "notifications", "notification_prefs", "alerts", "admin_alerts", "access_denied"],
    rfRefs: ["RF-SI-01", "RF-NT-01"],
    appPath: "/app/smart-inbox",
    screenshots: [
      { src: "/screens/smart-inbox/inbox.png", caption: "Smart Inbox con tutte le voci" },
    ],
  },
  {
    slug: "sostenibilita",
    title: "Sostenibilità & ESG",
    tagline: "Footprint energia/acqua/gas per camera, benchmark e report.",
    category: "intelligenza",
    icon: "Leaf",
    bullets: [
      "KPI per camera/anno (kWh, mc, Smc)",
      "Benchmark vs target settoriali",
      "Trend YoY e proiezioni",
      "Export report ESG per direzione/proprietà",
    ],
    benefits: [
      "Allineamento a CSRD e richieste corporate",
      "Identifica strutture/asset più energivori",
      "Story-telling sostenibilità verso ospiti",
    ],
    flow: [
      "Le bollette alimentano i KPI automaticamente",
      "Imposta target per struttura",
      "Confronta YoY e benchmark",
      "Esporta report ESG PDF",
    ],
    modules: ["sustainability", "utilities", "trends", "reports"],
    rfRefs: ["RF-ESG-01", "RF-TR-01"],
    appPath: "/app/sustainability",
    screenshots: [
      { src: "/screens/sostenibilita/esg.png", caption: "Dashboard ESG per struttura" },
    ],
  },
  {
    slug: "report-statistiche",
    title: "Report, Statistiche & Export",
    tagline: "Report builder, dashboard direzionali, export schedulati condivisibili.",
    category: "intelligenza",
    icon: "BarChart3",
    bullets: [
      "Dashboard direzionale (overview multistruttura)",
      "Report builder drag & drop",
      "Export PDF/CSV/XLSX/XML",
      "Schedulazioni giornaliere/settimanali/mensili con link condivisibile",
    ],
    benefits: [
      "Direttore vede tutto in 30 secondi",
      "Proprietà riceve report automatici via email",
      "Niente più 'esportami quel dato': è già pronto",
    ],
    flow: [
      "Componi report nel builder",
      "Pianifica frequenza e destinatari",
      "Sistema genera e invia link condivisibile",
      "Storico esecuzioni consultabile",
    ],
    modules: ["reports", "report_builder", "statistics", "overview", "trends", "scheduled_exports", "structure_kpi", "cost_analytics"],
    rfRefs: ["RF-RP-01", "RF-EX-01", "RF-OV-01"],
    appPath: "/app/overview",
    screenshots: [
      { src: "/screens/report-statistiche/overview.png", caption: "Overview direzionale" },
      { src: "/screens/report-statistiche/builder.png", caption: "Report builder" },
    ],
  },
];

export const FEATURES_BY_CATEGORY: Record<FeatureCategory, FeatureItem[]> = FEATURE_CATALOG.reduce(
  (acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  },
  {} as Record<FeatureCategory, FeatureItem[]>,
);

export const CATEGORY_LABEL: Record<FeatureCategory, string> = {
  operativa: "Operatività quotidiana",
  governance: "Governance & Sicurezza",
  finanza: "Finanza & Compliance",
  intelligenza: "Intelligenza & Reporting",
};

export function getFeature(slug: string): FeatureItem | undefined {
  return FEATURE_CATALOG.find((f) => f.slug === slug);
}