import { GoogleGenAI, Type } from '@google/genai';
import type { AdvisoryInputs } from './aggregate';

// Flash tier - free (no credit card) under Google AI Studio's free tier as of writing, and more
// than sufficient quality for one structured summary a day. See generateAdvisory for the key.
const MODEL = 'gemini-2.5-flash';
const MAX_TIPS = 4;

export interface AdvisoryResult {
  investmentTips: string[];
  spendingTips: string[];
  model: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const pct = (value: number | null) => (value === null ? 'n/a' : `${value.toFixed(1)}%`);

/** Pure prompt construction, separated from the API call so it's directly testable. */
export function buildAdvisoryPrompt(inputs: AdvisoryInputs): string {
  const facts = [
    `Annual income: ${formatCurrency(inputs.totalIncome)}`,
    `Annual expense: ${formatCurrency(inputs.totalExpense)}`,
    `Annual investment: ${formatCurrency(inputs.totalInvestment)} (${pct(inputs.investmentRatePct)} of income)`,
    `EMI & loan payments: ${formatCurrency(inputs.emiExpense)} (${pct(inputs.emiRatioPct)} of income)`,
    `Income minus expense minus investment (surplus not currently invested): ${formatCurrency(inputs.surplusNotInvested)}`,
    '',
    'Top expense categories, last 12 months:',
    ...inputs.topExpenseCategories.map((c) => `- ${c.name}: ${formatCurrency(c.amount)}`),
    '',
    'Current investment breakdown, last 12 months:',
    ...(inputs.investmentBreakdown.length > 0
      ? inputs.investmentBreakdown.map((c) => `- ${c.name}: ${formatCurrency(c.amount)}`)
      : ['- none recorded']),
  ];

  return [
    "You are a personal finance advisor reviewing one individual's last 12 months of transaction data (India, INR).",
    'Based on the numbers below, write specific, actionable advice grounded in these exact figures - not generic platitudes. Where you reference general guidance (EMI-to-income ratios, tax-saving vehicles, emergency fund sizing, etc.), use widely-accepted rules of thumb rather than citing specific current interest rates you cannot verify.',
    '',
    facts.join('\n'),
    '',
    `investmentTips: up to ${MAX_TIPS} short, specific suggestions for maximizing savings via investments (e.g. stepping up SIP amount, tax-efficient vehicles like ELSS/NPS/PPF, deploying the surplus not currently invested), grounded in the numbers above.`,
    `spendingTips: up to ${MAX_TIPS} short, specific suggestions for reducing spend, naming the actual category and amount where relevant.`,
    'Each tip should be one or two plain-English sentences - no markdown formatting, no leading bullet characters.',
  ].join('\n');
}

/** Pure response parsing, separated from the API call so it's directly testable. The request
 * enforces a JSON schema server-side (see generateAdvisory), but this stays defensive - tolerant
 * of a stray markdown code fence, missing fields, or malformed entries - since a model response
 * is never a fully trusted input. */
export function parseAdvisoryResponse(raw: string): { investmentTips: string[]; spendingTips: string[] } {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '');
  const data: unknown = JSON.parse(cleaned);
  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  const asTipList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, MAX_TIPS) : [];

  return { investmentTips: asTipList(record.investmentTips), spendingTips: asTipList(record.spendingTips) };
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    investmentTips: { type: Type.ARRAY, items: { type: Type.STRING } },
    spendingTips: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['investmentTips', 'spendingTips'],
};

export async function generateAdvisory(inputs: AdvisoryInputs): Promise<AdvisoryResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: MODEL,
    contents: buildAdvisoryPrompt(inputs),
    config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini response contained no text content.');

  const { investmentTips, spendingTips } = parseAdvisoryResponse(text);
  return { investmentTips, spendingTips, model: MODEL };
}
