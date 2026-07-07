import type { ParsedStatement, RawParsedTransaction } from './types';

/** Matches dd/mm/yy, dd/mm/yyyy, dd-mm-yy, dd-mm-yyyy. */
const DATE_RE = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/;

export function isLikelyDate(value: string | undefined): boolean {
  return !!value && DATE_RE.test(value.trim());
}

export function normalizeSlashDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const [d, m, y] = raw.trim().split(/[/-]/);
  if (!d || !m || !y) return undefined;
  const day = d.padStart(2, '0');
  const month = m.padStart(2, '0');
  const year = y.length === 2 ? (Number(y) > 70 ? `19${y}` : `20${y}`) : y;
  return `${year}-${month}-${day}`;
}

export function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const HEADER_ALIASES = {
  date: [/^(txn |transaction )?date$/i],
  narration: [/narration/i, /description/i, /particulars/i],
  valueDate: [/value\s*dt/i, /value date/i],
  debit: [/withdrawal/i, /debit/i],
  credit: [/deposit/i, /credit/i],
  refNo: [/chq/i, /ref/i],
  balance: [/closing balance/i, /^balance/i],
};

function findColumn(headerRow: string[], aliases: RegExp[]): number {
  return headerRow.findIndex((cell) => aliases.some((re) => re.test((cell ?? '').trim())));
}

/**
 * Shared header-detection + row-mapping logic for any statement that arrives as a grid of
 * string cells (CSV rows, a real .xlsx sheet, or an HTML table disguised as .xls - all three
 * reduce to this same shape before reaching here). HDFC NetBanking exports typically have a
 * few metadata rows before the real header, so we scan for it rather than assuming row 0.
 */
export function buildParsedStatementFromRows(rows: string[][]): ParsedStatement {
  const headerIdx = rows.findIndex(
    (row) =>
      findColumn(row, HEADER_ALIASES.narration) !== -1 &&
      (findColumn(row, HEADER_ALIASES.debit) !== -1 || findColumn(row, HEADER_ALIASES.credit) !== -1)
  );

  if (headerIdx === -1) {
    return {
      periodStart: null,
      periodEnd: null,
      transactions: [],
      warnings: [
        'Could not locate a header row (expected columns like Narration/Withdrawal/Deposit). ' +
          'The HDFC export format may have changed - this parser will need updating.',
      ],
    };
  }

  const header = rows[headerIdx];
  const col = {
    date: findColumn(header, HEADER_ALIASES.date),
    narration: findColumn(header, HEADER_ALIASES.narration),
    valueDate: findColumn(header, HEADER_ALIASES.valueDate),
    debit: findColumn(header, HEADER_ALIASES.debit),
    credit: findColumn(header, HEADER_ALIASES.credit),
    refNo: findColumn(header, HEADER_ALIASES.refNo),
    balance: findColumn(header, HEADER_ALIASES.balance),
  };

  const transactions: RawParsedTransaction[] = [];
  const warnings: string[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = col.date !== -1 ? row[col.date] : undefined;
    if (!isLikelyDate(rawDate)) continue; // footer/summary row (e.g. "Generated on...") - stop silently

    const debit = col.debit !== -1 ? parseAmount(row[col.debit]) : 0;
    const credit = col.credit !== -1 ? parseAmount(row[col.credit]) : 0;

    if (!debit && !credit) {
      warnings.push(`Row ${i + 1}: no debit or credit amount found, skipped ("${row.join(' | ')}")`);
      continue;
    }

    const txnDate = normalizeSlashDate(rawDate);
    if (!txnDate) continue;

    transactions.push({
      txnDate,
      valueDate: col.valueDate !== -1 ? normalizeSlashDate(row[col.valueDate]) : undefined,
      descriptionRaw: (col.narration !== -1 ? row[col.narration] : '')?.trim() ?? '',
      amount: debit || credit,
      direction: debit ? 'debit' : 'credit',
      referenceNo: col.refNo !== -1 ? row[col.refNo]?.trim() || undefined : undefined,
      balanceAfter: col.balance !== -1 ? parseAmount(row[col.balance]) || undefined : undefined,
    });
  }

  return {
    periodStart: transactions[0]?.txnDate ?? null,
    periodEnd: transactions.at(-1)?.txnDate ?? null,
    transactions,
    warnings,
  };
}
