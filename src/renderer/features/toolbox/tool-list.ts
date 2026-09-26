import {
	Binary,
	Braces,
	Clock,
	Crosshair,
	Hash,
	KeyRound,
	type LucideIcon,
	Regex,
	Ruler,
	TrendingUp,
} from 'lucide-react';

export type ToolId =
	'time' | 'units' | 'encode' | 'jwt' | 'json' | 'regex' | 'hash' | 'position' | 'compound';

export interface ToolMeta {
	id: ToolId;
	/** Short tab label. */
	label: string;
	/** Command palette title, after "Toolbox: ". */
	title: string;
	hint: string;
	icon: LucideIcon;
}

/**
 * Tool metadata without the components, so the command list can name every tool without
 * pulling the lazily loaded toolbox into the main bundle.
 */
export const TOOLS: readonly ToolMeta[] = [
	{
		id: 'time',
		label: 'Time',
		title: 'Timestamp Converter',
		hint: 'Unix timestamps and dates',
		icon: Clock,
	},
	{
		id: 'units',
		label: 'Units',
		title: 'Unit Converter',
		hint: 'bps, wei/gwei, lamports, sats',
		icon: Ruler,
	},
	{
		id: 'encode',
		label: 'Encode',
		title: 'Encode / Decode',
		hint: 'Base64, hex, base58, URL',
		icon: Binary,
	},
	{
		id: 'jwt',
		label: 'JWT',
		title: 'JWT Decoder',
		hint: 'Inspect header and claims',
		icon: KeyRound,
	},
	{
		id: 'json',
		label: 'JSON',
		title: 'JSON Formatter',
		hint: 'Pretty, minify, sort keys',
		icon: Braces,
	},
	{
		id: 'regex',
		label: 'Regex',
		title: 'Regex Tester',
		hint: 'Test a pattern live',
		icon: Regex,
	},
	{ id: 'hash', label: 'Hash', title: 'SHA-256 Hash', hint: 'SHA-256 of text', icon: Hash },
	{
		id: 'position',
		label: 'Size',
		title: 'Position Size Calculator',
		hint: 'Position size from risk and stop',
		icon: Crosshair,
	},
	{
		id: 'compound',
		label: 'Compound',
		title: 'Compound Growth Calculator',
		hint: 'Compound growth with contributions',
		icon: TrendingUp,
	},
];

export function isToolId(value: string): value is ToolId {
	return TOOLS.some((t) => t.id === value);
}
