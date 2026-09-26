import type { KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { buildRows, type DirState, type TreeRow } from './tree-model';
import { createTypeAhead, treeKeyHandler } from './use-tree-keyboard';

const e = (path: string, kind: FsEntry['kind'] = 'file'): FsEntry => ({
	name: path.split('/').at(-1) ?? path,
	path,
	kind,
	size: 0,
	mtimeMs: 0,
});

const rows = buildRows(
	new Map<string, DirState>([
		['', { entries: [e('data', 'dir'), e('backtest.py'), e('broker.py'), e('main.py')] }],
	]),
	new Set(),
);

function press(
	key: string,
	focused: string | null,
	options: {
		ctrlKey?: boolean;
		altKey?: boolean;
		typeAhead?: (char: string) => string;
		rows?: TreeRow[];
	} = {},
): { setFocused: ReturnType<typeof vi.fn>; preventDefault: ReturnType<typeof vi.fn> } {
	const setFocused = vi.fn();
	const preventDefault = vi.fn();
	const handler = treeKeyHandler({
		rows: options.rows ?? rows,
		focused,
		setFocused,
		toggle: vi.fn(),
		open: vi.fn(),
		rename: vi.fn(),
		remove: vi.fn(),
		typeAhead: options.typeAhead ?? createTypeAhead(),
	});
	const event = {
		key,
		ctrlKey: options.ctrlKey ?? false,
		altKey: options.altKey ?? false,
		metaKey: false,
		shiftKey: false,
		preventDefault,
	};
	handler(event as unknown as KeyboardEvent);
	return { setFocused, preventDefault };
}

describe('treeKeyHandler: modifiers', () => {
	it('leaves Ctrl/Alt combinations to app shortcuts', () => {
		const alt = press('ArrowLeft', 'main.py', { altKey: true });
		const ctrl = press('ArrowDown', 'main.py', { ctrlKey: true });
		expect(alt.preventDefault).not.toHaveBeenCalled();
		expect(ctrl.setFocused).not.toHaveBeenCalled();
	});
});

describe('treeKeyHandler: type-ahead', () => {
	it('jumps to the next item starting with the typed letter, cycling', () => {
		expect(press('b', null).setFocused).toHaveBeenCalledWith('backtest.py');
		expect(press('b', 'backtest.py').setFocused).toHaveBeenCalledWith('broker.py');
		expect(press('B', 'broker.py').setFocused).toHaveBeenCalledWith('backtest.py');
	});

	it('matches a typed word from the current item', () => {
		let time = 0;
		const typeAhead = createTypeAhead(() => time);
		press('b', null, { typeAhead });
		time += 100;
		const { setFocused, preventDefault } = press('r', 'backtest.py', { typeAhead });
		expect(setFocused).toHaveBeenCalledWith('broker.py');
		expect(preventDefault).toHaveBeenCalled();
	});

	it('ignores non-printable keys and a lone space', () => {
		expect(press('Tab', 'main.py').preventDefault).not.toHaveBeenCalled();
		expect(press(' ', 'main.py').preventDefault).not.toHaveBeenCalled();
	});
});

describe('createTypeAhead', () => {
	it('starts over after a pause', () => {
		let time = 0;
		const push = createTypeAhead(() => time);
		expect(push('a')).toBe('a');
		time += 200;
		expect(push('b')).toBe('ab');
		time += 600;
		expect(push('c')).toBe('c');
	});
});

describe('treeKeyHandler: ArrowRight', () => {
	const tree = (data: DirState | undefined): TreeRow[] =>
		buildRows(
			new Map<string, DirState>([
				['', { entries: [e('data', 'dir'), e('main.py')] }],
				...(data ? [['data', data] as const] : []),
			]),
			new Set(['data']),
		);

	it('moves into an expanded folder with children', () => {
		const { setFocused } = press('ArrowRight', 'data', {
			rows: tree({ entries: [e('data/prices.csv')] }),
		});
		expect(setFocused).toHaveBeenCalledWith('data/prices.csv');
	});

	it('stays on an expanded folder that is empty, loading or failed', () => {
		for (const data of [{ entries: [] }, undefined, { error: 'Access denied' }]) {
			const { setFocused } = press('ArrowRight', 'data', { rows: tree(data) });
			expect(setFocused).not.toHaveBeenCalled();
		}
	});
});
