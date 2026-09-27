/**
 * The adapter speaks absolute paths; Anvil's editor and stores use workspace-relative ones
 * ('/'-separated). These convert between the two for the open folder.
 */

const isWindowsPath = (path: string): boolean =>
	/^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\');

/** "src/a.py" in C:\proj → "C:\proj\src\a.py" (native separators, as debugpy reports them). */
export function absolutePath(root: string, rel: string): string {
	const windows = isWindowsPath(root);
	const sep = windows ? '\\' : '/';
	const base = root.replace(/[\\/]+$/, '');
	return `${base}${sep}${rel.split('/').join(sep)}`;
}

/**
 * An adapter path back to a workspace-relative one, or null when it's outside the folder (the
 * standard library, site-packages). Windows paths compare case-insensitively.
 */
export function relativePath(root: string, abs: string): string | null {
	const windows = isWindowsPath(root);
	const norm = (p: string): string => {
		const forward = p.replace(/\\/g, '/').replace(/\/+$/, '');
		return windows ? forward.toLowerCase() : forward;
	};
	const base = `${norm(root)}/`;
	const path = abs.replace(/\\/g, '/');
	if (!norm(path).startsWith(base)) return null;
	const rel = path.slice(base.length);
	return rel === '' || rel.split('/').includes('..') ? null : rel;
}
