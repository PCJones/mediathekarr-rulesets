/**
 * Theme Store
 * Palette + mode management with system preference detection and localStorage persistence
 */

import { writable, derived } from 'svelte/store';

export type Palette = 'signal' | 'indigo' | 'emerald';
export type Mode = 'light' | 'dark';

interface ThemeState {
	palette: Palette;
	mode: Mode;
}

const STORAGE_KEY = 'mkarr_theme';

function getInitialTheme(): ThemeState {
	if (typeof localStorage === 'undefined') {
		return { palette: 'signal', mode: 'light' };
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (parsed.palette && parsed.mode) {
				return parsed as ThemeState;
			}
		}
	} catch {
		// Ignore parse errors
	}

	// Detect system dark mode preference
	const prefersDark = typeof window !== 'undefined'
		&& window.matchMedia('(prefers-color-scheme: dark)').matches;

	return { palette: 'signal', mode: prefersDark ? 'dark' : 'light' };
}

function applyThemeToDOM(theme: ThemeState) {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-palette', theme.palette);
	document.documentElement.setAttribute('data-mode', theme.mode);
}

function persistTheme(theme: ThemeState) {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
	} catch {
		// Storage might be full
	}
}

function createThemeStore() {
	const initial = getInitialTheme();
	const { subscribe, set, update } = writable<ThemeState>(initial);

	// Apply initial theme
	applyThemeToDOM(initial);

	return {
		subscribe,

		/** Initialize theme (call in onMount) */
		init: () => {
			const theme = getInitialTheme();
			set(theme);
			applyThemeToDOM(theme);
		},

		/** Set palette */
		setPalette: (palette: Palette) => {
			update(state => {
				const next = { ...state, palette };
				applyThemeToDOM(next);
				persistTheme(next);
				return next;
			});
		},

		/** Toggle dark/light mode */
		toggleMode: () => {
			update(state => {
				const next = { ...state, mode: state.mode === 'light' ? 'dark' : 'light' as Mode };
				applyThemeToDOM(next);
				persistTheme(next);
				return next;
			});
		},

		/** Set mode directly */
		setMode: (mode: Mode) => {
			update(state => {
				const next = { ...state, mode };
				applyThemeToDOM(next);
				persistTheme(next);
				return next;
			});
		},

		/** Listen for system preference changes */
		listenForSystemChanges: () => {
			if (typeof window === 'undefined') return () => {};

			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			const handler = (e: MediaQueryListEvent) => {
				// Only auto-switch if user hasn't explicitly set a preference
				const stored = localStorage.getItem(STORAGE_KEY);
				if (!stored) {
					update(state => {
						const next = { ...state, mode: e.matches ? 'dark' : 'light' as Mode };
						applyThemeToDOM(next);
						return next;
					});
				}
			};

			mediaQuery.addEventListener('change', handler);
			return () => mediaQuery.removeEventListener('change', handler);
		}
	};
}

export const themeStore = createThemeStore();

// Derived stores
export const currentPalette = derived(themeStore, ($theme) => $theme.palette);
export const currentMode = derived(themeStore, ($theme) => $theme.mode);
export const isDark = derived(themeStore, ($theme) => $theme.mode === 'dark');
