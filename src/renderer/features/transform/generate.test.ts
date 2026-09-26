import { describe, expect, it } from 'vitest';

import { isoNow, loremIpsum, nanoid, randomHex, unixMillis, unixSeconds, uuid } from './generate';

describe('uuid', () => {
	it('returns distinct v4 UUIDs', () => {
		const a = uuid();
		expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(uuid()).not.toBe(a);
	});
});

describe('nanoid', () => {
	it('defaults to 21 URL-safe characters', () => {
		const id = nanoid();
		expect(id).toHaveLength(21);
		expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it('honours the size and rejects bad sizes', () => {
		expect(nanoid(8)).toHaveLength(8);
		expect(() => nanoid(0)).toThrow('positive integer');
	});

	it('uses the whole alphabet', () => {
		const seen = new Set(nanoid(4096));
		expect(seen.size).toBe(64);
	});
});

describe('timestamps', () => {
	const now = 1_700_000_000_999;

	it('formats ISO, seconds and millis', () => {
		expect(isoNow(0)).toBe('1970-01-01T00:00:00.000Z');
		expect(isoNow(now)).toBe('2023-11-14T22:13:20.999Z');
		expect(unixSeconds(now)).toBe('1700000000');
		expect(unixMillis(now)).toBe('1700000000999');
	});

	it('defaults to the current time', () => {
		const seconds = Number(unixSeconds());
		expect(Math.abs(seconds - Date.now() / 1000)).toBeLessThan(5);
	});
});

describe('randomHex', () => {
	it('returns two hex chars per byte', () => {
		expect(randomHex()).toMatch(/^[0-9a-f]{64}$/);
		expect(randomHex(4)).toMatch(/^[0-9a-f]{8}$/);
		expect(randomHex()).not.toBe(randomHex());
	});

	it('rejects bad sizes', () => {
		expect(() => randomHex(0)).toThrow();
		expect(() => randomHex(1.5)).toThrow();
	});
});

describe('loremIpsum', () => {
	it('returns the requested word count, as a sentence', () => {
		const text = loremIpsum();
		expect(text.split(' ')).toHaveLength(30);
		expect(text.startsWith('Lorem ipsum dolor sit amet')).toBe(true);
		expect(text.endsWith('.')).toBe(true);
		expect(text.endsWith(',.')).toBe(false);
	});

	it('repeats the passage for long counts', () => {
		expect(loremIpsum(200).split(' ')).toHaveLength(200);
		expect(loremIpsum(1)).toBe('Lorem.');
	});
});
