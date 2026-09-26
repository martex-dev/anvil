import { CornerDownLeft, Puzzle, Search } from 'lucide-react';
import { type JSX, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusOnViewRequest } from '../../stores/view-focus-store';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { Kbd } from '../../ui/Kbd';
import { CategoryChips } from './CategoryChips';
import { groupByCategory, snippetOptionId } from './group';
import { insertSnippet } from './insert';
import { searchSnippets, type Snippet, type SnippetCategory } from './library';
import { SnippetBody } from './SnippetBody';
import { SnippetRow } from './SnippetRow';

const LISTBOX_ID = 'snippets-listbox';
const PAGE = 8;

export function SnippetsView(): JSX.Element {
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState<SnippetCategory | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	useFocusOnViewRequest('snippets', inputRef);

	const results = useMemo(() => searchSnippets(query), [query]);
	const counts = useMemo(() => {
		const map = new Map<SnippetCategory, number>();
		for (const s of results) map.set(s.category, (map.get(s.category) ?? 0) + 1);
		return map;
	}, [results]);
	const groups = useMemo(
		() => groupByCategory(category ? results.filter((s) => s.category === category) : results),
		[results, category],
	);
	// Keyboard order must match what's on screen, which is grouped, not raw search rank.
	const flat = useMemo(() => groups.flatMap((g) => g.snippets), [groups]);
	const selected: Snippet | null = flat.find((s) => s.id === selectedId) ?? flat[0] ?? null;

	useEffect(() => {
		if (!selected) return;
		const el = document.getElementById(snippetOptionId(selected));
		el?.scrollIntoView({ block: 'nearest' });
	}, [selected]);

	const move = (delta: number | 'first' | 'last'): void => {
		if (flat.length === 0) return;
		const index = selected ? flat.indexOf(selected) : -1;
		const next =
			delta === 'first'
				? 0
				: delta === 'last'
					? flat.length - 1
					: Math.min(flat.length - 1, Math.max(0, index + delta));
		setSelectedId(flat[next]?.id ?? null);
	};

	const insert = (snippet: Snippet | null): void => {
		if (snippet) insertSnippet(snippet);
	};

	// Shared by the search box and the list so either can drive the selection.
	const onNavKey = (e: KeyboardEvent<HTMLElement>, fromInput: boolean): void => {
		const keys: Record<string, () => void> = {
			ArrowDown: () => move(1),
			ArrowUp: () => move(-1),
			PageDown: () => move(PAGE),
			PageUp: () => move(-PAGE),
			Enter: () => insert(selected),
		};
		// In the search box Home/End belong to the text cursor.
		if (!fromInput) {
			keys['Home'] = () => move('first');
			keys['End'] = () => move('last');
		}
		if (fromInput && e.key === 'Escape' && query) keys['Escape'] = () => setQuery('');
		const action = keys[e.key];
		if (!action) return;
		e.preventDefault();
		action();
	};

	const clearFilters = (): void => {
		setQuery('');
		setCategory(null);
	};

	return (
		<div className='flex h-full flex-col'>
			<div className='flex shrink-0 flex-col gap-2 border-b border-border p-2'>
				<Input
					ref={inputRef}
					role='combobox'
					aria-label='Search snippets'
					aria-controls={LISTBOX_ID}
					aria-expanded
					aria-activedescendant={selected ? snippetOptionId(selected) : undefined}
					placeholder='Search snippets'
					leading={<Search size={12} />}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => onNavKey(e, true)}
					spellCheck={false}
				/>
				<CategoryChips
					value={category}
					onChange={setCategory}
					counts={counts}
					total={results.length}
				/>
			</div>

			<div
				ref={listRef}
				id={LISTBOX_ID}
				role='listbox'
				aria-label='Snippets'
				tabIndex={0}
				aria-activedescendant={selected ? snippetOptionId(selected) : undefined}
				onKeyDown={(e) => onNavKey(e, false)}
				className='min-h-0 flex-1 overflow-auto p-1 focus-visible:shadow-glow focus-visible:outline-none'
			>
				{groups.length === 0 ? (
					<EmptyState
						icon={<Puzzle size={20} />}
						title='No snippets match'
						description={
							query
								? `Nothing for “${query.trim()}”${category ? ` in ${category}` : ''}.`
								: `No ${category ?? ''} snippets yet.`
						}
						action={
							<Button size='sm' onClick={clearFilters}>
								Clear filters
							</Button>
						}
					/>
				) : (
					groups.map((group) => (
						<div
							key={group.category}
							role='group'
							aria-label={group.category}
							className='mb-1'
						>
							<div className='hud flex items-center justify-between px-2 pt-2 pb-1'>
								<span>{group.category}</span>
								<span className='num'>{group.snippets.length}</span>
							</div>
							{group.snippets.map((s) => (
								<SnippetRow
									key={s.id}
									snippet={s}
									selected={s.id === selected?.id}
									onSelect={() => {
										setSelectedId(s.id);
										listRef.current?.focus();
									}}
									onInsert={() => insert(s)}
								/>
							))}
						</div>
					))
				)}
			</div>

			{selected && (
				<section
					aria-label='Snippet preview'
					className='flex max-h-[45%] min-h-32 shrink-0 flex-col border-t border-border'
				>
					<div className='flex shrink-0 items-start gap-2 px-3 pt-2 pb-1.5'>
						<div className='min-w-0 flex-1'>
							<p className='truncate text-13 text-fg-0'>{selected.name}</p>
							<div className='mt-1 flex flex-wrap items-center gap-1'>
								<Badge tone='accent'>
									<span className='num'>{selected.prefix}</span>
								</Badge>
								<Badge>{selected.language}</Badge>
								<Badge>{selected.category}</Badge>
							</div>
						</div>
						<Button
							variant='primary'
							size='sm'
							icon={<CornerDownLeft size={12} />}
							onClick={() => insert(selected)}
						>
							Insert
						</Button>
					</div>
					<p className='shrink-0 px-3 pb-2 text-11 text-fg-2'>{selected.description}</p>
					<div className='mx-2 mb-2 min-h-0 flex-1 overflow-auto rounded-sm border border-border bg-bg-2 px-2 py-1.5'>
						<SnippetBody body={selected.body} />
					</div>
					<div className='flex shrink-0 items-center gap-3 border-t border-border px-3 py-1 text-11 text-fg-2'>
						<span className='flex items-center gap-1'>
							<Kbd keys='↑' />
							<Kbd keys='↓' /> select
						</span>
						<span className='flex items-center gap-1'>
							<Kbd keys='Enter' /> insert
						</span>
						<span className='truncate'>or type the prefix in the editor</span>
					</div>
				</section>
			)}
		</div>
	);
}
