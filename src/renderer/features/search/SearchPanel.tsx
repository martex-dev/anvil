import {
	CaseSensitive,
	ChevronRight,
	RefreshCw,
	Regex,
	ReplaceAll,
	Search,
	SlidersHorizontal,
	WholeWord,
} from 'lucide-react';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { cn } from '../../lib/cn';
import { focusedEditor } from '../../lib/monaco/editors';
import { useFocusOnViewRequest } from '../../stores/view-focus-store';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import { GlobInputs } from './GlobInputs';
import { ReplaceAllDialog } from './ReplaceAllDialog';
import { SearchResults } from './SearchResults';
import { SearchToggle } from './SearchToggle';
import { useReplace } from './use-replace';
import { useFileSearch, useSearchParams, useSearchRequest } from './use-search';

const DEBOUNCE_MS = 250;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function SearchPanel(): JSX.Element {
	const { params, setParams } = useSearchParams();
	const { info } = useWorkspace();
	// Query and options live in a store, so they survive switching side views.
	const [text, setText] = useState(str(params['query']));
	const [query, setQuery] = useState(text);
	const regex = params['regex'] === true;
	const caseSensitive = params['caseSensitive'] === true;
	const wholeWord = params['wholeWord'] === true;
	const include = str(params['include']);
	const exclude = str(params['exclude']);
	const replaceOpen = params['replaceOpen'] === true;
	const replacement = str(params['replace']);
	const filtered = Boolean(include || exclude);
	const [showGlobs, setShowGlobs] = useState(Boolean(include || exclude));
	const inputRef = useRef<HTMLInputElement>(null);
	const replaceRef = useRef<HTMLInputElement>(null);
	useFocusOnViewRequest('search', inputRef, info.root !== null);
	const requestTick = useSearchRequest((s) => s.tick);
	const requested = useSearchRequest((s) => s.query);
	const replaceTick = useSearchRequest((s) => s.replaceTick);
	// searchInFiles() replaces the query from outside and bumps the tick: adopt it during render
	// (not in an effect) so an already-open panel shows and runs the new search.
	const [seenTick, setSeenTick] = useState(requestTick);
	if (seenTick !== requestTick) {
		setSeenTick(requestTick);
		if (requested !== null && requested !== text) {
			setText(requested);
			setQuery(requested);
		}
	}
	// "Replace in Files" opened the row (in the store); put the caret there once it is rendered.
	useEffect(() => {
		if (replaceTick > 0) replaceRef.current?.focus();
	}, [replaceTick]);

	useEffect(() => {
		const id = setTimeout(() => {
			setQuery(text);
			if (text !== str(params['query'])) setParams({ query: text });
		}, DEBOUNCE_MS);
		return () => clearTimeout(id);
		// params is read for comparison only; re-running on it would loop.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [text]);

	const search = useMemo(
		() => ({ query, regex, caseSensitive, wholeWord, include, exclude }),
		[query, regex, caseSensitive, wholeWord, include, exclude],
	);
	const { result, isFetching, isPlaceholderData, error, refetch } = useFileSearch(
		info.root,
		search,
	);
	const replace = useReplace({
		query: search,
		result: query ? result : undefined,
		stale: isPlaceholderData || text !== query,
		replacement,
		refetch,
	});
	// Dim the previous query's results while the new one runs, so counts aren't misread.
	const stale = isPlaceholderData && 'opacity-60';

	if (!info.root) {
		return (
			<EmptyState
				icon={<Search size={20} />}
				title='No folder open'
				description='Open a folder (Ctrl+O) to search its files.'
			/>
		);
	}

	const rerun = (): void => {
		// The same query is cached for a few seconds; Enter means "search again".
		if (text === query) refetch();
		else setQuery(text);
	};

	return (
		<div className='flex h-full flex-col' data-search-panel>
			<div className='flex gap-1 border-b border-glass-edge py-2 pr-2 pl-1'>
				<button
					type='button'
					aria-label={replaceOpen ? 'Hide replace' : 'Show replace (Ctrl+Shift+H)'}
					aria-expanded={replaceOpen}
					onClick={() => setParams({ replaceOpen: !replaceOpen })}
					className='flex w-4 shrink-0 items-start justify-center rounded-sm pt-1.5 text-fg-2 hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
				>
					<ChevronRight
						size={12}
						className={cn(
							'transition-transform transition-fast',
							replaceOpen && 'rotate-90',
						)}
					/>
				</button>
				<div className='flex min-w-0 flex-1 flex-col gap-1'>
					<div className='flex items-center gap-1'>
						<Input
							ref={inputRef}
							aria-label='Search in files'
							placeholder='Search'
							value={text}
							onChange={(e) => setText(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') rerun();
								else if (e.key === 'Escape') {
									e.preventDefault();
									if (text) {
										setText('');
										setQuery('');
									} else focusedEditor()?.focus();
								}
							}}
							leading={isFetching ? <Spinner size={12} /> : <Search size={12} />}
							className='flex-1'
							spellCheck={false}
						/>
						<SearchToggle
							label='Match case'
							pressed={caseSensitive}
							onClick={() => setParams({ caseSensitive: !caseSensitive })}
						>
							<CaseSensitive size={14} />
						</SearchToggle>
						<SearchToggle
							label='Whole word'
							pressed={wholeWord}
							onClick={() => setParams({ wholeWord: !wholeWord })}
						>
							<WholeWord size={14} />
						</SearchToggle>
						<SearchToggle
							label='Regular expression'
							pressed={regex}
							onClick={() => setParams({ regex: !regex })}
						>
							<Regex size={14} />
						</SearchToggle>
						<SearchToggle
							label={
								filtered && !showGlobs
									? 'Files to include / exclude (filters active)'
									: 'Files to include / exclude'
							}
							pressed={showGlobs}
							dot={filtered && !showGlobs}
							onClick={() => setShowGlobs(!showGlobs)}
						>
							<SlidersHorizontal size={13} />
						</SearchToggle>
					</div>
					{replaceOpen && (
						<div className='flex items-center gap-1'>
							<Input
								ref={replaceRef}
								aria-label='Replace with'
								placeholder={regex ? 'Replace ($1 for groups)' : 'Replace'}
								value={replacement}
								onChange={(e) => setParams({ replace: e.target.value })}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && e.ctrlKey && e.altKey) {
										e.preventDefault();
										replace.askReplaceAll();
									} else if (e.key === 'Enter') rerun();
								}}
								leading={replace.busy ? <Spinner size={12} /> : undefined}
								className='flex-1'
								spellCheck={false}
							/>
							<IconButton
								size='sm'
								label='Replace All (Ctrl+Alt+Enter)'
								icon={<ReplaceAll size={14} />}
								disabled={!replace.ready}
								onClick={replace.askReplaceAll}
							/>
						</div>
					)}
					{showGlobs && (
						<GlobInputs include={include} exclude={exclude} onChange={setParams} />
					)}
				</div>
			</div>
			{error ? (
				<p role='alert' className='px-3 py-2 text-12 text-down'>
					{error.message}
				</p>
			) : result && query ? (
				<>
					<div className='flex items-center gap-1 pr-1 pl-3'>
						<p
							className={cn(
								'num min-w-0 flex-1 py-1 text-11 text-fg-2 transition-opacity transition-fast',
								stale,
							)}
							data-search-summary
						>
							{result.matchCount === 0
								? 'No results'
								: `${result.matchCount} result${result.matchCount === 1 ? '' : 's'} in ${result.files.length} file${result.files.length === 1 ? '' : 's'}`}
							{result.timedOut
								? ' (stopped after 20 s; narrow the search)'
								: result.truncated && ' (stopped at the limit; narrow the search)'}
							{filtered && ' · filtered by include/exclude'} · {result.durationMs} ms
						</p>
						<IconButton
							size='sm'
							label='Search again'
							icon={<RefreshCw size={12} />}
							disabled={isFetching}
							onClick={refetch}
						/>
					</div>
					<SearchResults
						// A new query starts with every file expanded.
						key={query}
						files={result.files}
						className={cn('transition-opacity transition-fast', stale)}
						replace={
							replaceOpen
								? {
										disabled: !replace.ready,
										onFile: replace.replaceFile,
										onLine: replace.replaceLine,
									}
								: undefined
						}
					/>
				</>
			) : query.trim() && isFetching ? (
				<p className='flex items-center gap-2 px-3 py-2 text-12 text-fg-2'>
					<Spinner size={12} label='Searching' />
					Searching…
				</p>
			) : (
				<p className='px-3 py-2 text-12 text-fg-2'>
					Type to search. .gitignore and folders like node_modules are skipped.
				</p>
			)}
			<ReplaceAllDialog
				prompt={replace.prompt}
				replacement={replacement}
				onAnswer={replace.answerReplaceAll}
			/>
		</div>
	);
}
