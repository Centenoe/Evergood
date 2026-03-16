import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { createHighlighter, type Highlighter } from 'shiki';

let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<void> | null = null;

const SHIKI_LANGS = [
	'javascript', 'typescript', 'python', 'rust', 'go', 'html', 'css',
	'json', 'bash', 'shell', 'markdown', 'svelte', 'jsx', 'tsx',
	'sql', 'yaml', 'toml', 'c', 'cpp', 'java', 'ruby', 'php',
] as const;

/** Initialize shiki highlighter (call once, e.g. onMount in root layout) */
export function initHighlighter(): Promise<void> {
	if (highlighterPromise) return highlighterPromise;
	highlighterPromise = createHighlighter({
		themes: ['github-dark', 'github-light'],
		langs: [...SHIKI_LANGS],
	}).then((h) => {
		highlighter = h;
	});
	return highlighterPromise;
}

function highlightCode(code: string, lang: string): string {
	if (!highlighter) {
		const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
	}
	try {
		const loadedLangs = highlighter.getLoadedLanguages();
		const effectiveLang = loadedLangs.includes(lang) ? lang : 'text';
		return highlighter.codeToHtml(code, {
			lang: effectiveLang,
			themes: { dark: 'github-dark', light: 'github-light' },
			defaultColor: false,
		});
	} catch {
		const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
	}
}

const marked = new Marked();

const renderer: Partial<import('marked').RendererObject> = {
	code({ text, lang }: { text: string; lang?: string }) {
		const language = lang ?? '';
		const highlighted = highlightCode(text, language);
		const langLabel = language ? `<span class="code-lang-label">${language}</span>` : '';
		return `<div class="code-block-wrapper">${langLabel}<button class="code-copy-btn" title="Copy code" aria-label="Copy code"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>${highlighted}</div>`;
	},
};

marked.use({ renderer });

marked.setOptions({
	gfm: true,
	breaks: true,
});

/** Render markdown to sanitized HTML */
export function renderMarkdown(text: string): string {
	const raw = marked.parse(text);
	const html = typeof raw === 'string' ? raw : '';
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [
			'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
			'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
			'table', 'thead', 'tbody', 'tr', 'th', 'td',
			'hr', 'img', 'span', 'div', 'sup', 'sub', 'button', 'svg',
			'rect', 'path', 'line', 'circle',
		],
		ALLOWED_ATTR: [
			'href', 'target', 'rel', 'class', 'alt', 'src', 'title',
			'style', 'aria-label', 'role', 'tabindex',
			'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width',
			'stroke-linecap', 'stroke-linejoin', 'd', 'x', 'y', 'rx', 'ry',
			'cx', 'cy', 'r',
		],
		ADD_ATTR: ['target'],
	});
}
