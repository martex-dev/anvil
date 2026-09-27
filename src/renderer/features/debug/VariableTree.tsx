import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { type JSX, type ReactNode, useState } from 'react';

import { cn } from '../../lib/cn';
import { Spinner } from '../../ui/Spinner';
import { useDebugStore } from './debug-store';
import { childVariables } from './evaluate';

/**
 * Query keys for anything read from a paused program. Variable references die when it runs
 * again, so the session and stop generation are part of every key.
 */
export function useDebugKey(
	...parts: Array<string | number | null>
): Array<string | number | null> {
	const session = useDebugStore((s) => s.session);
	const generation = useDebugStore((s) => s.generation);
	return ['debug', session, generation, ...parts];
}

const indent = (depth: number): { paddingLeft: string } => ({ paddingLeft: `${8 + depth * 12}px` });

/** The children of an expandable value, fetched when it's opened. */
export function VariableChildren({
	reference,
	depth,
}: {
	reference: number;
	depth: number;
}): JSX.Element {
	const paused = useDebugStore((s) => s.status === 'paused');
	const key = useDebugKey('children', reference);
	const children = useQuery({
		queryKey: key,
		queryFn: () => childVariables(reference),
		enabled: paused,
		staleTime: Infinity,
	});
	if (children.isPending)
		return (
			<div style={indent(depth)} className='flex h-6 items-center'>
				<Spinner size={12} label='Loading' />
			</div>
		);
	if (children.isError)
		return (
			<p role='alert' style={indent(depth)} className='py-0.5 text-12 text-down'>
				{children.error.message}
			</p>
		);
	if (children.data.length === 0)
		return (
			<p style={indent(depth)} className='py-0.5 text-12 text-fg-2'>
				(empty)
			</p>
		);
	return (
		<>
			{children.data.map((v, i) => (
				<VariableRow
					key={`${v.name}#${i}`}
					name={v.name}
					value={v.value}
					type={v.type}
					reference={v.variablesReference}
					depth={depth}
				/>
			))}
		</>
	);
}

/** One name = value line; values with children (dicts, objects, frames) expand in place. */
export function VariableRow({
	name,
	value,
	type,
	reference,
	depth,
	actions,
	error = false,
}: {
	name: string;
	value: string;
	type?: string | undefined;
	reference: number;
	depth: number;
	actions?: ReactNode;
	error?: boolean;
}): JSX.Element {
	const [open, setOpen] = useState(false);
	const expandable = reference > 0;
	return (
		<>
			<div
				role='treeitem'
				aria-expanded={expandable ? open : undefined}
				aria-level={depth + 1}
				tabIndex={0}
				title={type ? `${name}: ${type}\n${value}` : value}
				onClick={() => expandable && setOpen(!open)}
				onKeyDown={(e) => {
					if (!expandable) return;
					if (
						e.key === 'Enter' ||
						e.key === ' ' ||
						(e.key === 'ArrowRight' && !open) ||
						(e.key === 'ArrowLeft' && open)
					) {
						e.preventDefault();
						setOpen(!open);
					}
				}}
				style={indent(depth)}
				className='group flex h-6 cursor-default items-center gap-1 pr-2 font-mono text-12 outline-none hover:bg-bg-3/60 focus-visible:bg-accent-faint'
			>
				<ChevronRight
					size={11}
					className={cn(
						'shrink-0 text-fg-2 transition-transform transition-fast',
						!expandable && 'invisible',
						open && 'rotate-90',
					)}
				/>
				<span className='shrink-0 text-info'>{name}</span>
				{value !== '' && <span className='shrink-0 text-fg-2'>=</span>}
				<span className={cn('min-w-0 flex-1 truncate', error ? 'text-down' : 'text-fg-0')}>
					{value}
				</span>
				{actions}
			</div>
			{open && expandable && <VariableChildren reference={reference} depth={depth + 1} />}
		</>
	);
}
