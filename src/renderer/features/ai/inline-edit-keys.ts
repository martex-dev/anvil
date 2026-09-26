import type * as Monaco from 'monaco-editor';

/** True on the editor while a Ctrl+I session is open. */
export const INLINE_EDIT_ACTIVE = 'anvilInlineEditActive';
/** True while a generated change is waiting to be accepted or rejected. */
export const INLINE_EDIT_REVIEW = 'anvilInlineEditReview';

// Leave Esc / Tab to Monaco's own widgets (suggest, ghost text, snippets, find) when they're up.
const WIDGETS_CLOSED =
	'!suggestWidgetVisible && !inlineSuggestionVisible && !parameterHintsVisible && !inSnippetMode';

export interface InlineEditKeys {
	setReview: (review: boolean) => void;
	dispose: () => void;
}

/**
 * Esc (cancel / reject) and Tab (accept a reviewed change) while focus is in the code, not the
 * box. Without these, Tab typed a tab into the file, which then silently accepted the change.
 */
export function bindInlineEditKeys(
	monaco: Pick<typeof Monaco, 'KeyCode'>,
	editor: Pick<Monaco.editor.IStandaloneCodeEditor, 'createContextKey' | 'addAction'>,
	handlers: { cancel: () => void; accept: () => void },
): InlineEditKeys {
	const active = editor.createContextKey<boolean>(INLINE_EDIT_ACTIVE, false);
	const review = editor.createContextKey<boolean>(INLINE_EDIT_REVIEW, false);
	active.set(true);
	const actions = [
		editor.addAction({
			id: 'anvil.inlineEdit.cancel',
			label: 'AI: Cancel Inline Edit',
			keybindings: [monaco.KeyCode.Escape],
			precondition: `${INLINE_EDIT_ACTIVE} && editorTextFocus && ${WIDGETS_CLOSED}`,
			run: handlers.cancel,
		}),
		editor.addAction({
			id: 'anvil.inlineEdit.accept',
			label: 'AI: Accept Inline Edit',
			keybindings: [monaco.KeyCode.Tab],
			precondition: `${INLINE_EDIT_REVIEW} && editorTextFocus && ${WIDGETS_CLOSED}`,
			run: handlers.accept,
		}),
	];
	return {
		setReview: (on) => review.set(on),
		dispose: () => {
			for (const a of actions) a.dispose();
			active.reset();
			review.reset();
		},
	};
}

/**
 * Whether a keydown in the review box accepts the change: Ctrl/Cmd+Enter anywhere, or a plain
 * Tab on the box itself. Shift+Tab and Tab on the Reject / Accept buttons move focus as usual.
 */
export function isAcceptKey(
	e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey'>,
	onBox: boolean,
): boolean {
	if (e.key === 'Enter') return e.ctrlKey || e.metaKey;
	return e.key === 'Tab' && !e.shiftKey && onBox;
}
