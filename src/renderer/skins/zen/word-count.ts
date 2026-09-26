import { countWords } from '../../features/editor/editor-store';
import { focusedEditor } from '../../lib/monaco/editors';

let cache: { key: string; words: number | null } | null = null;

/**
 * Words in the focused editor's document, for the colophon. Cached per model version, so the
 * status line can ask on every cursor move and only an edit costs a recount.
 */
export function wordsInFocusedEditor(): number | null {
	const model = focusedEditor()?.getModel();
	if (!model) return null;
	const key = `${model.uri.toString()}@${model.getAlternativeVersionId()}`;
	if (cache?.key !== key) {
		// Huge dumps aren't prose; counting them would stall the status line.
		const words = model.getValueLength() > 500_000 ? null : countWords(model.getValue());
		cache = { key, words };
	}
	return cache.words;
}
