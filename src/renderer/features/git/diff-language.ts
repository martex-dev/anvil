/** What Monaco's language registry says about a language (`monaco.languages.getLanguages()`). */
export interface LanguageInfo {
	id: string;
	extensions?: string[] | undefined;
	filenames?: string[] | undefined;
}

/**
 * Used only before Monaco has loaded (a diff opened before any editor): the common cases, with
 * the ids of the bundled VS Code language extensions.
 */
const FALLBACK_BY_EXT: Record<string, string> = {
	'.py': 'python',
	'.pyi': 'python',
	'.ts': 'typescript',
	'.tsx': 'typescriptreact',
	'.mts': 'typescript',
	'.cts': 'typescript',
	'.js': 'javascript',
	'.jsx': 'javascriptreact',
	'.mjs': 'javascript',
	'.cjs': 'javascript',
	'.json': 'json',
	'.md': 'markdown',
	'.toml': 'ini',
	'.ini': 'ini',
	'.yml': 'yaml',
	'.yaml': 'yaml',
	'.css': 'css',
	'.scss': 'scss',
	'.html': 'html',
	'.xml': 'xml',
	'.sql': 'sql',
	'.sh': 'shellscript',
	'.ps1': 'powershell',
	'.rs': 'rust',
	'.go': 'go',
	'.r': 'r',
	'.jl': 'julia',
	'.bat': 'bat',
	'.log': 'log',
};

/**
 * Language id for a file shown in a diff, from its name: an exact filename match in the registry
 * (Dockerfile), then the longest matching extension (`.d.ts` over `.ts`), then the fallback.
 */
export function languageForFile(
	name: string,
	languages: readonly LanguageInfo[] | null,
): string | null {
	const lower = name.toLowerCase();
	let best: { id: string; length: number } | null = null;
	for (const lang of languages ?? []) {
		if (lang.filenames?.some((f) => f.toLowerCase() === lower)) return lang.id;
		for (const ext of lang.extensions ?? []) {
			const e = ext.toLowerCase();
			if (lower.endsWith(e) && e.length < lower.length && (!best || e.length > best.length))
				best = { id: lang.id, length: e.length };
		}
	}
	if (best) return best.id;
	const dot = lower.lastIndexOf('.');
	return dot > 0 ? (FALLBACK_BY_EXT[lower.slice(dot)] ?? null) : null;
}
