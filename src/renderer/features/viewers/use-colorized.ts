import { useEffect, useState } from 'react';

import { rlog } from '../../lib/log';
import { getLoadedMonaco, onMonacoLoaded } from '../../lib/monaco/load';

interface Colorized {
	code: string;
	language: string;
	html: string;
}

/**
 * Syntax-highlighted HTML for a snippet, or null until Monaco is available. The viewer never
 * boots Monaco itself (it's ~10 MB); cells upgrade from plain text once an editor has loaded it.
 * Monaco builds the markup from escaped text tokens, so it's safe to inject.
 */
export function useColorized(code: string, language: string): string | null {
	const [ready, setReady] = useState(() => getLoadedMonaco() !== null);
	const [result, setResult] = useState<Colorized | null>(null);

	useEffect(() => (ready ? undefined : onMonacoLoaded(() => setReady(true))), [ready]);

	useEffect(() => {
		const monaco = ready ? getLoadedMonaco() : null;
		if (!monaco || !code) return;
		let cancelled = false;
		monaco.editor
			.colorize(code, language, {})
			.then((html) => {
				if (!cancelled) setResult({ code, language, html });
			})
			.catch((error: unknown) => {
				// Plain text is a fine fallback; keep a trace in case a grammar is broken.
				rlog.warn('notebook', `colorize failed for ${language}`, error);
			});
		return () => {
			cancelled = true;
		};
	}, [code, language, ready]);

	// A stale result (source changed, colorize pending) must not show the old code.
	return result && result.code === code && result.language === language ? result.html : null;
}
