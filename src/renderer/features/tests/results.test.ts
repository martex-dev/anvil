import { describe, expect, it } from 'vitest';

import type { TestResult, TestRunEvent } from '@shared/ipc/channels/tests';

import {
	countResults,
	failedIds,
	formatDuration,
	initialRunState,
	mergeResult,
	OUTPUT_LIMIT,
	reduceRun,
	type TestRunState,
} from './results';

function result(id: string, outcome: TestResult['outcome'], duration = 0.1): TestResult {
	return { id, outcome, duration, message: null, traceback: null, crash: null };
}

function play(events: TestRunEvent[], state: TestRunState = initialRunState): TestRunState {
	return events.reduce(reduceRun, state);
}

describe('reduceRun', () => {
	it('queues the run, tracks the running test and records results', () => {
		let state = play([
			{ type: 'started', runId: 1, ids: ['a', 'b'] },
			{ type: 'running', runId: 1, id: 'a' },
		]);
		expect(state.running).toBe(true);
		expect(state.queued).toEqual({ a: true, b: true });
		expect(state.current).toBe('a');

		state = play([{ type: 'result', runId: 1, result: result('a', 'passed') }], state);
		expect(state.queued).toEqual({ b: true });
		expect(state.current).toBeNull();
		expect(state.results['a']?.outcome).toBe('passed');

		state = play(
			[{ type: 'finished', runId: 1, exitCode: 0, cancelled: false, error: null }],
			state,
		);
		expect(state.running).toBe(false);
		expect(state.queued).toEqual({});
		expect(state.end).toEqual({ exitCode: 0, cancelled: false, error: null });
	});

	it('merges a teardown error into the result of the same run', () => {
		const state = play([
			{ type: 'started', runId: 1, ids: ['a'] },
			{ type: 'result', runId: 1, result: result('a', 'passed', 0.2) },
			{ type: 'result', runId: 1, result: result('a', 'error', 0.3) },
		]);
		expect(state.results['a']?.outcome).toBe('error');
		expect(state.results['a']?.duration).toBeCloseTo(0.5);
	});

	it('replaces the previous run result instead of merging with it', () => {
		const state = play([
			{ type: 'started', runId: 1, ids: ['a'] },
			{ type: 'result', runId: 1, result: result('a', 'failed') },
			{ type: 'finished', runId: 1, exitCode: 1, cancelled: false, error: null },
			{ type: 'started', runId: 2, ids: ['a'] },
			{ type: 'result', runId: 2, result: result('a', 'passed') },
		]);
		expect(state.results['a']?.outcome).toBe('passed');
	});

	it('keeps results of tests the new run does not touch', () => {
		const state = play([
			{ type: 'started', runId: 1, ids: ['a', 'b'] },
			{ type: 'result', runId: 1, result: result('a', 'failed') },
			{ type: 'result', runId: 1, result: result('b', 'passed') },
			{ type: 'started', runId: 2, ids: ['a'] },
		]);
		expect(state.results['b']?.outcome).toBe('passed');
		expect(state.queued).toEqual({ a: true });
	});

	it('ignores late events from an older run', () => {
		const state = play([
			{ type: 'started', runId: 2, ids: ['a'] },
			{ type: 'result', runId: 1, result: result('a', 'failed') },
			{ type: 'started', runId: 1, ids: ['z'] },
		]);
		expect(state.runId).toBe(2);
		expect(state.results['a']).toBeUndefined();
		expect(state.queued).toEqual({ a: true });
	});

	it('collects output and resets it per run, keeping the tail when it gets huge', () => {
		let state = play([
			{ type: 'started', runId: 1, ids: [] },
			{ type: 'output', runId: 1, text: 'x'.repeat(OUTPUT_LIMIT) },
			{ type: 'output', runId: 1, text: 'END' },
		]);
		expect(state.output).toHaveLength(OUTPUT_LIMIT);
		expect(state.output.endsWith('END')).toBe(true);
		state = play([{ type: 'started', runId: 2, ids: [] }], state);
		expect(state.output).toBe('');
	});
});

describe('mergeResult', () => {
	it('keeps the worse outcome and adds durations', () => {
		expect(mergeResult(result('a', 'failed', 1), result('a', 'passed', 2))).toMatchObject({
			outcome: 'failed',
			duration: 3,
		});
	});
});

describe('countResults / failedIds', () => {
	const results = {
		a: result('a', 'passed'),
		b: result('b', 'failed'),
		c: result('c', 'error'),
		d: result('d', 'skipped'),
	};

	it('counts errors as failures and missing results as not run', () => {
		expect(countResults(['a', 'b', 'c', 'd', 'e'], results)).toEqual({
			passed: 1,
			failed: 2,
			skipped: 1,
			notRun: 1,
			total: 5,
		});
	});

	it('lists failed and errored tests', () => {
		expect(failedIds(results).sort()).toEqual(['b', 'c']);
	});
});

describe('formatDuration', () => {
	it('picks a unit by size', () => {
		expect(formatDuration(0.0002)).toBe('<1 ms');
		expect(formatDuration(0.042)).toBe('42 ms');
		expect(formatDuration(1.254)).toBe('1.25 s');
		expect(formatDuration(125)).toBe('2m 05s');
	});
});
