const COLLAPSED_WIDTH = 64;
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

let sidebarCollapsed = $state(false);
let sidebarWidth = $state(DEFAULT_WIDTH);
/** Mobile overlay open state — only used on mobile */
let mobileOpen = $state(false);

export const uiStore = {
	get sidebarCollapsed() {
		return sidebarCollapsed;
	},

	/** Effective width: collapsed → 64px, otherwise user-set width */
	get sidebarWidth() {
		return sidebarCollapsed ? COLLAPSED_WIDTH : sidebarWidth;
	},

	/** The full (expanded) width the user has chosen */
	get expandedWidth() {
		return sidebarWidth;
	},

	get mobileOpen() {
		return mobileOpen;
	},

	get collapsedWidth() {
		return COLLAPSED_WIDTH;
	},

	toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	},

	collapse() {
		sidebarCollapsed = true;
	},

	expand() {
		sidebarCollapsed = false;
	},

	openMobile() {
		mobileOpen = true;
	},

	closeMobile() {
		mobileOpen = false;
	},

	toggleMobile() {
		mobileOpen = !mobileOpen;
	},

	setSidebarWidth(w: number) {
		sidebarWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w));
	},
};
