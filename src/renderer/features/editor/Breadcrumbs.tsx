import { ChevronRight, Hash } from 'lucide-react';
import { type JSX, useMemo } from 'react';

import { focusedEditor } from '../../lib/monaco/editors';
import type { Tab } from '../../stores/tabs-store';
import { symbolPath } from '../outline/outline';
import { useOutline } from '../outline/use-outline';
import { findCells } from '../python/cells';
import { useEditorStore } from './editor-store';

const KIND_TAG: Record<string, string> = {
	class: 'C',
	function: 'ƒ',
	method: 'm',
	heading: '#',
	type: 'T',
};

/** Path › to › file › Class › method, plus the `# %%` cell you're in. */
export function Breadcrumbs({ tab, focused }: { tab: Tab; focused: boolean }): JSX.Element | null {
	const cursorLine = useEditorStore((s) => (focused ? (s.cursor?.line ?? null) : null));
	const { path, symbols } = useOutline();
	const inside = useMemo(
		() => (focused && cursorLine && path === tab.path ? symbolPath(symbols, cursorLine) : []),
		[focused, cursorLine, path, tab.path, symbols],
	);
	const cell = useMemo(() => {
		if (!focused || !cursorLine || !tab.path?.endsWith('.py')) return null;
		const lines = focusedEditor()?.getModel()?.getLinesContent();
		if (!lines) return null;
		const cells = findCells(lines);
		const index = cells.findIndex((c) => cursorLine >= c.start && cursorLine <= c.end);
		return index === -1
			? null
			: { index: index + 1, total: cells.length, title: cells[index]?.title ?? '' };
		// symbols change whenever the text does, which is when cells can change too.
	}, [focused, cursorLine, tab.path, symbols]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!tab.path) return null;
	const parts = tab.path.split('/');
	return (
		<div className='flex h-6 shrink-0 items-center gap-0.5 overflow-hidden px-3 font-mono text-11 whitespace-nowrap text-fg-2'>
			{parts.map((part, i) => (
				<span key={`${part}-${i}`} className='flex items-center gap-0.5'>
					{i > 0 && <ChevronRight size={10} className='opacity-50' />}
					<span
						className={i === parts.length - 1 && inside.length === 0 ? 'text-fg-1' : ''}
					>
						{part}
					</span>
				</span>
			))}
			{inside.map((s, i) => (
				<span key={`${s.name}-${s.line}`} className='flex items-center gap-0.5'>
					<ChevronRight size={10} className='opacity-50' />
					<span className='text-10 text-accent-2'>{KIND_TAG[s.kind] ?? '·'}</span>
					<span className={i === inside.length - 1 ? 'text-fg-0' : ''}>{s.name}</span>
				</span>
			))}
			{cell && (
				<span className='ml-auto flex items-center gap-1 rounded-sm bg-accent-faint px-1.5 text-accent'>
					<Hash size={10} />
					cell {cell.index}/{cell.total}
					{cell.title && <span className='text-fg-1'>· {cell.title}</span>}
				</span>
			)}
		</div>
	);
}
