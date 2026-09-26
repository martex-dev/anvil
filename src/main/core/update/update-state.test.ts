import { describe, expect, it } from 'vitest';

import { describeUpdateError, reduceUpdate } from './update-state';

describe('update state', () => {
	it('walks check → download → ready', () => {
		let s = reduceUpdate({ state: 'idle', lastChecked: null }, { type: 'checking' });
		s = reduceUpdate(s, { type: 'available', version: '0.2.0' });
		s = reduceUpdate(s, { type: 'progress', percent: 41.6 });
		expect(s).toEqual({ state: 'downloading', version: '0.2.0', percent: 42 });
		s = reduceUpdate(s, { type: 'downloaded', version: '0.2.0' });
		expect(s).toEqual({ state: 'ready', version: '0.2.0' });
	});

	it('keeps a downloaded update ready through later checks and errors', () => {
		const ready = { state: 'ready', version: '0.2.0' } as const;
		expect(reduceUpdate(ready, { type: 'checking' })).toBe(ready);
		expect(reduceUpdate(ready, { type: 'error', message: 'x', at: 1 })).toBe(ready);
	});

	it('records when nothing new was found', () => {
		expect(reduceUpdate({ state: 'checking' }, { type: 'not-available', at: 5 })).toEqual({
			state: 'idle',
			lastChecked: 5,
		});
	});

	it('turns noisy errors into one line', () => {
		expect(describeUpdateError(new Error('HttpError: 404 \n"method: GET'))).toBe(
			'No release published yet',
		);
		expect(describeUpdateError(new Error('net::ERR_INTERNET_DISCONNECTED'))).toBe(
			'Offline: will retry later',
		);
		expect(describeUpdateError('weird\nstack')).toBe('weird');
	});
});
