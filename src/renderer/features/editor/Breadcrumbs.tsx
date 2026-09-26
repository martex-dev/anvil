import { ChevronRight, Hash } from 'lucide-react';
import { Fragment, type JSX, useMemo } from 'react';

import type { Tab } from '../../stores/tabs-store';
import { outlineFor, symbolPath } from '../outline/outline';
import { findCells } from '../python/cells';
import { useEditorStore } from './editor-store';
import { getModel, isScratch } from './file-ops';

const KIND_TAG: Record<string, string> = {
	class: 'C',
	function: 'ƒ',
	method: 'm',
	heading: '#',
	type: 'T',
};

/**
 * Path › to › file › Class › method, plus the `# %%` cell you're in. Each group follows its own
 * cursor, so an unfocused group keeps showing where you left it.
 */
export function Breadcrumbs({ tab, group }: { tab: Tab; group: number }): JSX.Element | null {
	const path = tab.path;
	const cursorLine = useEditorStore((s) => {
		const at = s.groupLines[group];
		return at && at.path === path ? at.line : null;
	});
	const ready = useEditorStore((s) =>
		path ? s.files.find((f) => f.path === path)?.state === 'ready' : false,
	);
	// Signals that the buffer's text or language changed (the model itself is mutable).
	const version = useEditorStore((s) => s.contentVersion);
	const language = useEditorStore((s) => s.cursor?.language ?? null);
	const outline = useMemo(() => {
		const model = path && ready ? getModel(path) : null;
		if (!model || model.isDisposed()) return null;
		const lines = model.getLinesContent();
		return { lines, symbols: outlineFor(model.getLanguageId(), lines) };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [path, ready, version, language]);
	const inside = useMemo(
		() => (outline && cursorLine ? symbolPath(outline.symbols, cursorLine) : []),
		[outline, cursorLine],
	);
	const cell = useMemo(() => {
		if (!outline || !cursorLine || !path?.endsWith('.py')) return null;
		const cells = findCells(outline.lines);
		const index = cells.findIndex((c) => cursorLine >= c.start && cursorLine <= c.end);
		return index === -1
			? null
			: { index: index + 1, total: cells.length, title: cells[index]?.title ?? '' };
	}, [outline, cursorLine, path]);

	if (!tab.path) return null;
	const label = isScratch(tab.path) ? 'Scratchpad' : tab.path;
	const parts = label.split('/');
	return (
		<div
			data-part='breadcrumbs'
			className='flex h-6 shrink-0 items-center gap-0.5 overflow-hidden px-3 font-mono text-11 whitespace-nowrap text-fg-2'
		>
			{/* The path gives way first, eliding its leading folders (rtl overflow) so the file
			    name, symbols and cell badge stay readable; the tooltip has the whole path. */}
			<span dir='rtl' title={label} className='min-w-0 truncate text-left'>
				<span dir='ltr'>
					{parts.map((part, i) => (
						<Fragment key={`${part}-${i}`}>
							{i > 0 && (
								<ChevronRight
									size={10}
									aria-hidden
									className='mx-0.5 inline align-middle opacity-50'
								/>
							)}
							<span
								className={
									i === parts.length - 1 && inside.length === 0 ? 'text-fg-1' : ''
								}
							>
								{part}
							</span>
						</Fragment>
					))}
				</span>
			</span>
			{inside.length > 0 && (
				<span
					title={inside.map((s) => s.name).join(' › ')}
					className='flex shrink-0 items-center gap-0.5'
				>
					{inside.map((s, i) => (
						<span key={`${s.name}-${s.line}`} className='flex items-center gap-0.5'>
							<ChevronRight size={10} aria-hidden className='opacity-50' />
							<span className='text-10 text-accent-2'>{KIND_TAG[s.kind] ?? '·'}</span>
							<span className={i === inside.length - 1 ? 'text-fg-0' : ''}>
								{s.name}
							</span>
						</span>
					))}
				</span>
			)}
			{cell && (
				<span
					title={`Cell ${cell.index} of ${cell.total}${cell.title ? `: ${cell.title}` : ''}`}
					className='ml-auto flex shrink-0 items-center gap-1 rounded-sm bg-accent-faint px-1.5 text-accent'
				>
					<Hash size={10} aria-hidden />
					cell {cell.index}/{cell.total}
					{cell.title && (
						<span className='max-w-40 truncate text-fg-1'>· {cell.title}</span>
					)}
				</span>
			)}
		</div>
	);
}
