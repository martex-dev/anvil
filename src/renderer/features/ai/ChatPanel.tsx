import { useQuery } from '@tanstack/react-query';
import {
	ArrowDown,
	AtSign,
	Bot,
	ChevronDown,
	FileCode2,
	GitCompare,
	KeyRound,
	Plus,
	Send,
	Square,
	TextSelect,
	X,
} from 'lucide-react';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';

import { runCommandById } from '../../app/commands/run';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { useUiStore } from '../../stores/ui-store';
import { Button } from '../../ui/Button';
import { FileBadge } from '../../ui/FileBadge';
import { IconButton } from '../../ui/IconButton';
import { checkLookahead, explainCode, reviewCode, writeTests } from './actions';
import { pickModel, PROVIDER_LABEL, useAiSettings } from './ai-settings';
import { attachCurrent, attachDiff, attachPath } from './chat-attach';
import { useChatFocus } from './chat-focus';
import { useChat } from './chat-store';
import { MessageView } from './MessageView';
import { useStickToBottom } from './use-stick-to-bottom';

const SLASH: Array<{ cmd: string; hint: string; run: () => void }> = [
	{ cmd: '/explain', hint: 'explain the selection or function', run: () => void explainCode() },
	{ cmd: '/review', hint: 'find bugs and edge cases', run: () => void reviewCode() },
	{ cmd: '/tests', hint: 'write pytest / vitest tests', run: () => void writeTests() },
	{
		cmd: '/lookahead',
		hint: 'audit for look-ahead bias and leakage',
		run: () => void checkLookahead(),
	},
	{ cmd: '/clear', hint: 'new conversation', run: () => useChat.getState().clear() },
];

const STARTERS: Array<{ label: string; run: () => void }> = [
	{ label: 'Explain this code', run: () => void explainCode() },
	{ label: 'Find bugs', run: () => void reviewCode() },
	{ label: 'Write tests', run: () => void writeTests() },
	{ label: 'Check for look-ahead bias', run: () => void checkLookahead() },
];

/** `@partial` or `/partial` being typed at the end of the input. */
function trigger(text: string): { kind: '@' | '/'; query: string } | null {
	const at = /(?:^|\s)@([\w./-]*)$/.exec(text);
	if (at) return { kind: '@', query: at[1] ?? '' };
	const slash = /^\/(\w*)$/.exec(text);
	return slash ? { kind: '/', query: slash[1] ?? '' } : null;
}

export function ChatPanel(): JSX.Element {
	const { settings, keys } = useAiSettings();
	const { info } = useWorkspace();
	const { messages, activeRequest, attached, detach, send, stop, clear } = useChat();
	const [text, setText] = useState('');
	const [pick, setPick] = useState(0);
	const {
		ref: listRef,
		onScroll: onListScroll,
		away: scrolledAway,
		jump: jumpToLatest,
	} = useStickToBottom(messages);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const focusTick = useChatFocus((s) => s.tick);
	const tr = trigger(text);
	const files = useQuery({
		queryKey: ['search', 'files', info.root],
		queryFn: () => call('search:files'),
		enabled: tr?.kind === '@' && Boolean(info.root),
		staleTime: 30_000,
	});
	const suggestions = useMemo(() => {
		if (!tr) return [];
		const q = tr.query.toLowerCase();
		if (tr.kind === '/')
			return SLASH.filter((s) => s.cmd.slice(1).startsWith(q)).map((s) => ({
				id: s.cmd,
				label: s.cmd,
				hint: s.hint,
			}));
		return (files.data?.files ?? [])
			.filter((f) => f.toLowerCase().includes(q))
			.sort((a, b) => a.length - b.length)
			.slice(0, 8)
			.map((f) => ({ id: f, label: f.split('/').at(-1) ?? f, hint: f }));
	}, [tr, files.data]);

	useEffect(() => {
		if (focusTick > 0) inputRef.current?.focus();
	}, [focusTick]);

	if (!settings) return <div className='shimmer h-full' />;
	const model = settings.chat;
	const hasKey = keys?.[model.provider] ?? false;

	const choose = (index: number): void => {
		const s = suggestions[index];
		if (!s || !tr) return;
		if (tr.kind === '/') {
			setText('');
			SLASH.find((x) => x.cmd === s.id)?.run();
			return;
		}
		setText(text.replace(/@[\w./-]*$/, ''));
		void attachPath(s.id);
	};
	const submit = (): void => {
		if (!text.trim() || !hasKey) return;
		send(text, model);
		setText('');
		jumpToLatest();
	};

	return (
		<div className='flex h-full flex-col' data-ai-chat>
			<header className='flex h-9 shrink-0 items-center gap-1.5 border-b border-glass-edge pr-1.5 pl-3'>
				<Bot size={14} className='text-accent-2' />
				<span className='hud text-fg-1'>Assistant</span>
				<button
					type='button'
					onClick={() => void pickModel('chat')}
					title='Change the chat model'
					className='ml-1 flex h-6 min-w-0 items-center gap-1 rounded-md border border-glass-edge bg-bg-2/40 px-2 font-mono text-11 text-fg-1 outline-none hover:border-accent/40 hover:text-fg-0 focus-visible:shadow-glow'
				>
					<span className='truncate'>{model.model}</span>
					<ChevronDown size={11} className='shrink-0' />
				</button>
				<span className='flex-1' />
				<IconButton
					label='New conversation'
					size='sm'
					icon={<Plus size={14} />}
					onClick={clear}
				/>
			</header>
			{!hasKey && (
				<div className='flex items-center gap-2 border-b border-warn/30 bg-warn-soft px-3 py-2 text-12 text-warn'>
					<KeyRound size={12} />
					<span className='flex-1'>No {PROVIDER_LABEL[model.provider]} API key yet.</span>
					<Button size='sm' onClick={() => useUiStore.getState().openSettings('keys')}>
						Add key
					</Button>
				</div>
			)}
			<div className='relative flex min-h-0 flex-1 flex-col'>
				<div
					ref={listRef}
					onScroll={onListScroll}
					className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3'
					aria-label='Conversation'
				>
					{messages.length === 0 ? (
						<div className='m-auto flex max-w-72 flex-col items-center gap-4 text-center'>
							<div className='relative flex size-14 items-center justify-center'>
								<span className='absolute inset-0 rounded-full bg-accent-2/15 blur-xl' />
								<Bot size={26} className='relative text-accent-2' />
							</div>
							<p className='text-12 text-fg-2'>
								Ask about your code. Type <kbd className='text-accent'>@</kbd> to
								attach a file, <kbd className='text-accent'>/</kbd> for commands.
								Select code and press <kbd className='text-accent'>Ctrl+I</kbd> to
								edit it in place.
							</p>
							<div className='flex flex-wrap justify-center gap-1.5'>
								{STARTERS.map((s) => (
									<button
										key={s.label}
										type='button'
										onClick={s.run}
										className='rounded-full border border-glass-edge bg-bg-2/40 px-2.5 py-1 text-11 text-fg-1 hover:border-accent/40 hover:text-fg-0'
									>
										{s.label}
									</button>
								))}
							</div>
						</div>
					) : (
						messages.map((m) => <MessageView key={m.id} message={m} />)
					)}
				</div>
				{scrolledAway && messages.length > 0 && (
					<button
						type='button'
						onClick={jumpToLatest}
						className='absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-glass-edge bg-bg-2 px-2.5 py-1 text-11 text-fg-1 shadow-panel outline-none hover:text-fg-0 focus-visible:shadow-glow'
					>
						<ArrowDown size={11} /> Jump to latest
					</button>
				)}
			</div>
			<div className='border-t border-glass-edge p-2'>
				<div className='mb-1.5 flex flex-wrap items-center gap-1'>
					<Button
						size='sm'
						variant='ghost'
						icon={<FileCode2 size={11} />}
						onClick={() => attachCurrent('file')}
					>
						File
					</Button>
					<Button
						size='sm'
						variant='ghost'
						icon={<TextSelect size={11} />}
						onClick={() => attachCurrent('selection')}
					>
						Selection
					</Button>
					<Button
						size='sm'
						variant='ghost'
						icon={<GitCompare size={11} />}
						onClick={() => void attachDiff()}
					>
						Diff
					</Button>
					<Button
						size='sm'
						variant='ghost'
						icon={<AtSign size={11} />}
						onClick={() => {
							setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}@`);
							inputRef.current?.focus();
						}}
					>
						Mention
					</Button>
				</div>
				{attached.length > 0 && (
					<div className='mb-1.5 flex flex-wrap gap-1'>
						{attached.map((c, i) => (
							<span
								key={`${c.kind}:${c.label}`}
								className='flex items-center gap-1 rounded-md border border-accent/25 bg-accent-faint px-1.5 py-0.5 text-11 text-fg-1'
								data-attached={c.kind}
							>
								{c.kind === 'file' ? (
									<FileBadge name={c.label.split('/').at(-1) ?? c.label} />
								) : (
									<span className='hud text-accent'>{c.kind}</span>
								)}
								<span className='max-w-44 truncate'>{c.label}</span>
								<button
									type='button'
									aria-label={`Remove ${c.label}`}
									onClick={() => detach(i)}
									className='rounded-sm hover:text-fg-0'
								>
									<X size={10} />
								</button>
							</span>
						))}
					</div>
				)}
				<div className='relative'>
					{suggestions.length > 0 && (
						<ul
							role='listbox'
							className='glass-strong animate-in absolute right-0 bottom-full left-0 z-20 mb-1 max-h-60 overflow-auto p-1'
						>
							{suggestions.map((s, i) => (
								<li key={s.id} role='option' aria-selected={i === pick}>
									<button
										type='button'
										onMouseDown={(e) => {
											e.preventDefault();
											choose(i);
										}}
										className={cn(
											'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-12',
											i === pick ? 'bg-accent-faint text-fg-0' : 'text-fg-1',
										)}
									>
										{tr?.kind === '@' ? (
											<FileBadge name={s.label} />
										) : (
											<span className='font-mono text-accent'>{s.label}</span>
										)}
										{tr?.kind === '@' && <span>{s.label}</span>}
										<span className='truncate text-11 text-fg-2'>{s.hint}</span>
									</button>
								</li>
							))}
						</ul>
					)}
					<textarea
						ref={inputRef}
						aria-label='Message'
						value={text}
						onChange={(e) => {
							setText(e.target.value);
							setPick(0);
						}}
						onKeyDown={(e) => {
							if (suggestions.length > 0) {
								if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
									e.preventDefault();
									setPick(
										(p) =>
											(p +
												(e.key === 'ArrowDown'
													? 1
													: suggestions.length - 1)) %
											suggestions.length,
									);
									return;
								}
								if (e.key === 'Enter' || e.key === 'Tab') {
									e.preventDefault();
									choose(pick);
									return;
								}
							}
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								submit();
							}
						}}
						rows={3}
						placeholder={
							hasKey
								? 'Ask anything… (Enter to send, Shift+Enter new line)'
								: 'Add an API key to start'
						}
						className='selectable w-full resize-none rounded-lg border border-border-strong bg-bg-2/60 py-2 pr-10 pl-2.5 text-13 text-fg-0 outline-none transition-[border-color,box-shadow] transition-fast placeholder:text-fg-2 focus:border-accent/60 focus:shadow-glow-soft'
					/>
					<div className='absolute right-1.5 bottom-2'>
						{activeRequest ? (
							<IconButton
								label='Stop'
								icon={<Square size={13} className='fill-current text-down' />}
								onClick={stop}
							/>
						) : (
							<IconButton
								label='Send (Enter)'
								icon={
									<Send size={14} className={text.trim() ? 'text-accent' : ''} />
								}
								disabled={!hasKey || !text.trim()}
								onClick={submit}
							/>
						)}
					</div>
				</div>
				<div className='mt-1 flex items-center gap-2 px-0.5 text-10 text-fg-2'>
					<span className='hud'>{PROVIDER_LABEL[model.provider]}</span>
					<span className='flex-1' />
					<button
						type='button'
						className='hover:text-fg-1'
						onClick={() => runCommandById('ai.inlineEdit')}
					>
						Ctrl+I inline edit
					</button>
				</div>
			</div>
		</div>
	);
}
