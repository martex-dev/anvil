import markdownIt, { type StateInline } from 'markdown-it';

/**
 * Obsidian-flavoured Markdown → HTML for the preview. `html: false` escapes any raw HTML in a
 * note and markdown-it refuses javascript:/vbscript:/file: links, so the output is safe to inject.
 */
const md = markdownIt({ html: false, linkify: true, typographer: false });
const esc = md.utils.escapeHtml;

interface WikiMeta {
	target: string;
	label: string;
	embed: boolean;
}

function wikilink(state: StateInline, silent: boolean): boolean {
	const src = state.src;
	const embed = src.charCodeAt(state.pos) === 0x21; // '!'
	const open = embed ? state.pos + 1 : state.pos;
	if (!src.startsWith('[[', open)) return false;
	const close = src.indexOf(']]', open + 2);
	if (close === -1) return false;
	const inner = src.slice(open + 2, close);
	if (!inner.trim() || inner.includes('\n') || inner.includes('[')) return false;
	if (!silent) {
		const bar = inner.indexOf('|');
		const ref = bar === -1 ? inner : inner.slice(0, bar);
		const alias = bar === -1 ? '' : inner.slice(bar + 1).trim();
		const target = (ref.split(/[#^]/)[0] ?? '').trim();
		const token = state.push('wikilink', '', 0);
		token.meta = {
			target: target || ref.trim(),
			label: alias || ref.replace('#', ' › ').trim(),
			embed,
		} satisfies WikiMeta;
	}
	state.pos = close + 2;
	return true;
}

const TAG = /^#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/u;

function tag(state: StateInline, silent: boolean): boolean {
	if (state.src.charCodeAt(state.pos) !== 0x23 /* # */) return false;
	const prev = state.pos === 0 ? ' ' : (state.src[state.pos - 1] ?? ' ');
	if (!/\s/.test(prev)) return false;
	const match = TAG.exec(state.src.slice(state.pos));
	if (!match) return false;
	if (!silent) state.push('tag', '', 0).meta = { tag: match[1] ?? '' };
	state.pos += match[0].length;
	return true;
}

md.inline.ruler.before('link', 'wikilink', wikilink);
md.inline.ruler.before('emphasis', 'tag', tag);

md.renderer.rules['wikilink'] = (tokens, idx) => {
	const { target, label, embed } = tokens[idx]?.meta as unknown as WikiMeta;
	// Embedded files (images, other notes) aren't rendered inline yet: show a clickable chip.
	const cls = embed ? 'md-embed' : 'md-wikilink';
	return `<a href="#" class="${cls}" data-wikilink="${esc(target)}">${esc(label)}</a>`;
};
md.renderer.rules['tag'] = (tokens, idx) => {
	const { tag: name } = tokens[idx]?.meta as unknown as { tag: string };
	return `<a href="#" class="md-tag" data-tag="${esc(name)}">#${esc(name)}</a>`;
};

// The renderer's CSP only allows https images; show local ones as a labelled chip instead.
const defaultImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
	const token = tokens[idx];
	const src = String(token?.attrGet('src') ?? '');
	if (token && /^https:\/\//i.test(src) && defaultImage) {
		return defaultImage(tokens, idx, options, env, self);
	}
	return `<span class="md-embed" title="${esc(src)}">${esc(token?.content || src)}</span>`;
};

// GitHub/Obsidian task lists: "[ ] x" / "[x] x" at the start of a list item.
md.core.ruler.after('inline', 'tasks', (state) => {
	for (const token of state.tokens) {
		const first = token.type === 'inline' ? token.children?.[0] : undefined;
		if (!first || first.type !== 'text') continue;
		const task = /^\[([ xX])\] /.exec(first.content);
		if (!task) continue;
		first.content = first.content.slice(task[0].length);
		const box = new state.Token('html_inline', '', 0);
		box.content = `<span class="md-task${task[1] === ' ' ? '' : ' md-task-done'}" aria-hidden="true"></span>`;
		token.children?.unshift(box);
	}
	return false;
});

/** Strips YAML frontmatter; the panel shows its tags separately. */
export function stripFrontmatter(text: string): string {
	if (!text.startsWith('---')) return text;
	const end = text.indexOf('\n---', 3);
	if (end === -1) return text;
	const after = text.indexOf('\n', end + 1);
	return after === -1 ? '' : text.slice(after + 1);
}

export function renderMarkdown(text: string): string {
	return md.render(stripFrontmatter(text));
}
