import type { JSX } from 'react';

import { cn } from '../lib/cn';

interface BadgeStyle {
	label: string;
	/** CSS variable for the tint. */
	color: string;
}

const BY_EXT: Record<string, BadgeStyle> = {
	py: { label: 'PY', color: '--syn-function' },
	pyi: { label: 'PYI', color: '--syn-function' },
	ipynb: { label: 'NB', color: '--accent-amber' },
	ts: { label: 'TS', color: '--info' },
	tsx: { label: 'TSX', color: '--info' },
	js: { label: 'JS', color: '--accent-amber' },
	jsx: { label: 'JSX', color: '--accent-amber' },
	mjs: { label: 'JS', color: '--accent-amber' },
	json: { label: '{}', color: '--syn-number' },
	jsonl: { label: 'JL', color: '--syn-number' },
	csv: { label: 'CSV', color: '--up' },
	tsv: { label: 'TSV', color: '--up' },
	parquet: { label: 'PQ', color: '--up' },
	feather: { label: 'ARW', color: '--up' },
	arrow: { label: 'ARW', color: '--up' },
	xlsx: { label: 'XLS', color: '--up' },
	md: { label: 'MD', color: '--text-1' },
	toml: { label: 'TML', color: '--syn-decorator' },
	yaml: { label: 'YML', color: '--syn-decorator' },
	yml: { label: 'YML', color: '--syn-decorator' },
	ini: { label: 'INI', color: '--syn-decorator' },
	cfg: { label: 'CFG', color: '--syn-decorator' },
	sql: { label: 'SQL', color: '--syn-keyword' },
	sh: { label: 'SH', color: '--up' },
	ps1: { label: 'PS', color: '--info' },
	bat: { label: 'BAT', color: '--text-1' },
	r: { label: 'R', color: '--info' },
	jl: { label: 'JL', color: '--syn-keyword' },
	rs: { label: 'RS', color: '--syn-decorator' },
	go: { label: 'GO', color: '--syn-function' },
	c: { label: 'C', color: '--info' },
	cpp: { label: 'C++', color: '--info' },
	h: { label: 'H', color: '--info' },
	java: { label: 'JV', color: '--syn-control' },
	html: { label: '<>', color: '--syn-decorator' },
	css: { label: 'CSS', color: '--syn-keyword' },
	svg: { label: 'SVG', color: '--syn-number' },
	png: { label: 'IMG', color: '--syn-keyword' },
	jpg: { label: 'IMG', color: '--syn-keyword' },
	jpeg: { label: 'IMG', color: '--syn-keyword' },
	gif: { label: 'IMG', color: '--syn-keyword' },
	webp: { label: 'IMG', color: '--syn-keyword' },
	log: { label: 'LOG', color: '--text-2' },
	txt: { label: 'TXT', color: '--text-2' },
	lock: { label: 'LCK', color: '--text-2' },
	dockerfile: { label: 'DKR', color: '--info' },
};

const BY_NAME: Record<string, BadgeStyle> = {
	dockerfile: { label: 'DKR', color: '--info' },
	makefile: { label: 'MK', color: '--syn-decorator' },
	'.gitignore': { label: 'GIT', color: '--down' },
	'.env': { label: 'ENV', color: '--down' },
	license: { label: 'LIC', color: '--text-2' },
};

export function badgeFor(name: string): BadgeStyle {
	const lower = name.toLowerCase();
	if (lower === '.env' || lower.startsWith('.env.')) return { label: 'ENV', color: '--down' };
	const byName = BY_NAME[lower];
	if (byName) return byName;
	const ext = lower.includes('.') ? (lower.split('.').at(-1) ?? '') : '';
	return BY_EXT[ext] ?? { label: ext.slice(0, 3).toUpperCase() || '··', color: '--text-2' };
}

/** A tiny monospace type tag in the file's color: reads faster than icons at 11px. */
export function FileBadge({ name, className }: { name: string; className?: string }): JSX.Element {
	const b = badgeFor(name);
	return (
		<span
			aria-hidden
			className={cn(
				'inline-flex h-3.5 min-w-6 shrink-0 items-center justify-center rounded-[3px] px-0.5 font-mono text-[8.5px] leading-none font-bold tracking-wide',
				className,
			)}
			style={{
				color: `var(${b.color})`,
				backgroundColor: `color-mix(in oklab, var(${b.color}) 14%, transparent)`,
				boxShadow: `inset 0 0 0 1px color-mix(in oklab, var(${b.color}) 28%, transparent)`,
			}}
		>
			{b.label}
		</span>
	);
}
