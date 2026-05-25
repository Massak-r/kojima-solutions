// Heuristic document classifier — no LLM, no external API.
//
// Reads the text extracted by classify_pdf.php and applies keyword/regex
// rules to suggest title / category / target folder / matching client / tags.
// Designed to fail soft: every signal is independent and any missing
// information just lowers the confidence rather than blocking a suggestion.
//
// We deliberately avoid the Anthropic SDK here (per memory
// feedback_no_anthropic_api). A power-user wanting deeper analysis still
// has the /classify-pdf Claude Code slash command, which routes through MCP.

import type { Client } from "@/types/client";
import type { DocFolder } from "@/api/adminDocs";

export type DocCategory =
  | "Comptabilité"
  | "Contrats"
  | "Administratif"
  | "Technique"
  | "RH"
  | "Clients"
  | "Autre";

export interface ClassifySuggestion {
  /** Cleaned-up title (typically max ~60 chars). */
  title: string;
  /** Category bucket — same enum used by the /classify-pdf skill. */
  category: DocCategory;
  /** Folder id chosen via name match against the category; null if no folder matches. */
  folderId: string | null;
  /** Client id whose name was detected in the text (or null). */
  clientId: string | null;
  /** Short labels worth showing on the card (max 5). */
  tags: string[];
  /** Rough self-assessment so the UI can dim "low" suggestions visually. */
  confidence: "high" | "medium" | "low";
  /** Internal — debug-only signals that fired, useful when iterating. */
  reasons: string[];
}

interface ClassifyInput {
  filename: string;
  /** Extracted PDF text — pulled from classify_pdf.php. May be short or empty. */
  text: string;
  currentTitle?: string;
  folders: DocFolder[];
  clients: Client[];
}

/** Lowercase + diacritic-stripped, used for keyword matching. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Pattern → category. Order matters: earlier wins on conflict. */
const CATEGORY_PATTERNS: { pattern: RegExp; category: DocCategory; tag?: string }[] = [
  { pattern: /\b(facture|invoice|devis|quote|quotation)\b/i,              category: "Comptabilité",   tag: "Facturation" },
  { pattern: /\b(iban|bic|swift|relev[ée] bancaire|bank statement)\b/i,   category: "Comptabilité",   tag: "Banque" },
  { pattern: /\b(tva|vat|imp[ôo]ts?|tax(ation)?|d[ée]claration fiscale)\b/i, category: "Comptabilité", tag: "Fiscal" },
  { pattern: /\b(contrat|contract|convention|accord|agreement|nda)\b/i,   category: "Contrats",       tag: "Contrat" },
  { pattern: /\b(condition[s]? g[ée]n[ée]rale[s]?|terms|cgv|cgu)\b/i,     category: "Contrats",       tag: "CGV" },
  { pattern: /\b(bulletin de salaire|fiche de paie|payslip|salaire)\b/i,  category: "RH",             tag: "Salaire" },
  { pattern: /\b(certificat de travail|attestation employeur)\b/i,        category: "RH",             tag: "Emploi" },
  { pattern: /\b(attestation|certificat|certificate)\b/i,                 category: "Administratif",  tag: "Attestation" },
  { pattern: /\b(assurance|insurance|police|policy)\b/i,                  category: "Administratif",  tag: "Assurance" },
  { pattern: /\b(ocas|avs|ai|caf|cgss|impots\.ch|administration)\b/i,     category: "Administratif",  tag: "Admin" },
  { pattern: /\b(specifications? techniques?|datasheet|fiche technique|sp[ée]cifs?)\b/i, category: "Technique", tag: "Specs" },
  { pattern: /\b(ide num[ée]ro|registre du commerce|extrait rc)\b/i,      category: "Administratif",  tag: "SARL" },
];

/** Tag-only signals (no category change). */
const TAG_PATTERNS: { pattern: RegExp; tag: string }[] = [
  { pattern: /\b(urgent|priority|important)\b/i, tag: "Urgent" },
  { pattern: /\b(20\d{2})\b/i,                   tag: "" /* filled with the captured year */ },
  { pattern: /\b(welcome day|wd2026|wd 2026)\b/i, tag: "Welcome Days" },
  { pattern: /\b(pasc|cscs)\b/i,                  tag: "PASC" },
  { pattern: /\b(kaleido)\b/i,                    tag: "Kaleido" },
  { pattern: /\b(dancefloor)\b/i,                 tag: "Dancefloor" },
];

/** Folder match by name → category. Loose contains-match so "Compta-2026" still matches "Comptabilité". */
const FOLDER_CATEGORY_HINTS: { needle: string; category: DocCategory }[] = [
  { needle: "compta",       category: "Comptabilité" },
  { needle: "facture",      category: "Comptabilité" },
  { needle: "banque",       category: "Comptabilité" },
  { needle: "contrat",      category: "Contrats" },
  { needle: "client",       category: "Clients" },
  { needle: "rh",           category: "RH" },
  { needle: "salaire",      category: "RH" },
  { needle: "admin",        category: "Administratif" },
  { needle: "technique",    category: "Technique" },
  { needle: "specs",        category: "Technique" },
];

/** Pick a folder whose name best aligns with the chosen category. */
function chooseFolder(category: DocCategory, folders: DocFolder[]): string | null {
  const hits: DocFolder[] = [];
  for (const f of folders) {
    const nf = normalize(f.name);
    for (const hint of FOLDER_CATEGORY_HINTS) {
      if (hint.category === category && nf.includes(hint.needle)) {
        hits.push(f);
        break;
      }
    }
  }
  if (hits.length === 0) return null;
  // Prefer the deepest folder (most specific) — proxy: highest sortOrder.
  hits.sort((a, b) => b.sortOrder - a.sortOrder);
  return hits[0].id;
}

/** Find a client whose name appears in the text. */
function detectClient(text: string, clients: Client[]): Client | null {
  const norm = normalize(text);
  for (const c of clients) {
    const n = normalize(c.name);
    if (n.length < 3) continue;
    if (norm.includes(n)) return c;
    if (c.organization && normalize(c.organization).length > 3 && norm.includes(normalize(c.organization))) {
      return c;
    }
  }
  return null;
}

/** Pull a likely human title from the text. Fallback to filename. */
function pickTitle(text: string, filename: string, currentTitle?: string): string {
  const base = filename.replace(/\.pdf$/i, "");
  if (!text || text.length < 20) return currentTitle?.trim() || base;

  // Match common invoice/quote number patterns near top of text.
  const invoiceMatch = text.match(/\b(?:facture|invoice)\s*(?:n[°o]?\.?)?\s*([A-Z0-9\-./]{3,20})/i);
  if (invoiceMatch) {
    return `Facture ${invoiceMatch[1]}`.slice(0, 60);
  }
  const quoteMatch = text.match(/\b(?:devis|quote)\s*(?:n[°o]?\.?)?\s*([A-Z0-9\-./]{3,20})/i);
  if (quoteMatch) {
    return `Devis ${quoteMatch[1]}`.slice(0, 60);
  }

  // Match a 4-digit year that's close to a "Facture/Contrat" word.
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const docType = text.match(/\b(facture|devis|contrat|attestation|certificat|bulletin|relev[ée])\b/i)?.[1];
  if (yearMatch && docType) {
    return `${docType.charAt(0).toUpperCase()}${docType.slice(1)} ${yearMatch[1]}`.slice(0, 60);
  }

  // Otherwise: use the existing title if it looks informative, else filename.
  if (currentTitle && currentTitle.length > 3 && !currentTitle.match(/^scan[\s_-]?\d/i)) {
    return currentTitle.slice(0, 60);
  }
  return base.slice(0, 60);
}

export function classifyDocument(input: ClassifyInput): ClassifySuggestion {
  const { text, filename, currentTitle, folders, clients } = input;
  const haystack = `${filename} ${text}`;
  const reasons: string[] = [];
  const tags = new Set<string>();
  let category: DocCategory = "Autre";
  let firstHit: (typeof CATEGORY_PATTERNS)[number] | null = null;

  // Category — first matching pattern wins.
  for (const rule of CATEGORY_PATTERNS) {
    if (rule.pattern.test(haystack)) {
      category = rule.category;
      firstHit = rule;
      if (rule.tag) tags.add(rule.tag);
      reasons.push(`category=${rule.category} (matched ${rule.pattern})`);
      break;
    }
  }

  // Extra tags — every match counts.
  for (const rule of TAG_PATTERNS) {
    const m = haystack.match(rule.pattern);
    if (m) {
      const tag = rule.tag || m[1] || "";
      if (tag) tags.add(tag);
    }
  }

  // Client detection — promotes category to "Clients" only if we didn't already
  // have a stronger signal (facture/contrat keep their own category and the
  // client just rides along as a tag).
  const client = detectClient(haystack, clients);
  if (client) {
    tags.add(client.name);
    reasons.push(`client=${client.name}`);
    if (category === "Autre") {
      category = "Clients";
      reasons.push("category=Clients (only client signal)");
    }
  }

  // Folder match.
  const folderId = chooseFolder(category, folders);
  if (folderId) {
    const f = folders.find((x) => x.id === folderId);
    reasons.push(`folder=${f?.name}`);
  }

  // Confidence: high if we matched a category pattern AND a folder, medium
  // if just one, low if "Autre" with no hits.
  const haveCategory = firstHit !== null || client !== null;
  const haveFolder = folderId !== null;
  const confidence: ClassifySuggestion["confidence"] =
    haveCategory && haveFolder ? "high"
    : haveCategory || haveFolder ? "medium"
    : "low";

  return {
    title: pickTitle(text, filename, currentTitle),
    category,
    folderId,
    clientId: client?.id ?? null,
    tags: Array.from(tags).slice(0, 5),
    confidence,
    reasons,
  };
}
