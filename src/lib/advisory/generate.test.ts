import { describe, expect, it } from 'vitest';
import { buildAdvisoryPrompt, parseAdvisoryResponse } from './generate';
import type { AdvisoryInputs } from './aggregate';

const BASE_INPUTS: AdvisoryInputs = {
  totalIncome: 100000,
  totalExpense: 60000,
  totalInvestment: 10000,
  emiExpense: 20000,
  emiRatioPct: 20,
  investmentRatePct: 10,
  surplusNotInvested: 30000,
  topExpenseCategories: [{ name: 'EMI & Loan Payments', amount: 20000 }],
  investmentBreakdown: [{ name: 'Mutual Funds', amount: 10000 }],
};

describe('buildAdvisoryPrompt', () => {
  it('includes the key figures so the model grounds advice in them', () => {
    const prompt = buildAdvisoryPrompt(BASE_INPUTS);
    expect(prompt).toContain('EMI & Loan Payments');
    expect(prompt).toContain('20.0%');
    expect(prompt).toContain('Mutual Funds');
    expect(prompt).toMatch(/investmentTips/);
    expect(prompt).toMatch(/spendingTips/);
  });

  it('handles a null ratio (no income) without crashing or emitting "null"', () => {
    const prompt = buildAdvisoryPrompt({ ...BASE_INPUTS, emiRatioPct: null, investmentRatePct: null });
    expect(prompt).toContain('n/a');
    expect(prompt).not.toContain('null%');
  });

  it('says "none recorded" rather than an empty list when there is no investment history', () => {
    const prompt = buildAdvisoryPrompt({ ...BASE_INPUTS, investmentBreakdown: [] });
    expect(prompt).toContain('none recorded');
  });
});

describe('parseAdvisoryResponse', () => {
  it('parses a clean JSON response', () => {
    const result = parseAdvisoryResponse('{"investmentTips": ["Tip A", "Tip B"], "spendingTips": ["Tip C"]}');
    expect(result).toEqual({ investmentTips: ['Tip A', 'Tip B'], spendingTips: ['Tip C'] });
  });

  it('strips a markdown code fence Claude wasn\'t supposed to add', () => {
    const result = parseAdvisoryResponse('```json\n{"investmentTips": ["Tip A"], "spendingTips": []}\n```');
    expect(result.investmentTips).toEqual(['Tip A']);
  });

  it('caps each list at 4 tips', () => {
    const result = parseAdvisoryResponse(
      JSON.stringify({ investmentTips: ['1', '2', '3', '4', '5', '6'], spendingTips: [] })
    );
    expect(result.investmentTips).toHaveLength(4);
  });

  it('drops non-string entries and blank strings rather than crashing', () => {
    const result = parseAdvisoryResponse(JSON.stringify({ investmentTips: ['Good tip', 42, '', '   ', null], spendingTips: [] }));
    expect(result.investmentTips).toEqual(['Good tip']);
  });

  it('defaults to empty arrays when a field is missing entirely', () => {
    const result = parseAdvisoryResponse('{}');
    expect(result).toEqual({ investmentTips: [], spendingTips: [] });
  });
});
