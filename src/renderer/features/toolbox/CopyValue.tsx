import { Check, Copy } from 'lucide-react';
import { type JSX, type ReactNode, useEffect, useState } from 'react';

import { cn } from '../../lib/cn';
import { toast } from '../../stores/toast-store';

interface CopyValueProps {
	value: string;
	/** What to render instead of the raw value, e.g. a grouped number. */
	display?: ReactNode;
	/** Accessible name of the value, used as "Copy <label>". */
	label?: string;
	mono?: boolean;
	/** Wrap long values (JSON, encoded text) instead of truncating them to one line. */
	multiline?: boolean;
	className?: string;
}

export function CopyValue({
	value,
	display,
	label = 'value',
	mono = true,
	multiline = false,
	className,
}: CopyValueProps): JSX.Element {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const id = setTimeout(() => setCopied(false), 1000);
		return () => clearTimeout(id);
	}, [copied]);

	const copy = (): void => {
		navigator.clipboard.writeText(value).then(
			() => setCopied(true),
			(err: unknown) =>
				toast.error('Copy failed', err instanceof Error ? err.message : String(err)),
		);
	};

	return (
		<button
			type='button'
			onClick={copy}
			// Single-line values truncate, so the tooltip is the only way to read them in full.
			title={multiline ? 'Click to copy' : `${value}\n(click to copy)`}
			aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
			className={cn(
				'group flex w-full min-w-0 items-start gap-1.5 rounded-sm px-1.5 py-0.5 text-left',
				'transition-[background-color] transition-fast hover:bg-bg-3',
				'focus-visible:shadow-glow focus-visible:outline-none',
				className,
			)}
		>
			<span
				className={cn(
					'selectable min-w-0 flex-1 text-12 text-fg-0',
					mono && 'num',
					multiline ? 'break-all whitespace-pre-wrap' : 'truncate',
				)}
			>
				{display ?? value}
			</span>
			{/* The check icon is visual only; announce the copy for screen readers too. */}
			<span className='sr-only' aria-live='polite'>
				{copied ? 'Copied' : ''}
			</span>
			{copied ? (
				<Check size={12} className='mt-0.5 shrink-0 text-up' aria-hidden />
			) : (
				<Copy
					size={12}
					aria-hidden
					className='mt-0.5 shrink-0 text-fg-2 opacity-0 transition-opacity transition-fast group-hover:opacity-100 group-focus-visible:opacity-100'
				/>
			)}
		</button>
	);
}
