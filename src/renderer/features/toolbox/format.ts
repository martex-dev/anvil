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
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/**
 * Numeric parse for form fields: separators people paste ("10,000", "1_000", "10 000") are
 * ignored. A comma anywhere else (a decimal comma like "0,5") is NaN rather than silently read
 * as 5, and so is anything Number() accepts that isn't a plain decimal ("0x10", "Infinity").
 * Returns null for a blank field so callers can tell "not filled in" from "invalid".
 */
export function parseNumber(text: string): number | null {
	let clean = text.trim().replace(/[\s_]/g, '');
	if (!clean) return null;
	if (clean.includes(',')) {
		if (!THOUSANDS.test(clean)) return NaN;
		clean = clean.replace(/,/g, '');
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
