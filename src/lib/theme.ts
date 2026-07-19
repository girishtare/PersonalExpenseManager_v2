export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const THEME_CHANGE_EVENT = 'themechange';

export function getCurrentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  // Belt-and-suspenders alongside the :root/:root.dark CSS rule: setting this as an inline
  // style guarantees native controls (select popups, date pickers) pick it up regardless of
  // any cascade/specificity surprise with the class-based rule.
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function subscribeToTheme(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback);
}

/** Inlined into a beforeInteractive <Script> in the root layout to set the class before first
 * paint - if this ran as a normal effect instead, the page would flash the wrong theme every
 * load whenever the stored/system preference is dark. */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`;
