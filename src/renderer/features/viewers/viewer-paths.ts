/** Helpers for workspace-relative, '/'-separated paths ('' is the workspace root). */

export function baseName(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1);
}

export function dirName(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? '' : path.slice(0, slash);
}

/**
 * Resolves a relative link found in a document against the document's folder. Returns null for
 * anything that isn't a plain relative file link (schemes, anchors, escapes above the root).
 */
export function resolveRelative(fromFile: string, href: string): string | null {
	const target = (href.split(/[?#]/)[0] ?? '').trim();
	if (!target || /^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) return null;
	let decoded: string;
	try {
		decoded = decodeURIComponent(target);
	} catch {
		// Malformed %-escapes: treat the link literally rather than failing the click.
		decoded = target;
	}
	const parts = decoded.startsWith('/') ? [] : dirName(fromFile).split('/').filter(Boolean);
	for (const segment of decoded.replace(/\\/g, '/').split('/')) {
		if (!segment || segment === '.') continue;
		if (segment === '..') {
			if (parts.length === 0) return null;
			parts.pop();
		} else {
			parts.push(segment);
		}
	}
	return parts.length > 0 ? parts.join('/') : null;
}

/**
 * Finds the workspace file an Obsidian-style `[[target]]` points to, among `files` (every
 * workspace-relative path). Tries the target next to the document, then from the root, then
 * anywhere in the workspace (Obsidian links by unique name), each with and without `.md`.
 * Matching is case-insensitive like Obsidian's; the shortest matching path wins.
 */
export function resolveWikilink(
	fromFile: string,
	target: string,
	files: readonly string[],
): string | null {
	const clean = target.trim().replace(/\\/g, '/');
	if (!clean || clean.startsWith('#')) return null;
	const names = /\.[a-z\d]+$/i.test(clean) ? [clean, `${clean}.md`] : [`${clean}.md`, clean];
	const byLower = new Map<string, string>();
	for (const file of files) {
		const key = file.toLowerCase();
		if (!byLower.has(key)) byLower.set(key, file);
	}
	for (const name of names) {
		for (const candidate of [resolveRelative(fromFile, name), resolveRelative('', name)]) {
			const hit = candidate === null ? undefined : byLower.get(candidate.toLowerCase());
			if (hit) return hit;
		}
	}
	for (const name of names) {
		const suffix = `/${name.replace(/^\/+/, '').toLowerCase()}`;
		const hits = files.filter((file) => `/${file.toLowerCase()}`.endsWith(suffix));
		hits.sort((a, b) => a.length - b.length || a.localeCompare(b));
		if (hits[0]) return hits[0];
	}
	return null;
}

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return '—';
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit++;
	}
	const digits = unit === 0 || value >= 100 ? 0 : 1;
	return `${value.toFixed(digits)} ${UNITS[unit]}`;
}
