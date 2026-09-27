import type { TestOutcome, TestResult, TestRunEvent } from '@shared/ipc/channels/tests';

/** Console output kept per run; the head of a huge log goes first (the end has the summary). */
export const OUTPUT_LIMIT = 2_000_000;

export interface RunEnd {
	exitCode: number | null;
	cancelled: boolean;
	error: string | null;
}

export interface TestRunState {
	/** The run events are accepted from; older runs' late events are dropped. */
	runId: number | null;
	running: boolean;
	/** Tests of the current run that haven't reported yet. */
	queued: Readonly<Record<string, true>>;
	/** The test pytest is executing right now. */
	current: string | null;
	/** Last known result of every test; a new run replaces results as they arrive. */
	results: Readonly<Record<string, TestResult>>;
	/** Tests that reported in the current run (a teardown error merges into their result). */
	fresh: Readonly<Record<string, true>>;
	output: string;
	end: RunEnd | null;
}

export const initialRunState: TestRunState = {
	runId: null,
	running: false,
	queued: {},
	current: null,
	results: {},
	fresh: {},
	output: '',
	end: null,
};

const SEVERITY: Record<TestOutcome, number> = { passed: 0, skipped: 1, failed: 2, error: 3 };

/**
 * pytest reports setup, call and teardown separately, so one test can report twice (a test that
 * passed and then broke in teardown). The worse outcome wins and the durations add up.
 */
export function mergeResult(before: TestResult, after: TestResult): TestResult {
	const worse = SEVERITY[after.outcome] >= SEVERITY[before.outcome] ? after : before;
	return { ...worse, duration: before.duration + after.duration };
}

export function reduceRun(state: TestRunState, event: TestRunEvent): TestRunState {
	if (event.type === 'started') {
		if (state.runId !== null && event.runId < state.runId) return state;
		const queued: Record<string, true> = {};
		for (const id of event.ids) queued[id] = true;
		return {
			...state,
			runId: event.runId,
			running: true,
			queued,
			current: null,
			fresh: {},
			output: '',
			end: null,
		};
	}
	if (event.runId !== state.runId) return state;
	switch (event.type) {
		case 'running':
			return { ...state, current: event.id };
		case 'result': {
			const { id } = event.result;
			const before = state.fresh[id] ? state.results[id] : undefined;
			const { [id]: _done, ...queued } = state.queued;
			return {
				...state,
				queued,
				current: state.current === id ? null : state.current,
				results: {
					...state.results,
					[id]: before ? mergeResult(before, event.result) : event.result,
				},
				fresh: { ...state.fresh, [id]: true },
			};
		}
		case 'output': {
			const output = state.output + event.text;
			return {
				...state,
				output: output.length > OUTPUT_LIMIT ? output.slice(-OUTPUT_LIMIT) : output,
			};
		}
		case 'finished':
			return {
				...state,
				running: false,
				queued: {},
				current: null,
				end: { exitCode: event.exitCode, cancelled: event.cancelled, error: event.error },
			};
	}
}

export interface TestCounts {
	passed: number;
	failed: number;
	skipped: number;
	/** Tests with no result yet (never run, or discovered since). */
	notRun: number;
	total: number;
}

/** Counts over the given test ids (failed includes errors). */
export function countResults(
	ids: readonly string[],
	results: Readonly<Record<string, TestResult>>,
): TestCounts {
	const counts: TestCounts = { passed: 0, failed: 0, skipped: 0, notRun: 0, total: ids.length };
	for (const id of ids) {
		const outcome = results[id]?.outcome;
		if (outcome === 'passed') counts.passed++;
		else if (outcome === 'failed' || outcome === 'error') counts.failed++;
		else if (outcome === 'skipped') counts.skipped++;
		else counts.notRun++;
	}
	return counts;
}

/** Ids whose last result is a failure or error, for Run Failed. */
export function failedIds(results: Readonly<Record<string, TestResult>>): string[] {
	return Object.values(results)
		.filter((r) => r.outcome === 'failed' || r.outcome === 'error')
		.map((r) => r.id);
}
