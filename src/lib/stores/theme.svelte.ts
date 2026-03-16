import { themes, applyTheme } from '$lib/themes';
import type { EvergoodTheme } from '$lib/types/theme';

let currentName = $state('midnight');

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

	set(name: string) {
		if (!themes[name]) return;
		currentName = name;
		applyTheme(themes[name]);
		try {
			localStorage.setItem('evergood-theme', name);
		} catch {
			// localStorage unavailable (SSR / private browsing)
		}
	},

	toggle() {
		this.set(currentName === 'midnight' ? 'snow' : 'midnight');
	},

	/** Call once on mount to restore persisted theme */
	init() {
		let stored: string | null = null;
		try {
			stored = localStorage.getItem('evergood-theme');
		} catch {
			// SSR or no localStorage
		}

		if (stored && themes[stored]) {
			currentName = stored;
		} else if (
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-color-scheme: light)').matches
		) {
			currentName = 'snow';
		}

		applyTheme(themes[currentName]);
	},
};
