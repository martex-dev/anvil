import { Braces, TriangleAlert } from 'lucide-react';
import type { JSX } from 'react';

import type { LspLanguage } from '@shared/ipc/channels/lsp';

import { cn } from '../../lib/cn';
import { restart } from './lsp-clients';
import { describeLanguage, LANGUAGE_LABEL, type LspState, useLspStatus } from './lsp-status';

const DOT: Record<LspState, string> = {
	idle: 'bg-border-strong',
	starting: 'bg-warn pulse-dot',
	ready: 'bg-up',
	error: 'bg-down',
};

/** Language servers at a glance; click restarts the ones that were running or failed. */
export function LspStatusItem(): JSX.Element | null {
	const status = useLspStatus((s) => s.status);
	const active = (Object.keys(status) as LspLanguage[]).filter((l) => status[l].state !== 'idle');
	if (active.length === 0) return null;
	// The state and any failure reason are spoken, not only shown by the dot colour or tooltip.
	const described = active.map((l) => describeLanguage(l, status[l]));
	const title = described.join('\n');
	return (
		<button
			type='button'
			onClick={() => void restart(active)}
			title={`${title}\nClick to restart language servers`}
			aria-label={`${described.join('. ')}. Activate to restart language servers`}
			// Same look as the status bar's other clickable items (StatusBar.tsx `Item`).
			className='flex h-full items-center gap-1.5 rounded-sm px-1.5 whitespace-nowrap outline-none transition-colors transition-fast hover:bg-bg-3/60 hover:text-fg-0 focus-visible:shadow-glow'
			data-lsp-status={active.map((l) => `${l}:${status[l].state}`).join(',')}
		>
			<Braces size={12} />
			{active.map((l) => (
				<span key={l} className='flex items-center gap-1'>
					{status[l].state === 'error' ? (
						// A shape as well as a colour, so a failure reads without telling red from green.
						<TriangleAlert size={11} className='text-down' aria-hidden />
					) : (
						<span
							className={cn('size-1.5 rounded-full', DOT[status[l].state])}
							aria-hidden
						/>
					)}
					{LANGUAGE_LABEL[l]}
				</span>
			))}
		</button>
	);
}
