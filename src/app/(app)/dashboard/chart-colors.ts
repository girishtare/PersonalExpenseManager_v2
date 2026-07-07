// Validated against the dataviz skill's default palette (references/palette.md) -
// re-run scripts/validate_palette.js if these are ever changed.
export const CHART_COLORS = {
  light: {
    textSecondary: '#52514e',
    muted: '#898781',
    gridline: '#e1e0d9',
    income: '#2a78d6',
    expense: '#e34948',
    categoryIncome: '#2a78d6',
    categoryExpense: '#eb6834',
    other: '#898781',
  },
  dark: {
    textSecondary: '#c3c2b7',
    muted: '#898781',
    gridline: '#2c2c2a',
    income: '#3987e5',
    expense: '#e66767',
    categoryIncome: '#3987e5',
    categoryExpense: '#d95926',
    other: '#898781',
  },
} as const;
