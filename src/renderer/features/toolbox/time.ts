export type TimestampUnit = 's' | 'ms' | 'us' | 'ns' | 'date';

export interface TimestampInfo {
	unixSeconds: number;
	unixMs: number;
	/** UTC, millisecond precision. */
	iso: string;
	local: string;
	relative: string;
	detectedUnit: TimestampUnit;
}

// JS Dates cover +-8.64e15 ms around the epoch.
const MAX_DATE_MS = 8.64e15;

function toMs(n: number, unit: Exclude<TimestampUnit, 'date'>): number {
	// Multiply/divide by exact integers: scaling by 1e-3 can land just below a whole millisecond.
	switch (unit) {
		case 's':
			return n * 1000;
		case 'ms':
			return n;
		case 'us':
			return n / 1e3;
		case 'ns':
			return n / 1e6;
	}
}

/**
 * Magnitude thresholds sit between unit ranges: 1e11 seconds is year 5138 while 1e11 ms is only
 * 1973, so any realistic timestamp lands unambiguously in one band.
 */
function detectUnit(abs: number): Exclude<TimestampUnit, 'date'> {
	if (abs < 1e11) return 's';
	if (abs < 1e14) return 'ms';
	if (abs < 1e17) return 'us';
	return 'ns';
}

const RELATIVE_STEPS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
	['year', 365.25 * 86_400_000],
	['month', 30.44 * 86_400_000],
	['week', 7 * 86_400_000],
	['day', 86_400_000],
	['hour', 3_600_000],
	['minute', 60_000],
	['second', 1_000],
];

export function formatRelative(ms: number, now: number): string {
	const diff = ms - now;
	const abs = Math.abs(diff);
	if (abs < 1_000) return 'now';
	const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
	for (const [unit, size] of RELATIVE_STEPS) {
		if (abs >= size) return rtf.format(Math.sign(diff) * Math.floor(abs / size), unit);
	}
	return 'now';
}

function formatLocal(ms: number): string {
	return new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
		timeZoneName: 'short',
	}).format(ms);
}

/**
 * Accepts unix seconds/ms/us/ns (unit auto-detected by magnitude) or an ISO-8601/RFC date string.
 * Date strings without a zone are read in local time, as Date.parse does.
 */
export function convertTimestamp(input: string, now: number = Date.now()): TimestampInfo {
	const text = input.trim();
	if (!text) throw new Error('Enter a unix timestamp or a date');
	let ms: number;
	let detectedUnit: TimestampUnit;
	if (/^[+-]?\d+(\.\d+)?$/.test(text)) {
		const n = Number(text);
		detectedUnit = detectUnit(Math.abs(n));
		ms = toMs(n, detectedUnit);
	} else {
		ms = Date.parse(text);
		detectedUnit = 'date';
		if (Number.isNaN(ms)) throw new Error(`Could not parse '${text}' as a date`);
	}
	ms = Math.floor(ms);
	if (!Number.isFinite(ms) || Math.abs(ms) > MAX_DATE_MS) {
		throw new Error('Timestamp is outside the supported date range');
	}
	return {
		unixSeconds: Math.floor(ms / 1000),
		unixMs: ms,
		iso: new Date(ms).toISOString(),
		local: formatLocal(ms),
		relative: formatRelative(ms, now),
		detectedUnit,
	};
}
