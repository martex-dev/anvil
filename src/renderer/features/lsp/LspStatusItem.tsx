import { Braces } from 'lucide-react';
import type { JSX } from 'react';

import type { LspLanguage } from '@shared/ipc/channels/lsp';

import { cn } from '../../lib/cn';
import { restart } from './lsp-clients';
import { LANGUAGE_LABEL, type LspState, useLspStatus } from './lsp-status';

const DOT: Record<LspState, string> = {
	idle: 'bg-border-strong',
	starting: 'bg-warn animate-pulse motion-reduce:animate-none',
	ready: 'bg-up',
	error: 'bg-down',
};

/** Language servers at a glance; click restarts the ones that were running or failed. */
export function LspStatusItem(): JSX.Element | null {
	const status = useLspStatus((s) => s.status);
	const active = (Object.keys(status) as LspLanguage[]).filter((l) => status[l].state !== 'idle');
	if (active.length === 0) return null;
	const title = active
		.map(
			(l) =>
				`${LANGUAGE_LABEL[l]}: ${status[l].state}${status[l].message ? ` — ${status[l].message}` : ''}`,
		)
		.join('\n');
	return (
		<button
			type='button'
			onClick={() => void restart(active)}
			title={`${title}\nClick to restart language servers`}
			className='flex items-center gap-1.5 rounded-sm px-1 text-fg-1 hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
			data-lsp-status={active.map((l) => `${l}:${status[l].state}`).join(',')}
		>
			<Braces size={12} />
			{active.map((l) => (
				<span key={l} className='flex items-center gap-1'>
					<span className={cn('size-1.5 rounded-full', DOT[status[l].state])} />
					{LANGUAGE_LABEL[l]}
				</span>
			))}
		</button>
	);
}
