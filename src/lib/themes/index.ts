import type { EvergoodTheme } from '../types/theme';
import { midnight } from './midnight';
import { snow } from './snow';

export const themes: Record<string, EvergoodTheme> = {
	midnight,
	snow,
};

export const themeNames = Object.keys(themes) as Array<keyof typeof themes>;

/** Apply a theme by setting CSS custom properties on :root */
export function applyTheme(theme: EvergoodTheme): void {
	const root = document.documentElement;
	root.style.setProperty('--eg-bg', theme.bg);
	root.style.setProperty('--eg-bg-secondary', theme.bgSecondary);
	root.style.setProperty('--eg-bg-tertiary', theme.bgTertiary);
	root.style.setProperty('--eg-surface', theme.surface);
	root.style.setProperty('--eg-text', theme.text);
	root.style.setProperty('--eg-text-secondary', theme.textSecondary);
	root.style.setProperty('--eg-text-tertiary', theme.textTertiary);
	root.style.setProperty('--eg-accent', theme.accent);
	root.style.setProperty('--eg-accent-hover', theme.accentHover);
	root.style.setProperty('--eg-accent-text', theme.accentText);
	root.style.setProperty('--eg-border', theme.border);
	root.style.setProperty('--eg-border-subtle', theme.borderSubtle);
	root.style.setProperty('--eg-danger', theme.danger);
	root.style.setProperty('--eg-warning', theme.warning);
	root.style.setProperty('--eg-success', theme.success);
	root.style.setProperty('--eg-info', theme.info);
	root.style.setProperty('--eg-shadow', theme.shadow);
	root.style.setProperty('--eg-ring', theme.ring);
}
