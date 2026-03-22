import { themes, applyTheme } from '$lib/themes';
import type { EvergoodTheme } from '$lib/types/theme';

export type ThemePreference = 'light' | 'dark' | 'system';

let currentName = $state<'midnight' | 'snow'>('midnight');
let currentPreference = $state<ThemePreference>('system');
let mediaQuery: MediaQueryList | null = null;
let mediaQueryInitialized = false;

function resolveThemeName(preference: ThemePreference): 'midnight' | 'snow' {
	if (preference === 'light') return 'snow';
	if (preference === 'dark') return 'midnight';
	if (
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-color-scheme: light)').matches
	) {
		return 'snow';
	}
	return 'midnight';
}

function applyResolvedTheme(): void {
	currentName = resolveThemeName(currentPreference);
	applyTheme(themes[currentName]);
}

function persistPreference(): void {
	try {
		localStorage.setItem('evergood-theme-preference', currentPreference);
	} catch {
		// localStorage unavailable (SSR / private browsing)
	}
}

function ensureMediaQueryListener(): void {
	if (mediaQueryInitialized || typeof window === 'undefined') return;
	mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
	mediaQuery.addEventListener('change', () => {
		if (currentPreference === 'system') {
			applyResolvedTheme();
		}
	});
	mediaQueryInitialized = true;
}

export const themeStore = {
	get current(): EvergoodTheme {
		return themes[currentName] ?? themes.midnight;
	},

	get name(): string {
		return currentName;
	},

	get isDark(): boolean {
		return currentName === 'midnight';
	},

	get preference(): ThemePreference {
		return currentPreference;
	},

	setPreference(preference: ThemePreference) {
		currentPreference = preference;
		applyResolvedTheme();
		persistPreference();
	},

	set(name: string) {
		if (name === 'snow') {
			this.setPreference('light');
			return;
		}
		if (name === 'midnight') {
			this.setPreference('dark');
			return;
		}
	},

	toggle() {
		this.setPreference(currentName === 'midnight' ? 'light' : 'dark');
	},

	/** Call once on mount to restore persisted theme */
	init() {
		ensureMediaQueryListener();

		let storedPreference: string | null = null;
		let storedThemeName: string | null = null;
		try {
			storedPreference = localStorage.getItem('evergood-theme-preference');
			storedThemeName = localStorage.getItem('evergood-theme');
		} catch {
			// SSR or no localStorage
		}

		if (
			storedPreference === 'light' ||
			storedPreference === 'dark' ||
			storedPreference === 'system'
		) {
			currentPreference = storedPreference;
		} else if (storedThemeName === 'snow') {
			currentPreference = 'light';
		} else if (storedThemeName === 'midnight') {
			currentPreference = 'dark';
		}

		applyResolvedTheme();
	},
};
