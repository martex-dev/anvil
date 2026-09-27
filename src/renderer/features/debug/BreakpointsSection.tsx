import { Diamond, Pencil, Trash2, X } from 'lucide-react';
import type { JSX } from 'react';

import { requestOpenFile } from '../../stores/workbench-store';
import { IconButton } from '../../ui/IconButton';
import { editBreakpoint } from './breakpoint-actions';
import { type Breakpoint, placeKey, useBreakpoints } from './breakpoints';
import { DebugSection, SectionNote } from './DebugSection';

function describe(b: Breakpoint): string | null {
	if (b.logMessage) return `log: ${b.logMessage}`;
	const parts = [b.condition && `when ${b.condition}`, b.hitCondition && `hit ${b.hitCondition}`];
	return parts.filter(Boolean).join(', ') || null;
}

function BreakpointRow({ b, rejected }: { b: Breakpoint; rejected: boolean }): JSX.Element {
	const detail = describe(b);
	const name = `${b.path.split('/').at(-1) ?? b.path}:${b.line}`;
	return (
		<li className='group flex h-6 items-center gap-1.5 pr-1.5 pl-3 text-12 hover:bg-bg-3/60'>
			<input
				type='checkbox'
				aria-label={`Enable breakpoint ${name}`}
				checked={b.enabled}
				onChange={(e) =>
					useBreakpoints.getState().setEnabled(b.path, b.line, e.target.checked)
				}
				className='size-3 accent-[var(--down)]'
			/>
			{b.logMessage && <Diamond size={10} className='shrink-0 text-warn' aria-hidden />}
			<button
				type='button'
				title={rejected ? 'The debugger cannot stop on this line' : b.path}
				onClick={() => requestOpenFile({ path: b.path, line: b.line, preview: true })}
				className='flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:underline'
			>
				<span
					className={rejected || !b.enabled ? 'truncate text-fg-2' : 'truncate text-fg-1'}
				>
					{name}
				</span>
				{detail && (
					<span className='min-w-0 truncate font-mono text-10 text-fg-2'>{detail}</span>
				)}
			</button>
			<IconButton
				size='sm'
				label={`Edit condition of ${name}`}
				icon={<Pencil size={11} />}
				className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
				onClick={() =>
					void editBreakpoint(b.path, b.line, b.logMessage ? 'logMessage' : 'condition')
				}
			/>
			<IconButton
				size='sm'
				label={`Remove breakpoint ${name}`}
				icon={<X size={12} />}
				className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
				onClick={() => useBreakpoints.getState().remove(b.path, b.line)}
			/>
		</li>
	);
}

/** Every breakpoint in the folder: enable, jump to, edit or remove. */
export function BreakpointsSection(): JSX.Element {
	const items = useBreakpoints((s) => s.items);
	const rejected = useBreakpoints((s) => s.rejected);
	return (
		<DebugSection
			title='Breakpoints'
			actions={
				items.length > 0 && (
					<IconButton
						size='sm'
						label='Remove all breakpoints'
						icon={<Trash2 size={12} />}
						onClick={() => useBreakpoints.getState().clear()}
					/>
				)
			}
		>
			{items.length === 0 && (
				<SectionNote>
					Click left of a line number in a Python file, or press Ctrl+F9.
				</SectionNote>
			)}
			<ul aria-label='Breakpoints'>
				{items.map((b) => (
					<BreakpointRow
						key={placeKey(b.path, b.line)}
						b={b}
						rejected={rejected.has(placeKey(b.path, b.line))}
					/>
				))}
			</ul>
		</DebugSection>
	);
}
