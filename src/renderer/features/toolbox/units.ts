export type UnitFamily = 'rate' | 'ethereum' | 'solana' | 'bitcoin';

export type UnitId =
	'bps' | 'pct' | 'decimal' | 'wei' | 'gwei' | 'eth' | 'lamports' | 'sol' | 'sats' | 'btc';

export interface UnitInfo {
	id: UnitId;
	label: string;
	family: UnitFamily;
	/** Power of ten of the family's smallest unit in one of this unit (eth = 18 wei digits). */
	scale: number;
}

export const UNITS: readonly UnitInfo[] = [
	{ id: 'bps', label: 'Basis points (bps)', family: 'rate', scale: 0 },
	{ id: 'pct', label: 'Percent (%)', family: 'rate', scale: 2 },
	{ id: 'decimal', label: 'Decimal', family: 'rate', scale: 4 },
	{ id: 'wei', label: 'Wei', family: 'ethereum', scale: 0 },
	{ id: 'gwei', label: 'Gwei', family: 'ethereum', scale: 9 },
	{ id: 'eth', label: 'Ether (ETH)', family: 'ethereum', scale: 18 },
	{ id: 'lamports', label: 'Lamports', family: 'solana', scale: 0 },
	{ id: 'sol', label: 'SOL', family: 'solana', scale: 9 },
	{ id: 'sats', label: 'Satoshis (sats)', family: 'bitcoin', scale: 0 },
	{ id: 'btc', label: 'Bitcoin (BTC)', family: 'bitcoin', scale: 8 },
];

export interface UnitValue {
	unit: UnitId;
	label: string;
	value: string;
}

/** An exact decimal: (-1)^negative * digits * 10^exponent. */
interface Decimal {
	negative: boolean;
	digits: string;
	exponent: number;
}

const MAX_EXPONENT = 400;

function parseDecimal(input: string): Decimal {
	const clean = input.trim().replace(/[\s_,]/g, '');
	const m = /^([+-])?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(clean);
	const intPart = m?.[2] ?? '';
	const fracPart = m?.[3] ?? '';
	if (!m || intPart.length + fracPart.length === 0) {
		throw new Error(`'${input.trim()}' is not a number`);
	}
	const exp = Number(m[4] ?? '0');
	if (Math.abs(exp) > MAX_EXPONENT) throw new Error('Exponent is too large');
	return { negative: m[1] === '-', digits: intPart + fracPart, exponent: exp - fracPart.length };
}

function formatDecimal({ negative, digits, exponent }: Decimal): string {
	const trimmed = digits.replace(/^0+/, '');
	if (!trimmed) return '0';
	let out: string;
	if (exponent >= 0) {
		out = trimmed + '0'.repeat(exponent);
	} else {
		const point = trimmed.length + exponent;
		const whole = point > 0 ? trimmed.slice(0, point) : '0';
		const frac = (point < 0 ? '0'.repeat(-point) : '') + trimmed.slice(Math.max(point, 0));
		out = `${whole}.${frac}`.replace(/\.?0+$/, '');
	}
	return negative ? `-${out}` : out;
}

function unitInfo(unit: UnitId): UnitInfo {
	const info = UNITS.find((u) => u.id === unit);
	if (!info) throw new Error(`Unknown unit '${unit}'`);
	return info;
}

/**
 * Converts a value into every unit of the same family. Decimal-string arithmetic (a power-of-ten
 * shift) keeps it exact, so 1.5 ETH is precisely 1500000000000000000 wei.
 */
export function convertUnits(value: string, unit: UnitId): UnitValue[] {
	const from = unitInfo(unit);
	const parsed = parseDecimal(value);
	return UNITS.filter((u) => u.family === from.family).map((to) => ({
		unit: to.id,
		label: to.label,
		value: formatDecimal({ ...parsed, exponent: parsed.exponent + from.scale - to.scale }),
	}));
}
