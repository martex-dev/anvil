import { base64UrlToBytes, bytesToHex, utf8Decode, utf8Encode } from './encoding';

export {
	base58ToHex,
	convertBytes,
	decode,
	encode,
	type EncodingKind,
	hexToBase58,
} from './encoding';
export { convertTimestamp, type TimestampInfo, type TimestampUnit } from './time';
export {
	convertUnits,
	type UnitFamily,
	type UnitId,
	type UnitInfo,
	UNITS,
	type UnitValue,
} from './units';

export interface DecodedJwt {
	header: unknown;
	payload: unknown;
	expiresAt: string | null;
	/** The exp claim in epoch ms, or null without a numeric exp. */
	expMs: number | null;
}

/**
 * Whether the token has expired at `now`, or null without an exp claim. Kept separate from
 * decoding so the view can re-check against a ticking clock instead of the decode-time one.
 */
export function isJwtExpired(jwt: DecodedJwt, now: number): boolean | null {
	return jwt.expMs === null ? null : jwt.expMs <= now;
}

function decodeJwtPart(part: string, name: string): unknown {
	try {
		return JSON.parse(utf8Decode(base64UrlToBytes(part)));
	} catch {
		throw new Error(`Invalid JWT: ${name} is not base64url-encoded JSON`);
	}
}

/**
 * Decodes a JWT's header and payload for inspection. The signature is NOT verified, so nothing
 * read here can be trusted as authentic.
 */
export function decodeJwt(token: string): DecodedJwt {
	const parts = token.trim().split('.');
	if (parts.length !== 3) throw new Error('Invalid JWT: expected three dot-separated parts');
	const [headerPart = '', payloadPart = ''] = parts;
	const header = decodeJwtPart(headerPart, 'header');
	const payload = decodeJwtPart(payloadPart, 'payload');
	const exp =
		typeof payload === 'object' && payload !== null && 'exp' in payload
			? payload.exp
			: undefined;
	if (typeof exp !== 'number' || !Number.isFinite(exp)) {
		return { header, payload, expiresAt: null, expMs: null };
	}
	const expMs = exp * 1000;
	const expiresAt = Math.abs(expMs) <= 8.64e15 ? new Date(expMs).toISOString() : null;
	return { header, payload, expiresAt, expMs };
}

export type JsonFormatMode = 'pretty' | 'minify' | 'sort';

interface RawJsonApi {
	rawJSON?: (text: string) => unknown;
	isRawJSON?: (value: unknown) => boolean;
}

// JSON.rawJSON (Chromium 114+, Node 21+) lets big integers such as wei amounts or order ids
// survive a parse/stringify round trip instead of being rounded to the nearest double.
const rawJsonApi = JSON as unknown as RawJsonApi;

function parseJsonLossless(text: string): unknown {
	const { rawJSON } = rawJsonApi;
	try {
		if (!rawJSON) return JSON.parse(text);
		return JSON.parse(text, (_key, value: unknown, context?: { source?: string }) => {
			const source = context?.source;
			if (
				typeof value === 'number' &&
				source !== undefined &&
				/^-?\d+$/.test(source) &&
				!Number.isSafeInteger(value)
			) {
				return rawJSON(source);
			}
			return value;
		});
	} catch (err) {
		throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
	}
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (typeof value !== 'object' || value === null || rawJsonApi.isRawJSON?.(value)) return value;
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(value).sort()) {
		sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
	}
	return sorted;
}

/** 'pretty' indents with tabs; 'sort' recursively sorts object keys and pretty-prints. */
export function formatJson(text: string, mode: JsonFormatMode): string {
	const value = parseJsonLossless(text);
	switch (mode) {
		case 'pretty':
			return JSON.stringify(value, null, '\t');
		case 'minify':
			return JSON.stringify(value);
		case 'sort':
			return JSON.stringify(sortKeys(value), null, '\t');
	}
}

export interface RegexMatch {
	index: number;
	match: string;
	groups: string[];
}

export interface RegexResult {
	matches: RegexMatch[];
	error: string | null;
}

export const MAX_REGEX_MATCHES = 1000;

/**
 * Follows exec() semantics: without the g or y flag only the first match is returned.
 * Unmatched capture groups are reported as ''.
 */
export function testRegex(pattern: string, flags: string, text: string): RegexResult {
	let re: RegExp;
	try {
		re = new RegExp(pattern, flags);
	} catch (err) {
		return { matches: [], error: err instanceof Error ? err.message : String(err) };
	}
	const repeat = re.global || re.sticky;
	const unicode = re.unicode || re.flags.includes('v');
	const matches: RegexMatch[] = [];
	while (matches.length < MAX_REGEX_MATCHES) {
		const m = re.exec(text);
		if (!m) break;
		matches.push({ index: m.index, match: m[0], groups: m.slice(1).map((g) => g ?? '') });
		if (!repeat) break;
		// A zero-length match leaves lastIndex in place; step past it or exec() loops forever.
		if (m[0] === '') {
			const code = text.codePointAt(re.lastIndex);
			re.lastIndex += unicode && code !== undefined && code > 0xffff ? 2 : 1;
			if (re.lastIndex > text.length) break;
		}
	}
	return { matches, error: null };
}

export async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', utf8Encode(text));
	return bytesToHex(new Uint8Array(digest));
}

function requirePositive(name: string, value: number): void {
	if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
}

export interface PositionSizeInput {
	equity: number;
	/** Percent of equity to lose if the stop is hit (1 = 1%). */
	riskPct: number;
	entry: number;
	stop: number;
	/** Quantity of the underlying per unit, e.g. 100000 for a standard FX lot. */
	contractSize?: number;
}

export interface PositionSizeResult {
	units: number;
	notional: number;
	riskAmount: number;
	stopDistancePct: number;
}

export function positionSize(input: PositionSizeInput): PositionSizeResult {
	const { equity, riskPct, entry, stop, contractSize = 1 } = input;
	requirePositive('Equity', equity);
	requirePositive('Risk %', riskPct);
	requirePositive('Entry price', entry);
	requirePositive('Stop price', stop);
	requirePositive('Contract size', contractSize);
	if (riskPct > 100) throw new Error('Risk % cannot exceed 100');
	if (stop === entry) throw new Error('Stop must differ from entry');
	const riskAmount = (equity * riskPct) / 100;
	const stopDistance = Math.abs(entry - stop);
	const units = riskAmount / (stopDistance * contractSize);
	return {
		units,
		notional: units * contractSize * entry,
		riskAmount,
		stopDistancePct: (stopDistance / entry) * 100,
	};
}

export interface CompoundGrowthInput {
	start: number;
	/** Growth per period in percent (5 = 5%). */
	ratePct: number;
	periods: number;
	/** Added at the end of every period. */
	contribution?: number;
}

export interface CompoundGrowthResult {
	final: number;
	totalContributed: number;
	gain: number;
}

export function compoundGrowth(input: CompoundGrowthInput): CompoundGrowthResult {
	const { start, ratePct, periods, contribution = 0 } = input;
	if (!Number.isFinite(start) || start < 0) throw new Error('Start must be zero or positive');
	if (!Number.isFinite(ratePct) || ratePct <= -100) {
		throw new Error('Rate % must be a number above -100');
	}
	if (!Number.isInteger(periods) || periods < 0) {
		throw new Error('Periods must be a whole number, zero or more');
	}
	if (!Number.isFinite(contribution) || contribution < 0) {
		throw new Error('Contribution must be zero or positive');
	}
	const r = ratePct / 100;
	const growth = (1 + r) ** periods;
	const contributions = r === 0 ? contribution * periods : (contribution * (growth - 1)) / r;
	const final = start * growth + contributions;
	const totalContributed = start + contribution * periods;
	return { final, totalContributed, gain: final - totalContributed };
}
