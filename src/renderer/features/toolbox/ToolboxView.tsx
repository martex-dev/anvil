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
import { type ComponentType, type JSX, type KeyboardEvent, useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import { CompoundTool } from './CompoundTool';
import { EncodeTool } from './EncodeTool';
import { HashTool } from './HashTool';
import { JsonTool } from './JsonTool';
import { JwtTool } from './JwtTool';
import { PositionSizeTool } from './PositionSizeTool';
import { RegexTool } from './RegexTool';
import { TimeTool } from './TimeTool';
import { UnitsTool } from './UnitsTool';

interface ToolDef {
	id: string;
	label: string;
	hint: string;
	icon: LucideIcon;
	Component: ComponentType;
}

const TOOLS: readonly ToolDef[] = [
	{
		id: 'time',
		label: 'Time',
		hint: 'Unix timestamps and dates',
		icon: Clock,
		Component: TimeTool,
	},
	{
		id: 'units',
		label: 'Units',
		hint: 'bps, wei/gwei, lamports, sats',
		icon: Ruler,
		Component: UnitsTool,
	},
	{
		id: 'encode',
		label: 'Encode',
		hint: 'Base64, hex, base58, URL',
		icon: Binary,
		Component: EncodeTool,
	},
	{
		id: 'jwt',
		label: 'JWT',
		hint: 'Inspect header and claims',
		icon: KeyRound,
		Component: JwtTool,
	},
	{
		id: 'json',
		label: 'JSON',
		hint: 'Pretty, minify, sort keys',
		icon: Braces,
		Component: JsonTool,
	},
	{ id: 'regex', label: 'Regex', hint: 'Test a pattern live', icon: Regex, Component: RegexTool },
	{ id: 'hash', label: 'Hash', hint: 'SHA-256 of text', icon: Hash, Component: HashTool },
	{
		id: 'position',
		label: 'Size',
		hint: 'Position size from risk and stop',
		icon: Crosshair,
		Component: PositionSizeTool,
	},
	{
		id: 'compound',
		label: 'Compound',
		hint: 'Compound growth with contributions',
		icon: TrendingUp,
		Component: CompoundTool,
	},
];

const STORAGE_KEY = 'anvil.toolbox.lastTool';

function loadLastTool(): string {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved && TOOLS.some((t) => t.id === saved)) return saved;
	} catch {
		// Storage can be unavailable (blocked or quota); the first tool is a fine default.
	}
	return TOOLS[0]?.id ?? 'time';
}

function saveLastTool(id: string): void {
	try {
		localStorage.setItem(STORAGE_KEY, id);
	} catch {
		// Remembering the tool is a convenience; losing it is harmless.
	}
}

export function ToolboxView(): JSX.Element {
	const [active, setActive] = useState(loadLastTool);
	const tabRefs = useRef(new Map<string, HTMLButtonElement>());
	const current = TOOLS.find((t) => t.id === active) ?? TOOLS[0];

	const select = (id: string): void => {
		setActive(id);
		saveLastTool(id);
	};

	// Roving focus: arrows move between tools like a native tab strip.
	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
		const index = TOOLS.findIndex((t) => t.id === active);
		let next = -1;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % TOOLS.length;
		else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
			next = (index - 1 + TOOLS.length) % TOOLS.length;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = TOOLS.length - 1;
		const tool = TOOLS[next];
		if (!tool) return;
		e.preventDefault();
		select(tool.id);
		tabRefs.current.get(tool.id)?.focus();
	};

	return (
		<div className='flex h-full flex-col'>
			<div className='shrink-0 border-b border-border p-2'>
				<div
					role='tablist'
					aria-label='Tools'
					onKeyDown={onKeyDown}
					className='grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1'
				>
					{TOOLS.map(({ id, label, icon: Icon }) => {
						const selected = id === current?.id;
						return (
							<button
								key={id}
								ref={(el) => {
									if (el) tabRefs.current.set(id, el);
									else tabRefs.current.delete(id);
								}}
								type='button'
								role='tab'
								id={`toolbox-tab-${id}`}
								aria-selected={selected}
								aria-controls={`toolbox-panel-${id}`}
								tabIndex={selected ? 0 : -1}
								onClick={() => select(id)}
								className={cn(
									'flex h-7 min-w-0 items-center gap-1.5 rounded-sm border px-2 text-12',
									'transition-[background-color,border-color,color] transition-fast',
									'focus-visible:shadow-glow focus-visible:outline-none',
									selected
										? 'border-accent/40 bg-accent-soft text-accent'
										: 'border-transparent text-fg-1 hover:bg-bg-3 hover:text-fg-0',
								)}
							>
								<Icon size={12} className='shrink-0' aria-hidden />
								<span className='truncate'>{label}</span>
							</button>
						);
					})}
				</div>
				{current && (
					<p className='mt-2 truncate text-11 text-fg-2'>
						<span className='hud text-accent'>{current.label}</span>
						<span className='ml-2'>{current.hint}</span>
					</p>
				)}
			</div>
			<div className='min-h-0 flex-1 overflow-auto'>
				{/* Tools stay mounted while hidden so inputs survive switching back and forth. */}
				{TOOLS.map(({ id, Component }) => (
					<div
						key={id}
						role='tabpanel'
						id={`toolbox-panel-${id}`}
						aria-labelledby={`toolbox-tab-${id}`}
						hidden={id !== current?.id}
						className='animate-in p-3'
					>
						<Component />
					</div>
				))}
			</div>
		</div>
	);
}
