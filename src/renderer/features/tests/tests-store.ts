import { create } from 'zustand';

import type { TestDiscovery } from '@shared/ipc/channels/tests';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { queryClient } from '../../lib/query-client';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';
import { saveDirtyFiles } from '../python/save-before-run';
import { runInTerminal } from '../terminal/terminal-store';
import { failedIds, initialRunState, reduceRun, type TestRunState } from './results';
import { affectsTests } from './tree-utils';

/** What a run asked for, so Re-run Last can repeat it. Empty lists mean everything. */
export interface RunRequest {
	ids: string[];
	files: string[];
}

interface TestsState {
	/** Folder the discovery belongs to; a different open folder means it's stale. */
	root: string | null;
	discovery: TestDiscovery | null;
	discovering: boolean;
	/** Discovery itself failed (couldn't start pytest); pytest's own failures are in `discovery`. */
	discoverError: string | null;
	run: TestRunState;
	last: RunRequest | null;
	/** Tree row whose details (message, traceback) are shown. */
	selected: string | null;
	/** Details area shows the selected test or the run's console output. */
	details: 'test' | 'output';
}

export const useTestsStore = create<TestsState>(() => ({
	root: null,
	discovery: null,
	discovering: false,
	discoverError: null,
	run: initialRunState,
	last: null,
	selected: null,
	details: 'test',
}));

export function currentRoot(): string | null {
	return queryClient.getQueryData<{ root: string | null }>(['workspace'])?.root ?? null;
}

let unsubscribe: (() => void) | null = null;

/** Starts applying run events; once, before the first run (a run is the only event source). */
function listen(): void {
	unsubscribe ??= window.anvil.on('tests:event', (event) =>
		useTestsStore.setState((s) => ({ run: reduceRun(s.run, event) })),
	);
}

let watching = false;
let changeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Once tests have been discovered, keeps them current: a changed test file, conftest or pytest
 * config, or another interpreter, re-runs discovery (debounced; never in the middle of a run).
 */
function watchForChanges(): void {
	if (watching) return;
	watching = true;
	const later = (): void => {
		if (changeTimer) clearTimeout(changeTimer);
		changeTimer = setTimeout(() => {
			changeTimer = null;
			const s = useTestsStore.getState();
			if (s.run.running) return;
			if (s.discovery && s.root === currentRoot()) void discoverTests();
		}, 1500);
	};
	window.anvil.on('fs:changed', ({ files }) => {
		if (files.some(affectsTests)) later();
	});
	window.anvil.on('python:changed', later);
}

let discovering: Promise<void> | null = null;

/** Collects the folder's tests; concurrent callers share one pytest process. */
export function discoverTests(): Promise<void> {
	watchForChanges();
	discovering ??= (async () => {
		const root = currentRoot();
		// A different folder's results and selection mean nothing here.
		useTestsStore.setState((s) =>
			s.root === root
				? { discovering: true }
				: {
						root,
						discovering: true,
						discovery: null,
						run: initialRunState,
						selected: null,
					},
		);
		try {
			const discovery = await call('tests:discover');
			useTestsStore.setState({ discovery, discoverError: null });
		} catch (error) {
			rlog.error('tests', 'discovery failed', error);
			useTestsStore.setState({
				discoverError: error instanceof Error ? error.message : String(error),
			});
		} finally {
			useTestsStore.setState({ discovering: false });
			discovering = null;
		}
	})();
	return discovering;
}

/** Discovers unless this folder already has a result (or one is on its way). */
export function ensureDiscovered(): void {
	const s = useTestsStore.getState();
	if (s.discovering || (s.root === currentRoot() && (s.discovery || s.discoverError))) return;
	void discoverTests();
}

/**
 * Runs tests in the Test Explorer: saves unsaved files first (pytest reads them from disk), then
 * streams results into the tree, the gutter and the status bar.
 */
export async function runTests(request: RunRequest = { ids: [], files: [] }): Promise<void> {
	listen();
	if (!(await saveDirtyFiles())) return;
	useTestsStore.setState({ last: request });
	try {
		await call('tests:run', request);
	} catch (error) {
		rlog.error('tests', 'run failed to start', error);
		toast.error('Could not run tests', error instanceof Error ? error.message : undefined);
	}
}

export function runFailedTests(): Promise<void> {
	const ids = failedIds(useTestsStore.getState().run.results);
	if (ids.length === 0) {
		toast.info('No failed tests', 'Everything in the last run passed.');
		return Promise.resolve();
	}
	return runTests({ ids, files: [] });
}

export function rerunLastTests(): Promise<void> {
	const last = useTestsStore.getState().last;
	if (!last) {
		toast.info('Nothing to re-run yet', 'Run some tests first.');
		return Promise.resolve();
	}
	return runTests(last);
}

export async function cancelTests(): Promise<void> {
	try {
		await call('tests:cancel');
	} catch (error) {
		toast.error('Could not stop the run', error instanceof Error ? error.message : undefined);
	}
}

/** Opens the Tests view with the run's console output in the details area. */
export async function showTestOutput(): Promise<void> {
	useLayoutStore.getState().showView('tests');
	useTestsStore.setState({ details: 'output' });
	// After a window reload the renderer has no output of its own; main kept the last run's.
	if (!useTestsStore.getState().run.output) {
		try {
			const { text } = await call('tests:output');
			if (text)
				useTestsStore.setState((s) =>
					s.run.output ? {} : { run: { ...s.run, output: text } },
				);
		} catch (error) {
			rlog.error('tests', 'reading output failed', error);
		}
	}
}

/** Runs the tests under pdb in a terminal: breakpoints and post-mortem debugging on failure. */
export async function debugTests(ids: string[]): Promise<void> {
	if (!(await saveDirtyFiles())) return;
	try {
		const { command } = await call('tests:debugCommand', { ids });
		await runInTerminal({
			role: 'task:pytest',
			preset: 'powershell',
			title: 'pytest',
			command,
		});
	} catch (error) {
		toast.error('Could not debug the test', error instanceof Error ? error.message : undefined);
	}
}
