import { describe, expect, it, vi } from 'vitest';

import { bindInlineEditKeys, INLINE_EDIT_ACTIVE, INLINE_EDIT_REVIEW } from './inline-edit-keys';

type Action = { id: string; keybindings?: number[]; precondition?: string; run: () => void };

function fakeEditor(): {
	editor: Parameters<typeof bindInlineEditKeys>[1];
	keys: Map<string, boolean>;
	actions: Action[];
	disposed: string[];
} {
	const keys = new Map<string, boolean>();
	const actions: Action[] = [];
	const disposed: string[] = [];
	const editor = {
		createContextKey: (key: string, initial: boolean) => {
			keys.set(key, initial);
			return {
				set: (v: boolean) => keys.set(key, v),
				reset: () => keys.set(key, initial),
				get: () => keys.get(key),
			};
		},
		addAction: (a: Action) => {
			actions.push(a);
			return { dispose: () => disposed.push(a.id) };
		},
	} as unknown as Parameters<typeof bindInlineEditKeys>[1];
	return { editor, keys, actions, disposed };
}

const monaco = { KeyCode: { Escape: 9, Tab: 2 } } as unknown as Parameters<
	typeof bindInlineEditKeys
>[0];

describe('bindInlineEditKeys', () => {
	it('binds Esc to cancel and Tab to accept only while reviewing, with the code focused', () => {
		const { editor, keys, actions } = fakeEditor();
		const cancel = vi.fn();
		const accept = vi.fn();
		const bound = bindInlineEditKeys(monaco, editor, { cancel, accept });

		expect(keys.get(INLINE_EDIT_ACTIVE)).toBe(true);
		expect(keys.get(INLINE_EDIT_REVIEW)).toBe(false);
		const esc = actions.find((a) => a.keybindings?.includes(9));
		const tab = actions.find((a) => a.keybindings?.includes(2));
		expect(esc?.precondition).toContain(INLINE_EDIT_ACTIVE);
		expect(tab?.precondition).toContain(INLINE_EDIT_REVIEW);
		for (const a of [esc, tab]) {
			expect(a?.precondition).toContain('editorTextFocus');
			expect(a?.precondition).toContain('!suggestWidgetVisible');
		}
		esc?.run();
		tab?.run();
		expect(cancel).toHaveBeenCalledOnce();
		expect(accept).toHaveBeenCalledOnce();

		bound.setReview(true);
		expect(keys.get(INLINE_EDIT_REVIEW)).toBe(true);
	});

	it('clears the context keys and removes the bindings on dispose', () => {
		const { editor, keys, actions, disposed } = fakeEditor();
		const bound = bindInlineEditKeys(monaco, editor, { cancel: vi.fn(), accept: vi.fn() });
		bound.setReview(true);
		bound.dispose();
		expect(keys.get(INLINE_EDIT_ACTIVE)).toBe(false);
		expect(keys.get(INLINE_EDIT_REVIEW)).toBe(false);
		expect(disposed).toEqual(actions.map((a) => a.id));
	});
});
