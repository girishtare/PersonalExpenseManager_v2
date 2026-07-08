import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import * as cheerio from 'cheerio';
import type { AccountContext, BankStatementParser, ParsedStatement, RawParsedTransaction } from '../types';
import { buildStatementFromRows, normalizeSlashDate, parseAmount } from '../tabular';
import { StatementPasswordError } from '../errors';

async function parseCSV(fileContent: Buffer, ctx: AccountContext): Promise<ParsedStatement> {
  const text = fileContent.toString('utf-8');
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  return buildStatementFromRows(result.data, ctx.accountType);
}

function isZipMagic(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

function isOleMagic(buf: Buffer): boolean {
  return buf.length > 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
}

async function parseRealXlsx(fileContent: Buffer, ctx: AccountContext): Promise<ParsedStatement> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileContent as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const rows: string[][] = [];
  sheet?.eachRow((row) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1).map((v) => (v == null ? '' : String(v)));
    rows.push(values);
  });
  return buildStatementFromRows(rows, ctx.accountType);
}

/**
 * Legacy binary .xls (BIFF8). ExcelJS doesn't read this format at all, so we fall back to
 * SheetJS here specifically - installed from SheetJS's own CDN (not the npm registry, which
 * is frozen on a version with known unpatched prototype-pollution/ReDoS advisories; the CDN
 * build carries the fixes). Scoped to only this legacy-binary path so the rest of the import
 * pipeline doesn't depend on it.
 */
function parseLegacyXls(fileContent: Buffer, ctx: AccountContext): ParsedStatement {
  const workbook = XLSX.read(fileContent, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
  return buildStatementFromRows(rows, ctx.accountType);
}

function parseHtmlTableStatement(html: string, ctx: AccountContext): ParsedStatement {
  const $ = cheerio.load(html);
  const rows: string[][] = [];
  $('table tr').each((_, tr) => {
    const cells: string[] = [];
    $(tr)
      .find('td,th')
      .each((__, cell) => {
        cells.push($(cell).text().trim());
      });
    if (cells.length) rows.push(cells);
  });
  return buildStatementFromRows(rows, ctx.accountType);
}

/**
 * HDFC's "Excel" export is inconsistent in practice: sometimes a real .xlsx, occasionally a
 * legacy binary .xls, and very often actually an HTML table saved with an .xls extension (a
 * common quirk across Indian bank NetBanking/statement portals). We sniff the real content
 * rather than trusting the file extension. The row shape itself then depends on the account:
 * savings/current exports have separate debit/credit columns, credit card exports have a
 * single Amount column (see buildStatementFromRows).
 */
async function parseExcel(fileContent: Buffer, ctx: AccountContext): Promise<ParsedStatement> {
  if (isZipMagic(fileContent)) {
    return parseRealXlsx(fileContent, ctx);
  }
  if (isOleMagic(fileContent)) {
    return parseLegacyXls(fileContent, ctx);
  }
  const text = fileContent.toString('utf-8');
  if (/<html|<table/i.test(text.slice(0, 2000))) {
    return parseHtmlTableStatement(text, ctx);
  }
  return {
    periodStart: null,
    periodEnd: null,
    transactions: [],
    warnings: ['Unrecognized file format for Excel import - expected a real .xlsx file or an HTML-table export.'],
  };
}

// Matches rows like:
//   "15/03/2026| 17:45 AMAZON PAY INDIA PVT LTD + 990 C 1,234.56 l"
//   "16/05/2026| 00:00 C 76.32 l"                          (no merchant text on some rows)
//   "18/03/2026| 12:10 REFUND FROM MERCHANT Cr 500.00"
// - date is immediately followed by "|" with no space, then an optional HH:MM timestamp.
// - "+ <n>" is a reward-points readout, not part of the amount - ignored.
// - a lone "C" before the amount is an unrelated template artifact, not a Cr/Dr marker -
//   only the full "Cr"/"CR" token means credit; a lone "C" is dropped and defaults to debit.
// - a trailing stray glyph (icon rendered as text, e.g. "l") after the amount is ignored.
const CC_LINE_RE =
  /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\|?\s*(?:\d{1,2}:\d{2}\s+)?(.*?)\s*(?:\+\s*\d+\s*)?(Cr|CR|C)?\s*([\d,]+\.\d{2})\s*\S{0,2}$/;
const LEADING_DATE_RE = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/;

function parseHdfcCcLine(line: string): RawParsedTransaction | null {
  const m = line.match(CC_LINE_RE);
  if (!m) return null;
  const [, dateStr, description, marker, amountStr] = m;
  const txnDate = normalizeSlashDate(dateStr);
  const amount = parseAmount(amountStr);
  if (!txnDate || !amount) return null;
  return {
    txnDate,
    descriptionRaw: description.trim(),
    amount,
    direction: marker?.toLowerCase() === 'cr' ? 'credit' : 'debit',
  };
}

// Best-effort only - unlike CC_LINE_RE (tuned against 44 real rows), this hasn't been verified
// against a real PDF statement's linearized text. Undefined when not found is the expected,
// non-fatal outcome; the reconciliation view treats that as "not verifiable", not a mismatch.
const TOTAL_AMOUNT_DUE_RE = /total\s*amount\s*due\D{0,20}?([\d,]+\.\d{2})/i;

function extractTotalAmountDueFromLines(lines: string[]): number | undefined {
  for (const line of lines) {
    const match = line.match(TOTAL_AMOUNT_DUE_RE);
    if (match) return parseAmount(match[1]) || undefined;
  }
  return undefined;
}

/**
 * Reconstructs table rows from a PDF's positioned text items (pdfjs-dist gives x/y per
 * item; raw text-dump order otherwise interleaves columns unpredictably). This is the
 * highest-iteration-risk piece of the whole import pipeline - expect to tune the grouping
 * tolerance and CC_LINE_RE against real (redacted) HDFC statements rather than assume this
 * works perfectly on the first real file.
 */
async function parsePDF(fileContent: Buffer, password: string | undefined): Promise<ParsedStatement> {
  // pdfjs-dist's glyph/path code calls the browser's DOMMatrix API even during plain text
  // extraction (no rendering involved). Node has no DOMMatrix, so without this polyfill
  // parsing throws "DOMMatrix is not defined" on PDFs with embedded/Type3 fonts.
  if (!('DOMMatrix' in globalThis)) {
    const { default: DOMMatrixPolyfill } = await import('@thednp/dommatrix');
    (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrixPolyfill;
  }

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // pdfjs's own "fake worker" fallback (used since Node has no real Worker/DOM) does
  // `import(this.workerSrc)` with a *runtime-computed* path - Turbopack can't statically
  // analyze that, so it rewrites the call against its own dev-chunk layout instead of the
  // real on-disk module, failing with "Setting up fake worker failed: Cannot find module
  // .../pdf.worker.mjs" (setting GlobalWorkerOptions.workerSrc has no effect on this, since
  // Turbopack's rewrite ignores the runtime string value entirely). Pre-populate the
  // mainThread hook pdfjs checks *before* that broken path, via our own dynamic import with a
  // literal string specifier - which Turbopack bundles correctly, same as the pdf.mjs import above.
  if (!(globalThis as Record<string, unknown>).pdfjsWorker) {
    const { WorkerMessageHandler } = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    (globalThis as Record<string, unknown>).pdfjsWorker = { WorkerMessageHandler };
  }

  let doc;
  try {
    doc = await pdfjsLib.getDocument({ data: new Uint8Array(fileContent), password }).promise;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === 'PasswordException') {
      const code = (err as { code?: number }).code;
      // pdfjs code 1 = NEED_PASSWORD (first attempt), 2 = INCORRECT_PASSWORD (retry failed)
      throw new StatementPasswordError(code === 2 ? 'password_incorrect' : 'password_required');
    }
    throw err;
  }

  const transactions: RawParsedTransaction[] = [];
  const warnings: string[] = [];
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str: string; transform: number[] }>;

    const rowBuckets: number[] = [];
    const rows = new Map<number, Array<{ x: number; str: string }>>();
    for (const item of items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      let bucket = rowBuckets.find((k) => Math.abs(k - y) <= 2);
      if (bucket === undefined) {
        bucket = y;
        rowBuckets.push(bucket);
      }
      if (!rows.has(bucket)) rows.set(bucket, []);
      rows.get(bucket)!.push({ x, str: item.str });
    }

    const sortedRowKeys = [...rows.keys()].sort((a, b) => b - a); // PDF y grows upward
    for (const key of sortedRowKeys) {
      const rowItems = rows.get(key)!.sort((a, b) => a.x - b.x);
      const line = rowItems
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!line) continue;
      allLines.push(line);

      const parsed = parseHdfcCcLine(line);
      if (parsed) {
        transactions.push(parsed);
      } else if (LEADING_DATE_RE.test(line)) {
        warnings.push(`Could not confidently parse line: "${line}"`);
      }
    }
  }

  return {
    periodStart: transactions[0]?.txnDate ?? null,
    periodEnd: transactions.at(-1)?.txnDate ?? null,
    transactions,
    warnings,
    totalAmountDue: extractTotalAmountDueFromLines(allLines),
  };
}

export const hdfcParser: BankStatementParser = {
  bankCode: 'HDFC',
  supportedFormats: ['csv', 'xlsx', 'pdf'],
  parseCSV: (fileContent: Buffer, ctx: AccountContext) => parseCSV(fileContent, ctx),
  parseExcel: (fileContent: Buffer, ctx: AccountContext) => parseExcel(fileContent, ctx),
  parsePDF: (fileContent: Buffer, password: string | undefined) => parsePDF(fileContent, password),
};
