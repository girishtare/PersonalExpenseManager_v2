// Validated against the dataviz skill's default palette (references/palette.md) -
// re-run scripts/validate_palette.js if these are ever changed.
export const CHART_COLORS = {
  light: {
    textSecondary: '#52514e',
    muted: '#898781',
    gridline: '#e1e0d9',
    income: '#2a78d6',
    expense: '#e34948',
    other: '#898781',
    // Fixed order (never reassigned by rank/filter) - 8-slot categorical ceiling.
    categorical: ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'],
  },
  dark: {
    textSecondary: '#c3c2b7',
    muted: '#898781',
    gridline: '#2c2c2a',
    income: '#3987e5',
    expense: '#e66767',
    other: '#898781',
    categorical: ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'],
  },
} as const;
