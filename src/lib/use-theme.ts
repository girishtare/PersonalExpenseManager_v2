'use client';

import { useSyncExternalStore } from 'react';
import { getCurrentTheme, subscribeToTheme, type Theme } from './theme';

function getServerSnapshot(): Theme {
  return 'light';
}

/** Tracks the manually-toggleable theme (see theme.ts), not just OS preference - charts pick
 * raw hex fills via JS and can't rely on CSS's `.dark` class the way the rest of the UI does. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeToTheme, getCurrentTheme, getServerSnapshot);
}
