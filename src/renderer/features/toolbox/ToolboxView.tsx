import { type ComponentType, type JSX, type KeyboardEvent, useRef } from 'react';

import { cn } from '../../lib/cn';
import { CompoundTool } from './CompoundTool';
import { EncodeTool } from './EncodeTool';
import { HashTool } from './HashTool';
import { JsonTool } from './JsonTool';
import { JwtTool } from './JwtTool';
import { PositionSizeTool } from './PositionSizeTool';
import { RegexTool } from './RegexTool';
import { TimeTool } from './TimeTool';
import { type ToolId, TOOLS } from './tool-list';
import { useToolboxStore } from './toolbox-store';
import { UnitsTool } from './UnitsTool';

const COMPONENTS: Record<ToolId, ComponentType> = {
	time: TimeTool,
	units: UnitsTool,
	encode: EncodeTool,
	jwt: JwtTool,
	json: JsonTool,
	regex: RegexTool,
	hash: HashTool,
	position: PositionSizeTool,
	compound: CompoundTool,
};

export function ToolboxView(): JSX.Element {
	const active = useToolboxStore((s) => s.activeTool);
	const select = useToolboxStore((s) => s.setActiveTool);
	const tabRefs = useRef(new Map<string, HTMLButtonElement>());
	const current = TOOLS.find((t) => t.id === active) ?? TOOLS[0];

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
				{/* Tools stay mounted while hidden, and their inputs live in toolbox-store, so they
				    survive both tab switches and the side bar leaving the toolbox view. */}
				{TOOLS.map(({ id }) => {
					const Component = COMPONENTS[id];
					return (
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
					);
				})}
			</div>
		</div>
	);
}
