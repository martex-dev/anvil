import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Options {
	clientOptions: { errorHandler: { closed: () => unknown } };
}

/** Stand-in for MonacoLanguageClient: records instances and lets a test fail its start. */
class FakeClient {
	static instances: FakeClient[] = [];
	static failNextStart = false;
	readonly dispose = vi.fn(async () => undefined);
	readonly start: () => Promise<void>;
	constructor(readonly options: Options) {
		const fail = FakeClient.failNextStart;
		FakeClient.failNextStart = false;
		this.start = vi.fn(async () => {
			if (fail) throw new Error('initialize failed');
		});
		FakeClient.instances.push(this);
	}
}

let sessions = 0;
let holdStart: Promise<void> | null = null;
const call = vi.fn(async (channel: string, input: { language?: string; session?: string }) => {
	if (channel === 'lsp:start') {
		if (holdStart) await holdStart;
		sessions += 1;
		return {
			session: `${input.language ?? ''}-${sessions}`,
			rootUri: 'file:///c%3A/work/demo',
			languageIds: [input.language],
			initializationOptions: {},
			notice: null,
		};
	}
	return undefined;
});

vi.mock('../../lib/ipc', () => ({ call }));
vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./ipc-transport', () => ({ ipcTransports: () => ({}) }));
vi.mock('monaco-languageclient', () => ({ MonacoLanguageClient: FakeClient }));
vi.mock('vscode', () => ({ Uri: { parse: (uri: string) => ({ uri }) } }));

const { ensureClient, restart, stopAll } = await import('./lsp-clients');
const { useLspStatus } = await import('./lsp-status');

const stopped = (): unknown[] =>
	call.mock.calls.filter(([c]) => c === 'lsp:stop').map(([, input]) => input.session);
const startCount = (): number => call.mock.calls.filter(([c]) => c === 'lsp:start').length;
const state = (language: 'python' | 'typescript'): string =>
	useLspStatus.getState().status[language].state;

describe('language clients', () => {
	beforeEach(async () => {
		holdStart = null;
		await stopAll();
		call.mockClear();
		FakeClient.instances = [];
		FakeClient.failNextStart = false;
	});

	it('restarting Python leaves the TypeScript server running', async () => {
		await ensureClient('python');
		await ensureClient('typescript');
		const ts = FakeClient.instances[1];
		await restart(['python']);
		expect(ts?.dispose).not.toHaveBeenCalled();
		expect(state('typescript')).toBe('ready');
		expect(state('python')).toBe('ready');
		expect(startCount()).toBe(3);
		expect(stopped()).toEqual(['python-' + String(sessions - 2)]);
	});

	it('starts afresh after a stop that interrupted a start', async () => {
		let release = (): void => undefined;
		holdStart = new Promise((resolve) => {
			release = resolve;
		});
		const first = ensureClient('python');
		// Stop while main is still spawning the first server.
		await vi.waitFor(() => expect(startCount()).toBe(1));
		await stopAll();
		holdStart = null;
		const second = ensureClient('python');
		expect(second).not.toBe(first);
		release();
		await Promise.all([first, second]);
		expect(state('python')).toBe('ready');
		expect(startCount()).toBe(2);
		// The interrupted start's server is shut down, not left running.
		expect(stopped()).toHaveLength(1);
	});

	it('disposes the client and stops the server when initialize fails', async () => {
		FakeClient.failNextStart = true;
		await ensureClient('python');
		expect(state('python')).toBe('error');
		expect(FakeClient.instances[0]?.dispose).toHaveBeenCalled();
		expect(stopped()).toHaveLength(1);
	});

	it('releases a client whose server crashed', async () => {
		vi.useFakeTimers();
		try {
			await ensureClient('python');
			const client = FakeClient.instances[0];
			client?.options.clientOptions.errorHandler.closed();
			expect(state('python')).toBe('error');
			await vi.runAllTimersAsync();
			expect(client?.dispose).toHaveBeenCalled();
			expect(stopped()).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
