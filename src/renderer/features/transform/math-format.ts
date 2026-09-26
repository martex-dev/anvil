// Grouping kicks in at five digits: "2500" reads fine, "2,500,000" needs the separators.
const GROUP_FROM = 10_000;
// Past 1e15 integers stop being exact in a double, and tiny values are clearer in e-notation.
const EXP_ABOVE = 1e15;
const EXP_BELOW = 1e-6;

// en-US on purpose: the result goes into code, which needs '.' as the decimal separator.
const integerFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 10 });
const integerPlain = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 0,
	useGrouping: false,
});
const decimalPlain = new Intl.NumberFormat('en-US', {
	maximumSignificantDigits: 10,
	useGrouping: false,
});

/**
 * Formats a calculator result: up to 10 significant digits (which also hides float noise like
 * 0.30000000000000004), thousands separators from 10,000 (display only: code gets `grouping = false`), and Python-style inf / nan.
 */
export function formatNumber(n: number, grouping = true): string {
	if (Number.isNaN(n)) return 'nan';
	if (!Number.isFinite(n)) return n > 0 ? 'inf' : '-inf';
	if (n === 0) return '0'; // also folds -0, which Intl would print as "-0"
	const abs = Math.abs(n);
	const grouped = grouping && abs >= GROUP_FROM;
	if (Number.isInteger(n) && abs < EXP_ABOVE) {
		return (grouped ? integerFormat : integerPlain).format(n);
	}
	const rounded = Number(n.toPrecision(10));
	const roundedAbs = Math.abs(rounded);
	if (roundedAbs >= EXP_ABOVE || roundedAbs < EXP_BELOW) return rounded.toExponential();
	return (grouped ? decimalFormat : decimalPlain).format(rounded);
}
