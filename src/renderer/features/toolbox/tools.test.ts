import { describe, expect, it } from 'vitest';

import {
	base58ToHex,
	compoundGrowth,
	convertBytes,
	convertTimestamp,
	convertUnits,
	decode,
	decodeJwt,
	encode,
	type EncodingKind,
	formatJson,
	hexToBase58,
	isJwtExpired,
	MAX_REGEX_MATCHES,
	positionSize,
	sha256Hex,
	testRegex,
	type UnitId,
	UNITS,
	validateRegexFlags,
} from './tools';

const T = 1_700_000_000;
const T_ISO = '2023-11-14T22:13:20.000Z';

describe('convertTimestamp', () => {
	it.each([
		['1700000000', 's'],
		['1700000000000', 'ms'],
		['1700000000000000', 'us'],
		['1700000000000000000', 'ns'],
	] as const)('detects %s as %s', (input, unit) => {
		const info = convertTimestamp(input, T * 1000);
		expect(info.detectedUnit).toBe(unit);
		expect(info.iso).toBe(T_ISO);
		expect(info.unixSeconds).toBe(T);
		expect(info.unixMs).toBe(T * 1000);
	});

	it('keeps millisecond precision from finer units', () => {
		expect(convertTimestamp('1700000000123456789').unixMs).toBe(1_700_000_000_123);
		expect(convertTimestamp('1700000000.5').iso).toBe('2023-11-14T22:13:20.500Z');
	});

	it('parses ISO and RFC date strings', () => {
		const iso = convertTimestamp(' 2024-01-01T00:00:00Z ');
		expect(iso.detectedUnit).toBe('date');
		expect(iso.unixSeconds).toBe(1_704_067_200);
		expect(convertTimestamp('Tue, 14 Nov 2023 22:13:20 GMT').unixSeconds).toBe(T);
		expect(convertTimestamp('2023-11-14 22:13:20Z').unixSeconds).toBe(T);
		expect(convertTimestamp('14 November 2023 22:13:20 UTC').unixSeconds).toBe(T);
		for (const date of ['2024-01', '2024-01-15', '2024/01/15', '01/15/2024', 'Jan 15, 2024']) {
			expect(convertTimestamp(date).detectedUnit).toBe('date');
		}
	});

	it('describes time relative to now', () => {
		const ms = T * 1000;
		expect(convertTimestamp(String(T), ms + 3 * 3_600_000 + 5_000).relative).toBe(
			'3 hours ago',
		);
		expect(convertTimestamp(String(T), ms - 2 * 86_400_000).relative).toBe('in 2 days');
		expect(convertTimestamp(String(T), ms + 400).relative).toBe('now');
		expect(convertTimestamp(String(T), ms - 45_000).relative).toBe('in 45 seconds');
	});

	it('returns a non-empty local rendering', () => {
		expect(convertTimestamp(String(T)).local).toMatch(/2023/);
	});

	it('rejects garbage and out-of-range input', () => {
		expect(() => convertTimestamp('')).toThrow(/Enter a unix timestamp/);
		expect(() => convertTimestamp('not a date')).toThrow(/Could not parse/);
		// V8's Date.parse reads each of these as a date; they must not get a 'date string' badge.
		for (const junk of ['hello 1', 'foo 12', 'abc 2024', 'x-1', 'nov']) {
			expect(() => convertTimestamp(junk)).toThrow(/Could not parse/);
		}
		expect(() => convertTimestamp('99999999999999999999999')).toThrow(/outside/);
	});
});

describe('convertUnits', () => {
	const asMap = (value: string, unit: UnitId): Record<string, string> =>
		Object.fromEntries(convertUnits(value, unit).map((u) => [u.unit, u.value]));

	it('converts ether exactly', () => {
		expect(asMap('1.5', 'eth')).toEqual({
			wei: '1500000000000000000',
			gwei: '1500000000',
			eth: '1.5',
		});
		expect(asMap('0.000000000000000001', 'eth').wei).toBe('1');
		expect(asMap('123456789123456789123456789', 'wei').eth).toBe(
			'123456789.123456789123456789',
		);
	});

	it('converts rates', () => {
		expect(asMap('25', 'bps')).toEqual({ bps: '25', pct: '0.25', decimal: '0.0025' });
		expect(asMap('-12.5', 'bps').pct).toBe('-0.125');
		expect(asMap('0.05', 'decimal').bps).toBe('500');
		expect(asMap('1,000', 'pct').bps).toBe('100000');
	});

	it('converts solana and bitcoin', () => {
		expect(asMap('1', 'sol').lamports).toBe('1000000000');
		expect(asMap('1', 'sats').btc).toBe('0.00000001');
		expect(asMap('21e6', 'btc').sats).toBe('2100000000000000');
	});

	it('normalises zeros', () => {
		expect(asMap('000.000', 'eth')).toEqual({ wei: '0', gwei: '0', eth: '0' });
		expect(asMap('-0', 'bps').pct).toBe('0');
		expect(asMap('100.00', 'pct').pct).toBe('100');
	});

	it('returns only the same family, with labels, for every unit', () => {
		for (const u of UNITS) {
			const out = convertUnits('1', u.id);
			expect(out.map((o) => o.unit)).toEqual(
				UNITS.filter((x) => x.family === u.family).map((x) => x.id),
			);
			expect(out.every((o) => o.label.length > 0)).toBe(true);
		}
	});

	it('rejects invalid numbers and units', () => {
		expect(() => convertUnits('abc', 'eth')).toThrow(/not a number/);
		expect(() => convertUnits('', 'eth')).toThrow(/not a number/);
		expect(() => convertUnits('.', 'eth')).toThrow(/not a number/);
		expect(() => convertUnits('1e999', 'eth')).toThrow(/Exponent/);
		expect(() => convertUnits('1', 'doge' as UnitId)).toThrow(/Unknown unit/);
	});
});

describe('encode / decode', () => {
	const text = 'héllo 🚀 world?&=';

	it.each(['base64', 'base64url', 'hex', 'base58', 'url'] as EncodingKind[])(
		'%s round-trips UTF-8',
		(kind) => {
			expect(decode(kind, encode(kind, text))).toBe(text);
			expect(decode(kind, encode(kind, ''))).toBe('');
		},
	);

	it('matches known encodings', () => {
		expect(encode('base64', 'hello')).toBe('aGVsbG8=');
		expect(encode('base64', '🚀')).toBe('8J+agA==');
		expect(encode('base64url', '🚀')).toBe('8J-agA');
		expect(encode('hex', 'é')).toBe('c3a9');
		expect(encode('base58', 'hello world')).toBe('StV1DL6CwTryKyV');
		expect(encode('url', 'a b&c')).toBe('a%20b%26c');
	});

	it('is lenient about padding, whitespace and 0x', () => {
		expect(decode('base64', 'aGVs\nbG8')).toBe('hello');
		expect(decode('base64url', '8J-agA==')).toBe('🚀');
		expect(decode('hex', '0x68 65 6c 6c 6f')).toBe('hello');
		expect(decode('url', 'a+b%20c')).toBe('a b c');
	});

	it('throws clear errors on invalid input', () => {
		expect(() => decode('base64', 'a$b=')).toThrow(/Invalid base64/);
		expect(() => decode('base64', 'abcde')).toThrow(/Invalid base64/);
		expect(() => decode('base64url', 'ab+/')).toThrow(/Invalid base64url/);
		expect(() => decode('hex', 'abc')).toThrow(/even number/);
		expect(() => decode('hex', 'zz')).toThrow(/non-hex/);
		expect(() => decode('base58', '0OIl')).toThrow(/Invalid base58 character/);
		expect(() => decode('url', '%E0%A4%A')).toThrow(/percent-encoding/);
		expect(() => decode('hex', 'ff')).toThrow(/not valid UTF-8/);
	});
});

describe('base58 bytes', () => {
	it('counts bytes from the decoded input, even with whitespace before 0x', () => {
		expect(convertBytes(' 0xabcd', 'base58').bytes).toBe(2);
		expect(convertBytes('0x ab cd', 'base58')).toEqual(convertBytes('abcd', 'base58'));
		expect(convertBytes('1'.repeat(32), 'hex')).toEqual({ text: '00'.repeat(32), bytes: 32 });
	});

	it('maps the Solana System Program address to 32 zero bytes', () => {
		const system = '1'.repeat(32);
		expect(base58ToHex(system)).toBe('00'.repeat(32));
		expect(hexToBase58('00'.repeat(32))).toBe(system);
	});

	it('round-trips a real Solana address', () => {
		const token = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
		const hex = base58ToHex(token);
		expect(hex).toBe('06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9');
		expect(hexToBase58(hex)).toBe(token);
	});

	it('preserves leading zero bytes', () => {
		expect(hexToBase58('0000ff')).toBe('115Q');
		expect(base58ToHex('115Q')).toBe('0000ff');
		expect(hexToBase58('')).toBe('');
	});
});

describe('decodeJwt', () => {
	const make = (payload: object): string =>
		[
			encode('base64url', JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
			encode('base64url', JSON.stringify(payload)),
			'signature',
		].join('.');

	it('decodes header and payload and reports expiry', () => {
		const token = make({ sub: 'marto', exp: T });
		const jwt = decodeJwt(token);
		expect(jwt.header).toEqual({ alg: 'HS256', typ: 'JWT' });
		expect(jwt.payload).toEqual({ sub: 'marto', exp: T });
		expect(jwt.expiresAt).toBe(T_ISO);
		expect(jwt.expMs).toBe(T * 1000);
	});

	it('re-checks expiry against the given clock', () => {
		const jwt = decodeJwt(make({ exp: T }));
		expect(isJwtExpired(jwt, T * 1000 - 1)).toBe(false);
		expect(isJwtExpired(jwt, T * 1000)).toBe(true);
		expect(isJwtExpired(jwt, T * 1000 + 1)).toBe(true);
		expect(isJwtExpired(decodeJwt(make({ sub: 'x' })), T * 1000)).toBeNull();
	});

	it('returns nulls without a numeric exp', () => {
		expect(decodeJwt(make({ sub: 'x' }))).toMatchObject({ expiresAt: null, expMs: null });
		expect(decodeJwt(make({ exp: 'soon' }))).toMatchObject({ expiresAt: null, expMs: null });
	});

	it('rejects malformed tokens', () => {
		expect(() => decodeJwt('a.b')).toThrow(/three dot-separated/);
		expect(() => decodeJwt('x.y.z')).toThrow(/header is not/);
		expect(() => decodeJwt(`${encode('base64url', '{}')}.@@.z`)).toThrow(/payload is not/);
	});
});

describe('formatJson', () => {
	it('pretty-prints with tabs', () => {
		expect(formatJson('{"b":1,"a":[1,2]}', 'pretty')).toBe(
			'{\n\t"b": 1,\n\t"a": [\n\t\t1,\n\t\t2\n\t]\n}',
		);
	});

	it('minifies', () => {
		expect(formatJson('{ "a" : [ 1 , 2 ] ,\n "b": null }', 'minify')).toBe(
			'{"a":[1,2],"b":null}',
		);
	});

	it('sorts keys recursively, leaving array order alone', () => {
		expect(formatJson('{"b":{"d":1,"c":2},"a":[{"z":1,"y":2}]}', 'sort')).toBe(
			'{\n\t"a": [\n\t\t{\n\t\t\t"y": 2,\n\t\t\t"z": 1\n\t\t}\n\t],\n\t"b": {\n\t\t"c": 2,\n\t\t"d": 1\n\t}\n}',
		);
	});

	it.runIf(typeof (JSON as unknown as { rawJSON?: unknown }).rawJSON === 'function')(
		'keeps big integers exact',
		() => {
			const text = '{"wei":1500000000000000000123,"n":-90071992547409931}';
			expect(formatJson(text, 'minify')).toBe(text);
			expect(formatJson(text, 'sort')).toContain('"wei": 1500000000000000000123');
		},
	);

	it('throws on invalid JSON', () => {
		expect(() => formatJson('{a:1}', 'pretty')).toThrow(/^Invalid JSON/);
	});
});

describe('validateRegexFlags', () => {
	it('accepts every valid flag combination new RegExp accepts', () => {
		for (const flags of ['', 'g', 'gimsuy', 'dgimsvy']) {
			expect(validateRegexFlags(flags)).toBeNull();
			expect(() => new RegExp('a', flags)).not.toThrow();
		}
	});

	it('rejects unknown, repeated and conflicting flags', () => {
		for (const flags of ['gx', 'gg', 'uv']) {
			expect(validateRegexFlags(flags)).not.toBeNull();
			expect(() => new RegExp('a', flags)).toThrow();
		}
		expect(validateRegexFlags('gx')).toContain("'x'");
		expect(validateRegexFlags('igi')).toContain("'i'");
	});
});

describe('testRegex', () => {
	it('returns matches with indices and groups', () => {
		const { matches, error } = testRegex('(\\d+)-(x)?', 'g', '12- 34-x');
		expect(error).toBeNull();
		expect(matches).toEqual([
			{ index: 0, match: '12-', groups: ['12', ''] },
			{ index: 4, match: '34-x', groups: ['34', 'x'] },
		]);
	});

	it('returns only the first match without g', () => {
		expect(testRegex('\\d', '', 'a1b2').matches).toEqual([
			{ index: 1, match: '1', groups: [] },
		]);
	});

	it('handles zero-length matches without looping', () => {
		expect(testRegex('', 'g', 'abc').matches.map((m) => m.index)).toEqual([0, 1, 2, 3]);
		expect(testRegex('a*', 'g', 'baaa').matches.map((m) => [m.index, m.match])).toEqual([
			[0, ''],
			[1, 'aaa'],
			[4, ''],
		]);
		expect(testRegex('', 'gu', '😀x').matches.map((m) => m.index)).toEqual([0, 2, 3]);
		expect(testRegex('\\b', 'g', 'hi there').matches).toHaveLength(4);
	});

	it('caps the number of matches', () => {
		expect(testRegex('.', 'g', 'a'.repeat(5000)).matches).toHaveLength(MAX_REGEX_MATCHES);
		expect(testRegex('', 'g', 'a'.repeat(5000)).matches).toHaveLength(MAX_REGEX_MATCHES);
	});

	it('reports invalid patterns and flags', () => {
		expect(testRegex('(', 'g', 'x').error).toMatch(/Invalid regular expression/);
		expect(testRegex('a', 'gq', 'x').error).not.toBeNull();
	});
});

describe('sha256Hex', () => {
	it('hashes known vectors', async () => {
		expect(await sha256Hex('')).toBe(
			'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		);
		expect(await sha256Hex('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
		);
	});
});

describe('positionSize', () => {
	it('sizes a long so the stop loses the risk amount', () => {
		expect(positionSize({ equity: 10_000, riskPct: 1, entry: 100, stop: 95 })).toEqual({
			units: 20,
			notional: 2000,
			riskAmount: 100,
			stopDistancePct: 5,
		});
	});

	it('handles shorts and contract sizes', () => {
		const fx = positionSize({
			equity: 10_000,
			riskPct: 1,
			entry: 1.1,
			stop: 1.105,
			contractSize: 100_000,
		});
		expect(fx.units).toBeCloseTo(0.2, 9);
		expect(fx.notional).toBeCloseTo(22_000, 6);
		expect(fx.stopDistancePct).toBeCloseTo(0.4545, 3);
	});

	it('validates input', () => {
		const base = { equity: 10_000, riskPct: 1, entry: 100, stop: 95 };
		expect(() => positionSize({ ...base, stop: 100 })).toThrow(/Stop must differ/);
		expect(() => positionSize({ ...base, equity: -1 })).toThrow(/Equity/);
		expect(() => positionSize({ ...base, riskPct: 0 })).toThrow(/Risk %/);
		expect(() => positionSize({ ...base, riskPct: 150 })).toThrow(/exceed 100/);
		expect(() => positionSize({ ...base, entry: Number.NaN })).toThrow(/Entry/);
		expect(() => positionSize({ ...base, contractSize: 0 })).toThrow(/Contract size/);
	});
});

describe('compoundGrowth', () => {
	it('compounds without contributions', () => {
		const r = compoundGrowth({ start: 1000, ratePct: 10, periods: 2 });
		expect(r.final).toBeCloseTo(1210, 9);
		expect(r.totalContributed).toBe(1000);
		expect(r.gain).toBeCloseTo(210, 9);
	});

	it('adds end-of-period contributions', () => {
		const r = compoundGrowth({ start: 1000, ratePct: 10, periods: 2, contribution: 100 });
		expect(r.final).toBeCloseTo(1420, 9);
		expect(r.totalContributed).toBe(1200);
		expect(r.gain).toBeCloseTo(220, 9);
	});

	it('handles zero and negative rates', () => {
		expect(
			compoundGrowth({ start: 1000, ratePct: 0, periods: 3, contribution: 100 }).final,
		).toBe(1300);
		expect(compoundGrowth({ start: 1000, ratePct: -50, periods: 1 }).final).toBe(500);
		expect(compoundGrowth({ start: 1000, ratePct: 10, periods: 0 }).final).toBe(1000);
	});

	it('validates input', () => {
		expect(() => compoundGrowth({ start: 1000, ratePct: 5, periods: 1.5 })).toThrow(/whole/);
		expect(() => compoundGrowth({ start: 1000, ratePct: -100, periods: 1 })).toThrow(/-100/);
		expect(() => compoundGrowth({ start: -1, ratePct: 5, periods: 1 })).toThrow(/Start/);
		expect(() =>
			compoundGrowth({ start: 1, ratePct: 5, periods: 1, contribution: -5 }),
		).toThrow(/Contribution/);
	});
});
