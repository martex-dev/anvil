import type * as Monaco from 'monaco-editor';

import type { MonacoApi } from '../../lib/monaco/setup';
import { SNIPPET_LANGUAGE_IDS, snippetsFor } from './library';
import { placeholderPreview } from './placeholders';

/**
 * Offers Anvil's snippets by prefix in the editor's suggest widget. Returns one disposable that
 * removes every provider it registered.
 */
export function registerSnippetCompletions(monaco: MonacoApi): Monaco.IDisposable {
	const disposables: Monaco.IDisposable[] = [];
	for (const lang of SNIPPET_LANGUAGE_IDS) {
		const snippets = snippetsFor(lang);
		if (snippets.length === 0) continue;
		// Docs are computed once per language; only the replace range depends on the cursor.
		const docs = snippets.map((s) => ({
			value: s.description + '\n\n```' + lang + '\n' + placeholderPreview(s.body) + '\n```',
		}));
		disposables.push(
			monaco.languages.registerCompletionItemProvider(lang, {
				provideCompletionItems(model, position) {
					const word = model.getWordUntilPosition(position);
					const range = new monaco.Range(
						position.lineNumber,
						word.startColumn,
						position.lineNumber,
						word.endColumn,
					);
					return {
						suggestions: snippets.map((s, i) => ({
							label: s.prefix,
							kind: monaco.languages.CompletionItemKind.Snippet,
							detail: `Anvil · ${s.name}`,
							documentation: docs[i] ?? s.description,
							insertText: s.body,
							insertTextRules:
								monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							range,
							// '~' sorts after letters so language-server items keep the top slots.
							sortText: '~' + s.prefix,
						})),
					};
				},
			}),
		);
	}
	return {
		dispose() {
			for (const d of disposables.splice(0)) d.dispose();
		},
	};
}
