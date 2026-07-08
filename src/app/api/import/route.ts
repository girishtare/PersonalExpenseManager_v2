import { NextResponse } from 'next/server';
import { requireOwnerUser } from '@/lib/auth/dal';
import { createClient } from '@/lib/supabase/server';
import { getBankAdapter } from '@/lib/bank-adapters/registry';
import { StatementPasswordError } from '@/lib/bank-adapters/errors';
import { computeDedupeHash } from '@/lib/transactions/dedupe';
import { categorizeTransaction, getUncategorizedCategoryId, loadActiveRules } from '@/lib/categorization/engine';
import type { StatementSourceFormat } from '@/lib/bank-adapters/types';

export const maxDuration = 60;

function detectSourceFormat(fileName: string): StatementSourceFormat | null {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  return null;
}

export async function POST(request: Request) {
  const user = await requireOwnerUser();

  const formData = await request.formData();
  const accountId = formData.get('accountId');
  const file = formData.get('file');
  const password = formData.get('password');

  if (typeof accountId !== 'string' || !accountId) {
    return NextResponse.json({ error: 'Select an account.' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
  }

  const sourceFormat = detectSourceFormat(file.name);
  if (!sourceFormat) {
    return NextResponse.json({ error: 'Unsupported file type - expected .csv, .xlsx, or .pdf.' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, bank_code, account_type')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }
  if (account.bank_code !== 'HDFC') {
    return NextResponse.json(
      { error: `No statement parser available for bank "${account.bank_code}" yet.` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const statementId = crypto.randomUUID();
  const storagePath = `${user.id}/${statementId}/${file.name}`;

  const { error: uploadError } = await supabase.storage.from('statements').upload(storagePath, buffer, {
    contentType: file.type || undefined,
  });
  if (uploadError) {
    return NextResponse.json({ error: `Could not store file: ${uploadError.message}` }, { status: 500 });
  }

  const { error: insertStatementError } = await supabase.from('statements').insert({
    id: statementId,
    account_id: account.id,
    user_id: user.id,
    file_name: file.name,
    storage_path: storagePath,
    source_format: sourceFormat,
    parse_status: 'processing',
    password_protected: typeof password === 'string' && password.length > 0,
  });
  if (insertStatementError) {
    return NextResponse.json(
      { error: `Could not create statement record: ${insertStatementError.message}` },
      { status: 500 }
    );
  }

  const adapter = getBankAdapter(account.bank_code);
  const ctx = { accountId: account.id, bankCode: account.bank_code, accountType: account.account_type } as const;

  let parsed;
  try {
    if (sourceFormat === 'csv' && adapter.parseCSV) {
      parsed = await adapter.parseCSV(buffer, ctx);
    } else if (sourceFormat === 'xlsx' && adapter.parseExcel) {
      parsed = await adapter.parseExcel(buffer, ctx);
    } else if (sourceFormat === 'pdf' && adapter.parsePDF) {
      parsed = await adapter.parsePDF(buffer, typeof password === 'string' ? password : undefined, ctx);
    } else {
      throw new Error(`${account.bank_code} adapter does not support ${sourceFormat} files.`);
    }
  } catch (err) {
    if (err instanceof StatementPasswordError) {
      await supabase
        .from('statements')
        .update({ parse_status: 'failed', parse_error: err.reason })
        .eq('id', statementId);
      return NextResponse.json({ error: err.message, passwordError: err.reason }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown parsing error';
    await supabase.from('statements').update({ parse_status: 'failed', parse_error: message }).eq('id', statementId);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let rows;
  try {
    const rules = await loadActiveRules(supabase, user.id);
    const uncategorizedId = await getUncategorizedCategoryId(supabase);

    rows = parsed.transactions.map((txn) => {
      const { categoryId, ruleId } = categorizeTransaction(txn.descriptionRaw, txn.direction, rules, uncategorizedId);
      return {
        user_id: user.id,
        account_id: account.id,
        statement_id: statementId,
        txn_date: txn.txnDate,
        value_date: txn.valueDate ?? null,
        description_raw: txn.descriptionRaw,
        amount: txn.amount,
        direction: txn.direction,
        category_id: categoryId,
        categorization_rule_id: ruleId,
        reference_no: txn.referenceNo ?? null,
        dedupe_hash: computeDedupeHash({
          accountId: account.id,
          txnDate: txn.txnDate,
          amount: txn.amount,
          direction: txn.direction,
          descriptionRaw: txn.descriptionRaw,
          referenceNo: txn.referenceNo,
        }),
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error while categorizing transactions';
    await supabase.from('statements').update({ parse_status: 'failed', parse_error: message }).eq('id', statementId);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let importedCount = 0;
  if (rows.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('transactions')
      .upsert(rows, { onConflict: 'account_id,dedupe_hash', ignoreDuplicates: true })
      .select('id');

    if (insertError) {
      await supabase
        .from('statements')
        .update({ parse_status: 'failed', parse_error: insertError.message })
        .eq('id', statementId);
      return NextResponse.json({ error: `Could not save transactions: ${insertError.message}` }, { status: 500 });
    }
    importedCount = inserted?.length ?? 0;
  }

  const duplicateCount = rows.length - importedCount;
  const parseStatus =
    rows.length === 0 && parsed.warnings.length > 0
      ? 'failed'
      : parsed.warnings.length > 0
        ? 'partially_parsed'
        : 'parsed';

  await supabase
    .from('statements')
    .update({
      parse_status: parseStatus,
      parse_error: parsed.warnings.length > 0 ? parsed.warnings.join('\n') : null,
      statement_period_start: parsed.periodStart,
      statement_period_end: parsed.periodEnd,
      transactions_imported_count: importedCount,
      transactions_duplicate_count: duplicateCount,
      total_amount_due: parsed.totalAmountDue ?? null,
      opening_balance: parsed.openingBalance ?? null,
    })
    .eq('id', statementId);

  return NextResponse.json({
    statementId,
    transactionsImported: importedCount,
    transactionsDuplicate: duplicateCount,
    warnings: parsed.warnings,
  });
}
