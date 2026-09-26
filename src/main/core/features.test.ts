import { describe, expect, it, vi } from 'vitest';

const logged = vi.hoisted(() => [] as string[]);

vi.mock('electron-log/main', () => {
	const scoped = { info: vi.fn(), warn: vi.fn(), error: (m: string) => logged.push(m) };
	return { default: { scope: () => scoped, error: vi.fn() } };
});
const unavailable = vi.hoisted(() => new Map<string, string>());
vi.mock('./ipc', () => ({
	emitEvent: vi.fn(),
	router: {
		handle: () => () => undefined,
		markUnavailable: (id: string, reason: string) => unavailable.set(id, reason),
	},
}));

import { type FeatureHost, startFeatures } from './features';
import type { SecretsService } from './secrets/secrets-service';
import type { SettingsStore } from './store/json-store';
import type { WorkspaceService } from './workspace/workspace-service';

function host(dataDir: (id: string) => string): FeatureHost {
	return {
		settings: {} as SettingsStore,
		secrets: {} as SecretsService,
		workspace: {} as WorkspaceService,
		dataDir,
	};
}

describe('startFeatures', () => {
	it('keeps starting other features when one data folder cannot be created', async () => {
		const started: string[] = [];
		const dataDir = (id: string): string => {
			if (id === 'broken') throw new Error('EPERM');
			return `/data/${id}`;
		};
		const { failures } = await startFeatures(
			[
				{ id: 'broken', activate: () => void started.push('broken') },
				{ id: 'ok', activate: (ctx) => void started.push(ctx.dataDir) },
			],
			host(dataDir),
		);
		expect(started).toEqual(['/data/ok']);
		expect(logged).toContain('feature failed to start');
		expect(failures).toEqual([{ id: 'broken', message: 'EPERM' }]);
		expect(unavailable.get('broken')).toBe('EPERM');
	});
});
