// Heuristic invoice-field extraction from PDF text — NO LLM (per
// feedback_no_anthropic_api). Best-effort only: it pre-fills a payable the user
// verifies before saving. For accurate extraction, the /invoice-to-payable
// Claude Code skill routes the same text through MCP.

export interface InvoiceFields {
  amount: number | null;
  dueDate: string | null; // ISO YYYY-MM-DD
  iban: string | null;
  reference: string | null;
  vendor: string | null;
}

function parseSwissAmount(raw: string): number | null {
  let s = raw.replace(/['\s  ]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return isFinite(n) ? n : null;
}

function findAmounts(text: string): number[] {
  const re = /(?:CHF|Fr\.?|SFr\.?)?\s*([0-9][0-9'\s  .,]{1,})\s*(?:CHF|Fr\.?)?/gi;
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = parseSwissAmount(m[1]);
    if (v != null && v >= 1 && v < 10_000_000) out.push(v);
  }
  return out;
}

/** Amount: prefer a number on a line mentioning total/à payer/TTC; else the max. */
export function extractAmount(text: string): number | null {
  const keyRe = /(total|montant|à\s*payer|a\s*payer|TTC|solde|net\s*à\s*payer)/i;
  let best: number | null = null;
  for (const line of text.split(/\n+/)) {
    if (keyRe.test(line)) {
      const amts = findAmounts(line);
      if (amts.length) best = Math.max(best ?? 0, ...amts);
    }
  }
  if (best != null) return best;
  const all = findAmounts(text);
  return all.length ? Math.max(...all) : null;
}

function toISO(d: string, mo: string, y: string): string | null {
  const yr = y.length === 2 ? "20" + y : y;
  const mm = mo.padStart(2, "0");
  const dd = d.padStart(2, "0");
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return null;
  return `${yr}-${mm}-${dd}`;
}

function findDates(text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re1 = /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/g; // dd.mm.yyyy (Swiss)
  while ((m = re1.exec(text)) !== null) { const iso = toISO(m[1], m[2], m[3]); if (iso) out.push(iso); }
  const re2 = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;             // yyyy-mm-dd
  while ((m = re2.exec(text)) !== null) { const iso = toISO(m[3], m[2], m[1]); if (iso) out.push(iso); }
  return out;
}

/** Due date: only when a line names it explicitly — a wrong guess is worse than none. */
export function extractDueDate(text: string): string | null {
  const keyRe = /(échéance|echeance|payable\s*(au|jusqu|avant)|due\s*date|à\s*payer\s*(avant|jusqu)|d[ée]lai)/i;
  for (const line of text.split(/\n+/)) {
    if (keyRe.test(line)) {
      const ds = findDates(line);
      if (ds.length) return ds[0];
    }
  }
  return null;
}

export function extractIban(text: string): string | null {
  const m = text.match(/\b(CH\d{2}(?:\s?\d){17})\b/i)
         || text.match(/\b([A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30})\b/);
  return m ? m[1].replace(/\s+/g, "").toUpperCase() : null;
}

export function extractReference(text: string): string | null {
  const qr = text.match(/\b((?:\d\s?){26,27})\b/);
  if (qr) { const r = qr[1].replace(/\s+/g, ""); if (r.length >= 26 && r.length <= 27) return r; }
  const fac = text.match(/\b(?:facture|invoice|n[°o]\.?|r[ée]f(?:[ée]rence)?)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/.]{2,19})\b/i);
  return fac ? fac[1] : null;
}

/** Vendor: best guess at the issuer — first short, non-numeric line near the top. */
export function extractVendor(text: string): string | null {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (line.length < 3 || line.length > 60) continue;
    if (/\d{3,}/.test(line)) continue;
    if (/(facture|invoice|devis|date|page|tva|iban)/i.test(line)) continue;
    if (/^[\d\s  .,'-]+$/.test(line)) continue;
    return line;
  }
  return null;
}

export function extractInvoiceFields(text: string): InvoiceFields {
  if (!text) return { amount: null, dueDate: null, iban: null, reference: null, vendor: null };
  return {
    amount: extractAmount(text),
    dueDate: extractDueDate(text),
    iban: extractIban(text),
    reference: extractReference(text),
    vendor: extractVendor(text),
  };
}
