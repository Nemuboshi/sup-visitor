import { get, writable } from 'svelte/store';

export type Theme = 'dark' | 'light';

const storageKey = 'supview-theme';

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light';
}

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  const saved = window.localStorage.getItem(storageKey);
  if (isTheme(saved)) return saved;

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export const theme = writable<Theme>(readTheme());

export function applyTheme(nextTheme: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = nextTheme;
  if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, nextTheme);
  theme.set(nextTheme);
}

export function initializeTheme(): Theme {
  const initialTheme = readTheme();
  applyTheme(initialTheme);
  return initialTheme;
}

export function toggleTheme(): void {
  applyTheme(get(theme) === 'dark' ? 'light' : 'dark');
}
