import { useEffect } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { onMonacoLoaded } from '../../lib/monaco/load';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { ensureClient, restart, stopAll } from './lsp-clients';
import { useLspStatus } from './lsp-status';
import { serverFor } from './lsp-status';

/**
 * Headless (mounted once by the shell): starts a language server the first time a file of its
 * language is opened in the open folder, and stops them all when the folder changes.
 */
export function LspController(): null {
	const { info } = useWorkspace();
	const root = info.root;
	// A new interpreter means new site-packages; main already stopped the old Python server.
	useAnvilEvent('python:changed', () => {
		if (useLspStatus.getState().status.python.state !== 'idle') void restart(['python']);
	});

	useEffect(() => {
		if (!root) return;
		const prefix = `${root.replace(/\\/g, '/').toLowerCase()}/`;
		const disposers: Array<() => void> = [];
		const offLoaded = onMonacoLoaded((monaco) => {
			const consider = (model: {
				uri: { scheme: string; path: string };
				getLanguageId(): string;
			}): void => {
				// Monaco file URIs look like /c:/Users/...; compare without the leading slash.
				const path = model.uri.path.replace(/^\/([a-zA-Z]:)/, '$1').toLowerCase();
				if (model.uri.scheme !== 'file' || !path.startsWith(prefix)) return;
				const language = serverFor(model.getLanguageId());
				if (language) void ensureClient(language);
			};
			monaco.editor.getModels().forEach(consider);
			const created = monaco.editor.onDidCreateModel(consider);
			const changed = monaco.editor.onDidChangeModelLanguage((e) => consider(e.model));
			disposers.push(
				() => created.dispose(),
				() => changed.dispose(),
			);
		});
		return () => {
			offLoaded();
			for (const dispose of disposers) dispose();
			void stopAll();
		};
	}, [root]);

	return null;
}
