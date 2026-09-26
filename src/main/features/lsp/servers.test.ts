import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { serverLaunch, tsserverPath, workspaceTsserver } from './servers';

let root: string;
let local: string;
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'anvil-ts-'));
	mkdirSync(join(root, 'node_modules', 'typescript', 'lib'), { recursive: true });
	local = join(root, 'node_modules', 'typescript', 'lib', 'tsserver.js');
	writeFileSync(local, '');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('tsserverPath', () => {
	it("never runs a folder's own TypeScript unless the user opted in", () => {
		expect(workspaceTsserver(root)).toBe(local);
		expect(tsserverPath(root)).not.toBe(local);
		expect(serverLaunch('typescript', root).initializationOptions).toEqual({
			tsserver: { path: tsserverPath(root) },
		});
		expect(tsserverPath(root, true)).toBe(local);
		expect(
			serverLaunch('typescript', root, null, process.env, true).initializationOptions,
		).toEqual({ tsserver: { path: local } });
	});

	it('falls back to the bundled TypeScript when the folder has none', () => {
		rmSync(join(root, 'node_modules'), { recursive: true });
		expect(workspaceTsserver(root)).toBeNull();
		expect(tsserverPath(root, true)).toBe(tsserverPath(root));
	});
});
