import type { SearchFile, SearchMatch } from '@shared/ipc/channels/search';

export const TAGS = ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG', 'NOTE'] as const;
export type Tag = (typeof TAGS)[number];

export const COLOR: Record<Tag, string> = {
	TODO: '--info',
	FIXME: '--down',
	BUG: '--down',
	HACK: '--warn',
	XXX: '--warn',
	NOTE: '--text-2',
};

// Only comment-style markers: `# TODO`, `// FIXME:`, `-- NOTE` — not the word in prose or code.
export const PATTERN = String.raw`(#|//|--|/\*|\*|<!--)\s*(TODO|FIXME|HACK|XXX|BUG|NOTE)\b`;

export interface TodoItem {
	path: string;
	line: number;
	column: number;
	tag: Tag;
	text: string;
}

const isTag = (value: string): value is Tag => (TAGS as readonly string[]).includes(value);

/**
 * Reads the tag from what ripgrep actually matched (the marker ends the match), not from the
 * first tag word anywhere on the line: `DEBUG = 1  # NOTE: tune` is a NOTE, not a BUG.
 */
export function parseTodo(path: string, m: SearchMatch): TodoItem {
	const [start, end] = m.ranges[0] ?? [0, 0];
	const found = /[A-Z]+$/.exec(m.text.slice(start, end))?.[0] ?? '';
	const tag = isTag(found) ? found : 'TODO';
	// Drops an owner and the colon: `TODO(marto): fix x` → `fix x`.
	const after = m.text.slice(end).replace(/^\s*(?:\([^)]*\))?\s*:?\s*/, '');
	return { path, line: m.line, column: m.column, tag, text: after.trim() || m.text.trim() };
}

export function parseTodos(files: readonly SearchFile[]): TodoItem[] {
	return files.flatMap((f) => f.matches.map((m) => parseTodo(f.path, m)));
}
