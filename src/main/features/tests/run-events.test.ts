import { describe, expect, it } from 'vitest';

import type { ReporterRecord } from './reporter';
import { lastLine, runError, RunTranslator } from './run-events';

function result(
	nodeid: string,
	outcome: 'passed' | 'failed' | 'skipped' | 'error',
	when: 'setup' | 'call' | 'teardown',
	duration: number,
): ReporterRecord {
	return {
		t: 'result',
		nodeid,
		outcome,
		when,
		duration,
		message: outcome === 'failed' ? 'assert 1 == 2' : null,
		longrepr: outcome === 'failed' ? 't.py:3: AssertionError' : null,
		crash: outcome === 'failed' ? { path: 'C:\\p\\t.py', line: 3 } : null,
	};
}

describe('RunTranslator', () => {
	it('queues what pytest collected once collection is done', () => {
		const t = new RunTranslator(7);
		expect(t.translate({ t: 'item', nodeid: 'a', file: 'f', line: 1, classes: [] })).toEqual(
			[],
		);
		expect(t.translate({ t: 'item', nodeid: 'b', file: 'f', line: 2, classes: [] })).toEqual(
			[],
		);
		expect(t.translate({ t: 'collected', count: 2 })).toEqual([
			{ type: 'queued', runId: 7, ids: ['a', 'b'] },
		]);
	});

	it('adds setup time to the result and maps the failure fields', () => {
		const t = new RunTranslator(1);
		expect(t.translate({ t: 'start', nodeid: 'a' })).toEqual([
			{ type: 'running', runId: 1, id: 'a' },
		]);
		t.translate({ t: 'phase', nodeid: 'a', duration: 0.25 });
		const [event] = t.translate(result('a', 'failed', 'call', 0.5));
		expect(event).toEqual({
			type: 'result',
			runId: 1,
			result: {
				id: 'a',
				outcome: 'failed',
				duration: 0.75,
				message: 'assert 1 == 2',
				traceback: 't.py:3: AssertionError',
				crash: { path: 'C:\\p\\t.py', line: 3 },
			},
		});
	});

	it('reports collection errors and remembers the exit status', () => {
		const t = new RunTranslator(2);
		expect(t.sawRecord).toBe(false);
		expect(t.translate({ t: 'collecterror', nodeid: 'x.py', message: 'ImportError' })).toEqual([
			{ type: 'collectError', runId: 2, id: 'x.py', message: 'ImportError' },
		]);
		t.translate({ t: 'done', exitstatus: 1 });
		expect(t.exitStatus).toBe(1);
		expect(t.sawRecord).toBe(true);
	});
});

describe('runError', () => {
	const base = { exitCode: 1, cancelled: false, sawRecord: true, output: '', python: 'py' };

	it('treats failing tests and collection errors as results, not errors', () => {
		expect(runError(base)).toBeNull();
		expect(runError({ ...base, exitCode: 2 })).toBeNull();
		expect(runError({ ...base, exitCode: 5 })).toBeNull();
	});

	it('names a missing pytest and the interpreter it is missing from', () => {
		expect(
			runError({
				...base,
				sawRecord: false,
				output: 'No module named pytest\n',
				python: 'C:\\py.exe',
			}),
		).toBe("pytest isn't installed in C:\\py.exe. Install it into that environment.");
	});

	it('explains usage and internal errors with the last line pytest printed', () => {
		expect(
			runError({ ...base, exitCode: 4, output: 'ERROR: unrecognized arguments: -x\n\n' }),
		).toBe(
			'pytest rejected its command line or configuration: ERROR: unrecognized arguments: -x',
		);
	});

	it('flags a run that never reached the plugin', () => {
		expect(runError({ ...base, exitCode: 1, sawRecord: false, output: 'boom' })).toBe(
			'pytest did not run: boom',
		);
	});

	it('is quiet about a cancelled run', () => {
		expect(runError({ ...base, cancelled: true, exitCode: null, sawRecord: false })).toBeNull();
	});
});

describe('lastLine', () => {
	it('returns the last non-empty line', () => {
		expect(lastLine('a\r\nb\n\n  ')).toBe('b');
		expect(lastLine('')).toBeNull();
	});
});
