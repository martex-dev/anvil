import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { CornerDownLeft, Hash, Search } from 'lucide-react';
import { type JSX, type ReactNode, useEffect, useMemo, useState } from 'react';

import { outlineFor } from '../features/outline/outline';
import { cn } from '../lib/cn';
import { call } from '../lib/ipc';
import { focusedEditor } from '../lib/monaco/editors';
import { useAnvilEvent } from '../lib/use-anvil-event';
import { useRegisterOverlay } from '../stores/overlay-store';
import { useUiStore } from '../stores/ui-store';
import { requestOpenFile } from '../stores/workbench-store';
import { FileBadge } from '../ui/FileBadge';
import { Kbd } from '../ui/Kbd';
import { getCommands, runCommand } from './commands/run';
import { fuzzyFilter } from './fuzzy';
import { useWorkspace } from './hooks/use-workspace';

const RECENT_KEY = 'anvil.recentFiles';

export function rememberRecentFile(path: string): void {
	try {
		const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
		const prev = Array.isArray(list)
			? list.filter((p): p is string => typeof p === 'string' && p !== path)
			: [];
		localStorage.setItem(RECENT_KEY, JSON.stringify([path, ...prev].slice(0, 30)));
	} catch {
		// Recents are a nicety.
	}
}

function recentFiles(): string[] {
	try {
		const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
		return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : [];
	} catch {
		return [];
	}
}

function Highlight({
	text,
	indices,
	offset,
}: {
	text: string;
	indices: number[];
	offset: number;
}): JSX.Element {
	const set = new Set(indices.map((i) => i - offset));
	const parts: ReactNode[] = [];
	for (let i = 0; i < text.length; i++) {
		parts.push(
			set.has(i) ? (
				<span key={i} className='text-accent'>
					{text[i]}
				</span>
			) : (
				text[i]
			),
		);
	}
	return <>{parts}</>;
}

const itemClass =
	'group flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-13 text-fg-1 data-[selected=true]:bg-accent-faint data-[selected=true]:text-fg-0';

/**
 * Ctrl+P. Plain text finds files; `>` runs commands, `@` jumps to a symbol in the current file,
 * `:` goes to a line.
 */
export function QuickOpen(): JSX.Element {
	const { open, initial } = useUiStore((s) => s.quickOpen);
	const close = useUiStore((s) => s.closeQuickOpen);
	useRegisterOverlay(open);
	const { info } = useWorkspace();
	const [value, setValue] = useState(initial);
	const [lastInitial, setLastInitial] = useState<string | null>(null);
	// Enter pressed before the list arrived opens the best match as soon as it does.
	const [pendingEnter, setPendingEnter] = useState(false);
	if (open && lastInitial !== initial) {
		setLastInitial(initial);
		setValue(initial);
		setPendingEnter(false);
	}
	if (!open && lastInitial !== null) setLastInitial(null);

	// Kept warm while a folder is open, so Ctrl+P shows results on the first keystroke.
	const client = useQueryClient();
	const files = useQuery({
		queryKey: ['search', 'files', info.root],
		queryFn: () => call('search:files'),
		enabled: Boolean(info.root),
		staleTime: 15_000,
	});
	useAnvilEvent('fs:changed', ({ dirs }) => {
		if (dirs.length > 0) void client.invalidateQueries({ queryKey: ['search', 'files'] });
	});

	const mode = value.startsWith('>')
		? 'commands'
		: value.startsWith('@')
			? 'symbols'
			: value.startsWith(':')
				? 'line'
				: 'files';
	const query = mode === 'files' ? value : value.slice(1).trim();

	const fileResults = useMemo(() => {
		if (mode !== 'files') return [];
		const all = files.data?.files ?? [];
		if (!query) {
			const set = new Set(all);
			const recent = recentFiles().filter((p) => set.has(p));
			return [...recent, ...all.filter((p) => !recent.includes(p))]
				.slice(0, 60)
				.map((path) => ({ path, score: 0, indices: [] as number[] }));
		}
		return fuzzyFilter(query, all);
	}, [mode, query, files.data]);

	const openFile = (path: string): void => {
		close();
		rememberRecentFile(path);
		requestOpenFile({ path });
	};
	const best = pendingEnter && open ? fileResults[0]?.path : undefined;
	useEffect(() => {
		if (!best) return;
		close();
		rememberRecentFile(best);
		requestOpenFile({ path: best });
	}, [best, close]);

	const symbols = useMemo(() => {
		if (mode !== 'symbols' || !open) return [];
		const model = focusedEditor()?.getModel();
		return model ? outlineFor(model.getLanguageId(), model.getLinesContent()) : [];
	}, [mode, open]);

	const goLine = (text: string): void => {
		const editor = focusedEditor();
		const [line, col] = text.split(/[:,]/).map((n) => Number.parseInt(n, 10));
		if (!editor || !line || Number.isNaN(line)) return;
		editor.setPosition({ lineNumber: line, column: col && !Number.isNaN(col) ? col : 1 });
		editor.revealLineInCenter(line);
		editor.focus();
	};

	return (
		<Command.Dialog
			open={open}
			onOpenChange={(o) => !o && close()}
			label='Quick open'
			loop
			shouldFilter={mode === 'commands' || mode === 'symbols'}
			overlayClassName='fixed inset-0 z-40 bg-scrim'
			contentClassName='glass-strong animate-in fixed top-[10vh] left-1/2 z-50 w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl'
		>
			<div className='flex items-center gap-2 border-b border-glass-edge px-3'>
				<Search size={15} className='text-accent' />
				<Command.Input
					autoFocus
					value={value}
					onValueChange={setValue}
					onKeyDown={(e) => {
						if (
							mode === 'files' &&
							e.key === 'Enter' &&
							fileResults.length === 0 &&
							files.isFetching
						) {
							e.preventDefault();
							setPendingEnter(true);
							return;
						}
						if (mode === 'line' && e.key === 'Enter') {
							e.preventDefault();
							close();
							goLine(query);
						}
					}}
					placeholder='Search files · > commands · @ symbols · : line'
					className='h-12 flex-1 bg-transparent text-14 text-fg-0 outline-none placeholder:text-fg-2 focus-visible:outline-none'
				/>
				<span className='hud'>{mode}</span>
			</div>
			<Command.List className='max-h-[min(460px,60vh)] overflow-auto p-1'>
				{mode === 'files' && !info.root && (
					<div className='px-3 py-6 text-center text-13 text-fg-2'>
						Open a folder first (Ctrl+O).
					</div>
				)}
				{mode === 'files' && info.root && files.isLoading && (
					<div className='shimmer mx-2 my-3 h-6 rounded-md' />
				)}
				{mode === 'files' &&
					fileResults.map((m) => {
						const name = m.path.split('/').at(-1) ?? m.path;
						const nameStart = m.path.length - name.length;
						return (
							<Command.Item
								key={m.path}
								value={m.path}
								onSelect={() => openFile(m.path)}
								className={itemClass}
							>
								<FileBadge name={name} />
								<span className='truncate text-fg-0'>
									<Highlight text={name} indices={m.indices} offset={nameStart} />
								</span>
								<span className='truncate text-12 text-fg-2'>
									<Highlight
										text={m.path.slice(0, nameStart)}
										indices={m.indices.filter((i) => i < nameStart)}
										offset={0}
									/>
								</span>
								<CornerDownLeft
									size={12}
									className='ml-auto hidden text-fg-2 group-data-[selected=true]:block'
								/>
							</Command.Item>
						);
					})}
				{mode === 'commands' &&
					getCommands().map((c) => (
						<Command.Item
							key={c.id}
							value={`${c.category} ${c.title}`}
							keywords={c.keywords ?? []}
							onSelect={() => {
								close();
								setTimeout(() => void runCommand(c), 0);
							}}
							className={itemClass}
						>
							<span className='flex-1 truncate'>
								<span className='text-fg-2'>{c.category}: </span>
								{c.title}
							</span>
							{c.shortcut && <Kbd keys={c.shortcut} />}
						</Command.Item>
					))}
				{mode === 'symbols' &&
					(symbols.length === 0 ? (
						<div className='px-3 py-6 text-center text-13 text-fg-2'>
							No symbols in the current file.
						</div>
					) : (
						symbols.map((s) => (
							<Command.Item
								key={`${s.line}:${s.name}`}
								value={`${s.name} ${s.kind}`}
								onSelect={() => {
									close();
									goLine(String(s.line));
								}}
								className={itemClass}
							>
								<Hash size={12} className='text-accent-2' />
								<span
									style={{ paddingLeft: s.depth * 12 }}
									className={cn('truncate', s.kind === 'cell' && 'text-accent')}
								>
									{s.name}
								</span>
								<span className='hud'>{s.kind}</span>
								<span className='num ml-auto text-11 text-fg-2'>{s.line}</span>
							</Command.Item>
						))
					))}
				{mode === 'line' && (
					<div className='px-3 py-4 text-13 text-fg-1'>
						Go to line <span className='num text-accent'>{query || '…'}</span> — type a
						line (or line:column) and press Enter.
					</div>
				)}
			</Command.List>
		</Command.Dialog>
	);
}
