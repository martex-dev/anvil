import { CaseSensitive, Regex, Search, SlidersHorizontal, WholeWord } from 'lucide-react';
import { type JSX, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { cn } from '../../lib/cn';
import { useFocusOnViewRequest } from '../../stores/view-focus-store';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import { Tooltip } from '../../ui/Tooltip';
import { SearchResults } from './SearchResults';
import { useFileSearch, useSearchParams } from './use-search';

const DEBOUNCE_MS = 250;

function Toggle({
	label,
	pressed,
	onClick,
	children,
}: {
	label: string;
	pressed: boolean;
	onClick: () => void;
	children: ReactNode;
}): JSX.Element {
	return (
		<Tooltip content={label}>
			<button
				type='button'
				aria-label={label}
				aria-pressed={pressed}
				onClick={onClick}
				className={cn(
					'flex size-5 items-center justify-center rounded-sm',
					'focus-visible:shadow-glow focus-visible:outline-none',
					pressed
						? 'bg-accent-soft text-accent'
						: 'text-fg-2 hover:bg-bg-3 hover:text-fg-0',
				)}
			>
				{children}
			</button>
		</Tooltip>
	);
}

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
	const [showGlobs, setShowGlobs] = useState(Boolean(include || exclude));
	const inputRef = useRef<HTMLInputElement>(null);
	useFocusOnViewRequest('search', inputRef, info.root !== null);

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
	const { result, isFetching, error } = useFileSearch(info.root, search);

	if (!info.root) {
		return (
			<EmptyState
				icon={<Search size={20} />}
				title='No folder open'
				description='Open a folder (Ctrl+O) to search its files.'
			/>
		);
	}

	return (
		<div className='flex h-full flex-col' data-search-panel>
			<div className='flex flex-col gap-1 border-b border-glass-edge p-2'>
				<div className='flex items-center gap-1'>
					<Input
						ref={inputRef}
						aria-label='Search in files'
						placeholder='Search'
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && setQuery(text)}
						leading={isFetching ? <Spinner size={12} /> : <Search size={12} />}
						className='flex-1'
						spellCheck={false}
					/>
					<Toggle
						label='Match case'
						pressed={caseSensitive}
						onClick={() => setParams({ caseSensitive: !caseSensitive })}
					>
						<CaseSensitive size={14} />
					</Toggle>
					<Toggle
						label='Whole word'
						pressed={wholeWord}
						onClick={() => setParams({ wholeWord: !wholeWord })}
					>
						<WholeWord size={14} />
					</Toggle>
					<Toggle
						label='Regular expression'
						pressed={regex}
						onClick={() => setParams({ regex: !regex })}
					>
						<Regex size={14} />
					</Toggle>
					<Toggle
						label='Files to include / exclude'
						pressed={showGlobs}
						onClick={() => setShowGlobs(!showGlobs)}
					>
						<SlidersHorizontal size={13} />
					</Toggle>
				</div>
				{showGlobs && (
					<>
						<Input
							aria-label='Files to include'
							placeholder='Include, e.g. src/**, *.py'
							defaultValue={include}
							onBlur={(e) => setParams({ include: e.target.value.trim() })}
							onKeyDown={(e) =>
								e.key === 'Enter' &&
								setParams({ include: e.currentTarget.value.trim() })
							}
							className='h-6 text-12'
						/>
						<Input
							aria-label='Files to exclude'
							placeholder='Exclude, e.g. *.test.ts, dist/**'
							defaultValue={exclude}
							onBlur={(e) => setParams({ exclude: e.target.value.trim() })}
							onKeyDown={(e) =>
								e.key === 'Enter' &&
								setParams({ exclude: e.currentTarget.value.trim() })
							}
							className='h-6 text-12'
						/>
					</>
				)}
			</div>
			{error ? (
				<p role='alert' className='px-3 py-2 text-12 text-down'>
					{error.message}
				</p>
			) : result && query ? (
				<>
					<p className='num px-3 py-1 text-11 text-fg-2' data-search-summary>
						{result.matchCount === 0
							? 'No results'
							: `${result.matchCount} result${result.matchCount === 1 ? '' : 's'} in ${result.files.length} file${result.files.length === 1 ? '' : 's'}`}
						{result.truncated && ' (stopped at the limit; narrow the search)'} ·{' '}
						{result.durationMs} ms
					</p>
					<SearchResults files={result.files} />
				</>
			) : (
				<p className='px-3 py-2 text-12 text-fg-2'>
					Type to search. .gitignore and folders like node_modules are skipped.
				</p>
			)}
		</div>
	);
}
