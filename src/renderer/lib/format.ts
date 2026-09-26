const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';

/**
 * Prices from $70,000 down to $0.00000001234. Tiny memecoin prices use DexScreener's
 * zero-count notation: 0.0₆1234 means 0.0000001234 (six zeros after the "0.0").
 */
export function formatPrice(value: number | null | undefined): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	const abs = Math.abs(value);
	const sign = value < 0 ? '-' : '';
	if (abs === 0) return '0';
	if (abs >= 1000) return sign + abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
	if (abs >= 1) return sign + abs.toFixed(abs >= 100 ? 2 : 4).replace(/\.?0+$/, '');
	if (abs >= 0.001) return sign + abs.toPrecision(4).replace(/0+$/, '');
	// e.g. 1.234e-7 → mantissa digits "1234", exponent 7 → "0.0" + zeros(6) + "1234"
	const [mantissa = '0', exp = '0'] = abs.toExponential(3).split('e-');
	const zeros = Number(exp) - 1;
	const digits = mantissa.replace('.', '').replace(/0+$/, '');
	const sub = [...String(zeros)].map((d) => SUBSCRIPT[Number(d)]).join('');
	return `${sign}0.0${sub}${digits}`;
}

/** $1.23B, $456.7M, $12.3K, $999 */
export function formatUsdCompact(value: number | null | undefined): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	const abs = Math.abs(value);
	const sign = value < 0 ? '-' : '';
	const units: Array<[number, string]> = [
		[1e12, 'T'],
		[1e9, 'B'],
		[1e6, 'M'],
		[1e3, 'K'],
	];
	for (const [size, suffix] of units) {
		if (abs >= size)
			return `${sign}$${(abs / size).toFixed(abs / size >= 100 ? 0 : 1)}${suffix}`;
	}
	return `${sign}$${abs.toFixed(0)}`;
}

/** +12.3%, -0.4%, 0.0% */
export function formatPercent(value: number | null | undefined): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '—';
	const fixed = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
	return `${value > 0 ? '+' : ''}${fixed}%`;
}

/** "3m", "5h", "12d", "2y" since a timestamp. */
export function formatAge(fromMs: number, nowMs: number): string {
	const s = Math.max(0, (nowMs - fromMs) / 1000);
	if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
	if (s < 86_400) return `${Math.floor(s / 3600)}h`;
	if (s < 365 * 86_400) return `${Math.floor(s / 86_400)}d`;
	return `${Math.floor(s / (365 * 86_400))}y`;
}

export function shortAddress(address: string): string {
	return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

/** Metric values: 4 decimals, scientific when tiny, grouped when large; null = NaN logged. */
export function formatMetric(value: number | null | undefined): string {
	if (value === null || value === undefined) return 'NaN';
	const abs = Math.abs(value);
	if (abs !== 0 && abs < 1e-3) return value.toExponential(3);
	if (abs >= 1e4) return Math.round(value).toLocaleString('en-US');
	return value.toFixed(4);
}
