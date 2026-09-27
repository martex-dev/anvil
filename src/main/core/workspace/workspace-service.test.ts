import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import type * as FsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JsonStore } from '../store/json-store';
import { WorkspaceService } from './workspace-service';

// Lets a test make stat hang, like a folder on a network drive that has gone offline.
const network = vi.hoisted(() => ({ offline: false }));
vi.mock('node:fs/promises', async (importOriginal) => {
	const actual = await importOriginal<typeof FsPromises>();
	return {
		...actual,
		stat: ((...args: Parameters<typeof actual.stat>) =>
			network.offline
				? new Promise(() => undefined)
				: actual.stat(...args)) as typeof actual.stat,
	};
});

let dir: string;
let settingsFile: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-ws-'));
	mkdirSync(join(dir, 'a'));
	mkdirSync(join(dir, 'b'));
	settingsFile = join(dir, 'settings.json');
});
afterEach(() => {
	network.offline = false;
	rmSync(dir, { recursive: true, force: true });
});

describe('WorkspaceService', () => {
	it('opens a folder, remembers it, and tracks recents newest-first without duplicates', async () => {
		const settings = new JsonStore(settingsFile);
		const ws = new WorkspaceService(settings);
		expect(ws.info()).toEqual({ root: null, name: null, recent: [] });

		ws.open(join(dir, 'a'));
		ws.open(join(dir, 'b'));
		ws.open(join(dir, 'a'));
		expect(ws.info()).toMatchObject({ root: join(dir, 'a'), name: 'a' });
		expect(ws.info().recent).toEqual([join(dir, 'a'), join(dir, 'b')]);

		// Restart: reopens the last folder.
		const next = new WorkspaceService(settings);
		expect(await next.restore()).toBe('restored');
		expect(next.getRoot()).toBe(join(dir, 'a'));
	});

	it('rejects folders that do not exist', () => {
		const ws = new WorkspaceService(new JsonStore(settingsFile));
		expect(() => ws.open(join(dir, 'missing'))).toThrow(/not found/);
	});

	it('does not reopen a folder that disappeared since last run', async () => {
		const settings = new JsonStore(settingsFile);
		new WorkspaceService(settings).open(join(dir, 'b'));
		rmSync(join(dir, 'b'), { recursive: true });
		const next = new WorkspaceService(settings);
		expect(await next.restore()).toBe('missing');
		expect(next.getRoot()).toBeNull();
	});

	it('gives up on a last folder that does not answer, without blocking', async () => {
		const settings = new JsonStore(settingsFile);
		new WorkspaceService(settings).open(join(dir, 'a'));
		const next = new WorkspaceService(settings);
		network.offline = true;
		expect(await next.restore(20)).toBe('timeout');
		expect(next.getRoot()).toBeNull();
	});

	it('keeps a folder the user opened while the last one was being checked', async () => {
		const settings = new JsonStore(settingsFile);
		new WorkspaceService(settings).open(join(dir, 'a'));
		const next = new WorkspaceService(settings);
		const restoring = next.restore();
		next.open(join(dir, 'b'));
		expect(await restoring).toBe('none');
		expect(next.getRoot()).toBe(join(dir, 'b'));
	});

	it('runs every listener even when one throws', () => {
		const errors: unknown[] = [];
		const ws = new WorkspaceService(new JsonStore(settingsFile), (e) => errors.push(e));
		const boom = new Error('watcher failed');
		ws.onChange(() => {
			throw boom;
		});
		const after = vi.fn();
		ws.onChange(after);
		ws.open(join(dir, 'a'));
		expect(after).toHaveBeenCalledOnce();
		expect(errors).toEqual([boom]);
		expect(ws.getRoot()).toBe(join(dir, 'a'));
	});

	it('notifies listeners on open/close and supports unsubscribe', () => {
		const ws = new WorkspaceService(new JsonStore(settingsFile));
		const listener = vi.fn();
		const off = ws.onChange(listener);
		ws.open(join(dir, 'a'));
		ws.close();
		off();
		ws.open(join(dir, 'b'));
		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener.mock.calls[1]?.[0]).toMatchObject({ root: null });
	});

	it('forgets a recent folder without notifying root listeners', () => {
		const ws = new WorkspaceService(new JsonStore(settingsFile));
		ws.open(join(dir, 'a'));
		ws.open(join(dir, 'b'));
		const listener = vi.fn();
		ws.onChange(listener);
		expect(ws.forgetRecent(join(dir, 'a'))).toMatchObject({
			root: join(dir, 'b'),
			recent: [join(dir, 'b')],
		});
		expect(listener).not.toHaveBeenCalled();
	});

	it('forgets a recent folder whatever the case of its path', () => {
		const ws = new WorkspaceService(new JsonStore(settingsFile));
		ws.open(join(dir, 'a'));
		ws.open(join(dir, 'b'));
		expect(ws.forgetRecent(join(dir, 'a').toUpperCase()).recent).toEqual([join(dir, 'b')]);
	});
});
