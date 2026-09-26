import { useEffect } from 'react';

import { registerGhostText } from '../../features/ai/ghost';
import { startClipboardTracking } from '../../features/editor/extras/clipboard';
import { registerColorSwatches } from '../../features/editor/extras/colors';
import { startProblemsTracking } from '../../features/problems/problems-store';
import { registerSnippetCompletions } from '../../features/snippets/completions';
import { rlog } from '../../lib/log';
import { onMonacoLoaded } from '../../lib/monaco/load';

/** Language-wide providers (ghost text, snippets, problems) attach once Monaco is loaded. */
export function useMonacoExtras(): void {
	useEffect(() => {
		startProblemsTracking();
		startClipboardTracking();
		const disposers: Array<{ dispose(): void }> = [];
		const off = onMonacoLoaded((monaco) => {
			try {
				disposers.push(
					registerGhostText(monaco),
					registerSnippetCompletions(monaco),
					registerColorSwatches(monaco),
				);
			} catch (error) {
				rlog.error('editor', 'registering editor providers failed', error);
			}
		});
		return () => {
			off();
			for (const d of disposers) d.dispose();
		};
	}, []);
}
