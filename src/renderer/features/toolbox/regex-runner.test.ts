import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	createRegexRunner,
	type RegexOutcome,
	type RegexRequest,
	type RegexResponse,
	type RegexWorkerLike,
} from './regex-runner';
import { testRegex } from './tools';

class FakeWorker implements RegexWorkerLike {
	onmessage: ((event: MessageEvent<RegexResponse>) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	posted: RegexRequest[] = [];
	terminated = false;

	postMessage(message: RegexRequest): void {
		this.posted.push(message);
	}

	terminate(): void {
		this.terminated = true;
	}

	/** Answers the last request the way regex.worker.ts would. */
	answer(): void {
		const req = this.posted.at(-1);
		if (!req) throw new Error('nothing posted');
		const data: RegexResponse = {
			id: req.id,
			result: testRegex(req.pattern, req.flags, req.text),
		};
		this.onmessage?.({ data } as MessageEvent<RegexResponse>);
	}
}

describe('createRegexRunner', () => {
	let workers: FakeWorker[];
	const factory = (): FakeWorker => {
		const w = new FakeWorker();
		workers.push(w);
		return w;
	};

	beforeEach(() => {
		workers = [];
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('reports the worker result and reuses the idle worker', () => {
		const runner = createRegexRunner(factory, 1000);
		const done = vi.fn<(o: RegexOutcome) => void>();
		runner.run({ pattern: '\\d+', flags: 'g', text: 'a1b22' }, done);
		workers[0]?.answer();
		expect(done).toHaveBeenCalledWith({
			kind: 'result',
			result: testRegex('\\d+', 'g', 'a1b22'),
		});
		runner.run({ pattern: 'b', flags: '', text: 'abc' }, done);
		expect(workers).toHaveLength(1);
		workers[0]?.answer();
		// An answered run's timeout is cleared, so it never reports a second time.
		vi.advanceTimersByTime(5000);
		expect(done).toHaveBeenCalledTimes(2);
		expect(done.mock.calls[1]?.[0].kind).toBe('result');
		expect(workers[0]?.terminated).toBe(false);
	});

	it('terminates a run that outlives the timeout and starts fresh next time', () => {
		const runner = createRegexRunner(factory, 1000);
		const done = vi.fn<(o: RegexOutcome) => void>();
		runner.run(
			{ pattern: '(a+)+$', flags: '', text: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab' },
			done,
		);
		vi.advanceTimersByTime(999);
		expect(done).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(done).toHaveBeenCalledWith({ kind: 'timeout' });
		expect(workers[0]?.terminated).toBe(true);

		runner.run({ pattern: 'a', flags: '', text: 'a' }, done);
		expect(workers).toHaveLength(2);
	});

	it('replaces a busy worker instead of queueing behind it', () => {
		const runner = createRegexRunner(factory, 1000);
		const first = vi.fn<(o: RegexOutcome) => void>();
		const second = vi.fn<(o: RegexOutcome) => void>();
		runner.run({ pattern: 'x', flags: '', text: 'x' }, first);
		runner.run({ pattern: 'y', flags: '', text: 'y' }, second);
		expect(workers[0]?.terminated).toBe(true);
		workers[1]?.answer();
		expect(second).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(5000);
		expect(first).not.toHaveBeenCalled();
	});

	it('cancel stops a pending run without reporting', () => {
		const runner = createRegexRunner(factory, 1000);
		const done = vi.fn<(o: RegexOutcome) => void>();
		const cancel = runner.run({ pattern: 'x', flags: '', text: 'x' }, done);
		cancel();
		vi.advanceTimersByTime(5000);
		expect(done).not.toHaveBeenCalled();
		expect(workers[0]?.terminated).toBe(true);
	});

	it('reports a worker crash', () => {
		const runner = createRegexRunner(factory, 1000);
		const done = vi.fn<(o: RegexOutcome) => void>();
		runner.run({ pattern: 'x', flags: '', text: 'x' }, done);
		workers[0]?.onerror?.({ message: 'boom' } as ErrorEvent);
		expect(done).toHaveBeenCalledWith({ kind: 'crashed', message: 'boom' });
		expect(workers[0]?.terminated).toBe(true);
	});
});
