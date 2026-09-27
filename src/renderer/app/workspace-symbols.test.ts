import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/monaco/load', () => ({ getLoadedMonaco: () => null }));

import { symbolKindLabel, toWorkspaceSymbols, workspaceSymbols } from './workspace-symbols';

const raw = (name: string, fsPath: string, kind = 11) => ({
	name,
	kind,
	containerName: 'strategy',
	location: {
		uri: { scheme: 'file', fsPath },
		range: { startLineNumber: 12, startColumn: 5 },
	},
});

const inProject = (uri: { fsPath: string }): string | null =>
	uri.fsPath.startsWith('C:\\proj\\') ? uri.fsPath.slice(8).replace(/\\/g, '/') : null;

describe('workspace symbols', () => {
	it('keeps project symbols with their position and a readable kind', () => {
		expect(
			toWorkspaceSymbols([raw('load_prices', 'C:\\proj\\src\\data.py')], inProject),
		).toEqual([
			{
				name: 'load_prices',
				kind: 'function',
				container: 'strategy',
				path: 'src/data.py',
				line: 12,
				column: 5,
			},
		]);
	});

	it('drops library stubs outside the folder', () => {
		const stub = raw('DataFrame', 'C:\\Python\\Lib\\site-packages\\pandas\\frame.pyi', 4);
		expect(toWorkspaceSymbols([stub], inProject)).toEqual([]);
	});

	it('labels unknown kinds generically', () => {
		expect(symbolKindLabel(4)).toBe('class');
		expect(symbolKindLabel(99)).toBe('symbol');
	});

	it('finds nothing before the editor has loaded', async () => {
		await expect(workspaceSymbols('load')).resolves.toEqual([]);
	});
});
