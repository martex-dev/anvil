import { EventEmitter } from 'node:events';
import type { FSWatcher } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalEnvWatcher } from './venv-watch';

let resolved: string | null;
let emitName: (name: string | null) => void;
const onChange = vi.fn();
const onError = vi.fn();

function makeWatcher(): LocalEnvWatcher {
	return new LocalEnvWatcher({
		resolve: () => resolved,
		onChange,
		onError,
		pollMs: 100,
		maxPolls: 5,
		watchDir: (_root, listener) => {
			emitName = listener;
			const fake = new EventEmitter() as EventEmitter & { close: () => void };
			fake.close = vi.fn();
			return fake as unknown as FSWatcher;
		},
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	resolved = '/usr/bin/python3';
	onChange.mockReset();
	onError.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('LocalEnvWatcher', () => {
	it('reports a venv whose interpreter appears after the folder', () => {
		const w = makeWatcher();
		w.start('/p');
		emitName('.venv');
		vi.advanceTimersByTime(200);
		expect(onChange).not.toHaveBeenCalled();
		resolved = '/p/.venv/bin/python3';
		vi.advanceTimersByTime(100);
		expect(onChange).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(1000);
		expect(onChange).toHaveBeenCalledTimes(1);
		w.stop();
	});

	it('ignores unrelated names and gives up after maxPolls', () => {
		const w = makeWatcher();
		w.start('/p');
		emitName('main.py');
		resolved = '/p/.venv/bin/python3';
		vi.advanceTimersByTime(1000);
		expect(onChange).not.toHaveBeenCalled();
		resolved = '/usr/bin/python3';
		emitName('venv');
		vi.advanceTimersByTime(500);
		resolved = '/p/venv/bin/python3';
		vi.advanceTimersByTime(1000);
		expect(onChange).not.toHaveBeenCalled();
		w.stop();
	});

	it('does not re-report a change already announced another way', () => {
		const w = makeWatcher();
		w.start('/p');
		resolved = '/picked/python';
		w.sync();
		emitName('.venv');
		vi.advanceTimersByTime(1000);
		expect(onChange).not.toHaveBeenCalled();
		w.stop();
	});

	it('does nothing without a folder', () => {
		const w = makeWatcher();
		w.start(null);
		w.poke();
		resolved = 'x';
		vi.advanceTimersByTime(1000);
		expect(onChange).not.toHaveBeenCalled();
	});
});
