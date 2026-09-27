export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

/** Runs a tool function and turns a thrown Error into a message the view can show inline. */
export function attempt<T>(fn: () => T): Outcome<T> {
	try {
		return { ok: true, value: fn() };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

const THOUSANDS = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/;
const EU_THOUSANDS = /^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/;
const DECIMAL_COMMA = /^[+-]?\d*,\d+$/;
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/** Rewrites a comma-bearing number as a plain decimal, or null when it is malformed. */
function normalizeCommas(text: string): string | null {
	const lastComma = text.lastIndexOf(',');
	const lastDot = text.lastIndexOf('.');
	// "10,000.5": comma thousands, dot decimal.
	if (lastDot > lastComma) return THOUSANDS.test(text) ? text.replace(/,/g, '') : null;
	// "1.234,5": dot thousands, comma decimal (most of Europe).
	if (lastDot >= 0) {
		return EU_THOUSANDS.test(text) ? text.replace(/\./g, '').replace(',', '.') : null;
	}
	// "10,000" reads as thousands; a leading zero ("0,500") can't be, so it is a decimal.
	if (THOUSANDS.test(text) && !/^[+-]?0/.test(text)) return text.replace(/,/g, '');
	// "1,5", "0,25": a decimal comma, which would otherwise be 15 and 25.
	return DECIMAL_COMMA.test(text) ? text.replace(',', '.') : null;
}

/**
 * Numeric parse for form fields: separators people paste ("10,000", "1_000", "10 000") are
 * ignored, and a decimal comma ("1,5", "1.234,5") is read as one, never as a number ten times
 * bigger. The one ambiguous form, a single comma before exactly three digits ("1,500"), reads
 * as thousands. Anything else Number() accepts that isn't a plain decimal ("0x10", "Infinity")
 * is NaN. Returns null for a blank field so callers can tell "not filled in" from "invalid".
 */
export function parseNumber(text: string): number | null {
	let clean = text.trim().replace(/[\s_]/g, '');
	if (!clean) return null;
	if (clean.includes(',')) {
		const normalized = normalizeCommas(clean);
		if (normalized === null) return NaN;
		clean = normalized;
	}
	return DECIMAL.test(clean) ? Number(clean) : NaN;
}

/**
 * Copy-friendly number: no grouping, at most `maxFraction` decimals, trailing zeros trimmed.
 * A non-zero value too small for that many decimals keeps 6 significant digits instead, so a
 * tiny position size never reads as "0".
 */
export function formatPlain(n: number, maxFraction = 8): string {
	if (!Number.isFinite(n)) return String(n);
	const text = n.toLocaleString('en-US', {
		useGrouping: false,
		maximumFractionDigits: maxFraction,
	});
	if (n === 0 || Number(text) !== 0) return text;
	return n.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 6 });
}

/** Human-friendly number with thousands separators. */
export function formatGrouped(n: number, maxFraction = 2): string {
	if (!Number.isFinite(n)) return String(n);
	return n.toLocaleString('en-US', { maximumFractionDigits: maxFraction });
}
