import { useEffect } from 'react';

import { registerGhostText } from '../../features/ai/ghost';
import { startProblemsTracking } from '../../features/problems/problems-store';
import { registerSnippetCompletions } from '../../features/snippets/completions';
import { rlog } from '../../lib/log';
import { onMonacoLoaded } from '../../lib/monaco/load';

/** Language-wide providers (ghost text, snippets, problems) attach once Monaco is loaded. */
export function useMonacoExtras(): void {
	useEffect(() => {
		startProblemsTracking();
		const disposers: Array<{ dispose(): void }> = [];
		const off = onMonacoLoaded((monaco) => {
			try {
				disposers.push(registerGhostText(monaco), registerSnippetCompletions(monaco));
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
