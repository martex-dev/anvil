import { Bookmark, ListTree, X } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import { cn } from '../../lib/cn';
import { focusedEditor } from '../../lib/monaco/editors';
import { requestOpenFile } from '../../stores/workbench-store';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { useEditorStore } from '../editor/editor-store';
import { useBookmarks } from '../editor/extras/bookmarks';
import type { SymbolKind } from './outline';
import { useOutline } from './use-outline';

const TAG: Record<SymbolKind, { label: string; color: string }> = {
	class: { label: 'C', color: '--syn-type' },
	function: { label: 'ƒ', color: '--syn-function' },
	method: { label: 'm', color: '--syn-function' },
	variable: { label: 'K', color: '--syn-number' },
	type: { label: 'T', color: '--syn-type' },
	cell: { label: '%%', color: '--accent' },
	heading: { label: '#', color: '--syn-keyword' },
};

function goto(line: number): void {
	const editor = focusedEditor();
	if (!editor) return;
	editor.setPosition({ lineNumber: line, column: 1 });
	editor.revealLineInCenter(line);
	editor.focus();
}

export function OutlineView(): JSX.Element {
	const { path, symbols } = useOutline();
	const cursor = useEditorStore((s) => s.cursor?.line ?? 0);
	const bookmarks = useBookmarks((s) => s.items);
	const [filter, setFilter] = useState('');
	const shown = useMemo(() => {
		const f = filter.trim().toLowerCase();
		return f ? symbols.filter((s) => s.name.toLowerCase().includes(f)) : symbols;
	}, [symbols, filter]);
	const current = [...symbols].reverse().find((s) => s.line <= cursor && s.end >= cursor);

	return (
		<div className='flex h-full flex-col'>
			<div className='px-2 py-2'>
				<Input
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					placeholder='Filter symbols'
					className='h-6 text-12'
				/>
			</div>
			<div className='min-h-0 flex-1 overflow-auto'>
				{!path ? (
					<EmptyState
						icon={<ListTree size={20} />}
						title='No outline'
						description='Open a Python, TypeScript or Markdown file.'
					/>
				) : shown.length === 0 ? (
					<p className='px-3 py-2 text-12 text-fg-2'>
						No symbols{filter ? ' match' : ' in this file'}.
					</p>
				) : (
					<ul role='tree' aria-label='Outline' className='pb-2'>
						{shown.map((s) => {
							const tag = TAG[s.kind];
							const active = current === s;
							return (
								<li
									key={`${s.line}-${s.name}`}
									role='treeitem'
									aria-selected={active}
								>
									<button
										type='button'
										onClick={() => goto(s.line)}
										style={{ paddingLeft: 12 + s.depth * 14 }}
										className={cn(
											'flex h-6 w-full items-center gap-2 pr-2 text-left text-12 outline-none',
											active
												? 'bg-accent-faint text-fg-0'
												: 'text-fg-1 hover:bg-bg-3/40 focus-visible:bg-accent-faint',
										)}
									>
										<span
											className='w-4 shrink-0 text-center font-mono text-10 font-bold'
											style={{ color: `var(${tag.color})` }}
										>
											{tag.label}
										</span>
										<span
											className={cn(
												'truncate',
												s.kind === 'cell' && 'text-accent',
											)}
										>
											{s.name}
										</span>
										{s.detail && (
											<span className='truncate font-mono text-10 text-fg-2'>
												{s.detail}
											</span>
										)}
										<span className='num ml-auto shrink-0 text-10 text-fg-2'>
											{s.line}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				)}
				<div className='border-t border-glass-edge px-3 pt-2.5 pb-1'>
					<h3 className='hud'>Bookmarks · {bookmarks.length}</h3>
				</div>
				{bookmarks.length === 0 ? (
					<p className='px-3 pb-3 text-12 text-fg-2'>
						Toggle one with Ctrl+Alt+K; jump with Ctrl+Alt+L.
					</p>
				) : (
					<ul className='pb-3'>
						{bookmarks.map((b) => (
							<li key={`${b.path}:${b.line}`} className='group flex items-center'>
								<button
									type='button'
									onClick={() => requestOpenFile({ path: b.path, line: b.line })}
									className='flex min-w-0 flex-1 items-center gap-2 px-3 py-1 text-left text-12 outline-none hover:bg-bg-3/40 focus-visible:bg-accent-faint'
								>
									<Bookmark size={11} className='shrink-0 text-accent-2' />
									<span className='flex min-w-0 flex-col'>
										<span className='truncate font-mono text-11 text-fg-1'>
											{b.preview || '(empty line)'}
										</span>
										<span className='truncate text-10 text-fg-2'>
											{b.path}:{b.line}
										</span>
									</span>
								</button>
								<IconButton
									size='sm'
									label='Remove bookmark'
									icon={<X size={11} />}
									onClick={() => useBookmarks.getState().remove(b.path, b.line)}
									className='mr-1 text-fg-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100'
								/>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
