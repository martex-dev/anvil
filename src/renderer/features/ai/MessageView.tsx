import { AlertTriangle, Copy, FileDiff, RotateCcw, TextCursorInput } from 'lucide-react';
import { type JSX, useMemo } from 'react';

import { cn } from '../../lib/cn';
import { renderMarkdown } from '../../lib/markdown/markdown';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { openApply } from './ApplyDialog';
import { openChatLink } from './chat-links';
import type { ChatMessage } from './chat-store';
import { activeEditor } from './editor-context';
import { splitFences } from './fences';

import '../../lib/markdown/markdown.css';

function applyToEditor(block: string): void {
	const editor = activeEditor();
	if (!editor) {
		toast.warn(
			'Open a file first',
			'Apply previews the change against the file in the editor.',
		);
		return;
	}
	openApply({
		path: editor.path,
		language: editor.language,
		block,
		selection: editor.selection
			? { startLine: editor.selection.startLine, endLine: editor.selection.endLine }
			: null,
	});
}

function insertAtCursor(code: string): void {
	const editor = activeEditor();
	if (!editor) {
		toast.warn('Open a file first');
		return;
	}
	const sel = editor.editor.getSelection();
	if (!sel) return;
	editor.editor.executeEdits('anvil-ai', [{ range: sel, text: code, forceMoveMarkers: true }]);
	editor.editor.focus();
}

function CodeBlock({
	lang,
	code,
	closed,
}: {
	lang: string | null;
	code: string;
	closed: boolean;
}): JSX.Element {
	return (
		<div className='my-2 overflow-hidden rounded-lg border border-glass-edge' data-code-block>
			<div className='flex items-center gap-1 border-b border-glass-edge bg-bg-2/70 px-2 py-0.5'>
				<span className='hud flex-1 text-accent'>{lang ?? 'text'}</span>
				<Button
					size='sm'
					variant='ghost'
					icon={<Copy size={11} />}
					onClick={() =>
						void navigator.clipboard.writeText(code).then(
							() => toast.success('Copied'),
							(error: unknown) =>
								toast.error(
									'Could not copy',
									error instanceof Error ? error.message : undefined,
								),
						)
					}
				>
					Copy
				</Button>
				<Button
					size='sm'
					variant='ghost'
					icon={<TextCursorInput size={11} />}
					disabled={!closed}
					onClick={() => insertAtCursor(code)}
					title='Insert at the cursor'
				>
					Insert
				</Button>
				<Button
					size='sm'
					variant='ghost'
					icon={<FileDiff size={11} />}
					disabled={!closed}
					onClick={() => applyToEditor(code)}
					title='Preview this code as a change to the open file'
				>
					Apply…
				</Button>
			</div>
			<pre className='selectable overflow-x-auto bg-bg-0/70 p-2.5 font-mono text-12 leading-relaxed text-fg-1'>
				{code}
			</pre>
		</div>
	);
}

function Prose({ text }: { text: string }): JSX.Element {
	const html = useMemo(() => renderMarkdown(text), [text]);
	return (
		<div
			className='md-preview selectable text-13'
			// Raw HTML is disabled in the renderer (lib/markdown); links open externally below.
			dangerouslySetInnerHTML={{ __html: html }}
			onClick={(e) => {
				const a = (e.target as HTMLElement).closest('a');
				if (!a) return;
				e.preventDefault();
				// Links resolve against the app's own URL, so check the resolved href but show
				// the link as written.
				openChatLink(
					a.href.startsWith('https://') ? a.href : (a.getAttribute('href') ?? a.href),
				);
			}}
		/>
	);
}

export function MessageView({
	message,
	onRetry,
}: {
	message: ChatMessage;
	/** Offered on a failed latest reply: asks the same question again. */
	onRetry?: () => void;
}): JSX.Element {
	const segments = useMemo(() => splitFences(message.content), [message.content]);
	if (message.role === 'user') {
		return (
			<div
				className='ml-8 rounded-lg rounded-br-sm border border-accent/20 bg-accent-faint px-3 py-2'
				data-chat-role='user'
			>
				{message.context && message.context.length > 0 && (
					<div className='mb-1 flex flex-wrap gap-1'>
						{message.context.map((c) => (
							<span
								key={`${c.kind}:${c.label}`}
								title={c.label}
								className='max-w-full truncate rounded-md bg-bg-3/70 px-1.5 text-11 text-fg-2'
							>
								{c.kind}: {c.label}
							</span>
						))}
					</div>
				)}
				<p className='selectable text-13 break-words whitespace-pre-wrap text-fg-0 [overflow-wrap:anywhere]'>
					{message.content}
				</p>
			</div>
		);
	}
	return (
		<div
			className='mr-2'
			data-chat-role='assistant'
			data-streaming={message.streaming ? 'true' : 'false'}
			// Screen readers wait for the finished reply instead of reading every token.
			aria-busy={message.streaming ? true : undefined}
		>
			{segments.map((s, i) =>
				s.kind === 'md' ? (
					<Prose key={i} text={s.text} />
				) : (
					<CodeBlock
						key={i}
						lang={s.lang}
						code={s.code}
						closed={s.closed || !message.streaming}
					/>
				),
			)}
			{message.streaming && !message.content && (
				<p className='shimmer rounded-md px-2 py-1 text-12 text-fg-2'>Thinking…</p>
			)}
			{message.error && (
				// No role='alert': restored errors would all fire on mount. The Conversation log
				// announces an error when it arrives.
				<p className='mt-1 flex items-start gap-1 text-12 text-down'>
					<AlertTriangle size={12} className='mt-0.5 shrink-0' />
					<span className='sr-only'>Error: </span>
					<span className='min-w-0 flex-1 break-words'>{message.error}</span>
					{onRetry && (
						<Button
							size='sm'
							variant='ghost'
							icon={<RotateCcw size={11} />}
							onClick={onRetry}
							title='Send the question again'
							className='-my-0.5 shrink-0'
						>
							Retry
						</Button>
					)}
				</p>
			)}
			{message.truncated && !message.streaming && (
				<p className='mt-1 flex items-start gap-1 text-12 text-warn'>
					<AlertTriangle size={12} className='mt-0.5 shrink-0' /> Reply was cut off at the
					model’s token limit. Ask it to continue.
				</p>
			)}
			{!message.streaming && !message.error && (
				<p className={cn('num mt-1 text-10 text-fg-2')}>
					{message.model?.model}
					{message.usage?.outputTokens
						? ` · ${message.usage.inputTokens ?? '?'} in / ${message.usage.outputTokens} out`
						: ''}
				</p>
			)}
		</div>
	);
}
