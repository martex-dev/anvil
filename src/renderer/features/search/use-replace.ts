import { useState } from 'react';

import type { SearchFile, SearchQuery, SearchResult } from '@shared/ipc/channels/search';

import { toast } from '../../stores/toast-store';
import { replaceAcross, type ReplaceTarget, reportReplace, targetsFor } from './replace';
import { fileMatchCount } from './search-count';

export interface ReplaceAllPrompt {
	matches: number;
	files: number;
	/** The search stopped early: only the listed matches would be replaced. */
	partial: boolean;
}

/**
 * Replace for the Search view. Always replaces what the results show, with the query that
 * produced them (not text typed since), and re-runs the search afterwards.
 */
export function useReplace(options: {
	query: SearchQuery;
	result: SearchResult | undefined;
	/** The results belong to an older query (a new one is running): nothing to replace yet. */
	stale: boolean;
	replacement: string;
	refetch: () => void;
}): {
	busy: boolean;
	/** Replacing is possible: fresh results with matches. */
	ready: boolean;
	replaceFile: (file: SearchFile) => void;
	replaceLine: (file: SearchFile, line: number) => void;
	prompt: ReplaceAllPrompt | null;
	askReplaceAll: () => void;
	answerReplaceAll: (ok: boolean) => void;
} {
	const { query, result, stale, replacement, refetch } = options;
	const [busy, setBusy] = useState(false);
	const [prompt, setPrompt] = useState<ReplaceAllPrompt | null>(null);
	const ready = !busy && !stale && (result?.files.length ?? 0) > 0;

	const run = (targets: ReplaceTarget[]): void => {
		if (!ready || targets.length === 0) return;
		setBusy(true);
		replaceAcross(query, replacement, targets)
			.then(reportReplace)
			.catch((error: unknown) =>
				toast.error('Replace failed', error instanceof Error ? error.message : undefined),
			)
			.finally(() => {
				setBusy(false);
				refetch();
			});
	};

	return {
		busy,
		ready,
		replaceFile: (file) => run(targetsFor([file])),
		replaceLine: (file, line) => run(targetsFor([file], line)),
		prompt,
		askReplaceAll: () => {
			if (!ready || !result) return;
			setPrompt({
				matches: result.files.reduce((n, f) => n + fileMatchCount(f), 0),
				files: result.files.length,
				partial: result.truncated || result.files.some((f) => f.capped === true),
			});
		},
		answerReplaceAll: (ok) => {
			setPrompt(null);
			if (ok && result) run(targetsFor(result.files));
		},
	};
}
