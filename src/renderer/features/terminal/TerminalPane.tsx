import { useQuery } from '@tanstack/react-query';
import { Copy, TerminalSquare } from 'lucide-react';
import { type JSX, useEffect, useRef, useState } from 'react';

import { useSettings } from '../../app/hooks/use-settings';
import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { closeTerminal, type TermTab, useTerminalStore } from './terminal-store';
import { useXterm } from './use-xterm';

export const PRESETS_KEY = ['terminal', 'presets'] as const;

function copyInstallHint(hint: string): void {
	navigator.clipboard.writeText(hint).then(
		() => toast.success('Copied', 'Run it in a PowerShell terminal, then check again.'),
		(e: unknown) => {
			rlog.warn('terminal', 'copying the install command failed', e);
			toast.error('Copy failed', 'Select the command and copy it by hand.');
		},
	);
}

function renameTab(id: string, title: string): void {
	const store = useTerminalStore.getState();
	if (store.tabs.find((t) => t.id === id)?.title !== title) store.rename(id, title);
}

/** One terminal session. Stays mounted while hidden so its scrollback and xterm survive. */
export function TerminalPane({ tab, visible }: { tab: TermTab; visible: boolean }): JSX.Element {
	const presets = useQuery({ queryKey: PRESETS_KEY, queryFn: () => call('terminal:presets') });
	const info = presets.data?.find((p) => p.id === tab.preset);
	const { settings } = useSettings();
	const hostRef = useRef<HTMLDivElement>(null);
	// Captured once: the command is typed only into the session this pane starts.
	const [initial] = useState(tab.initialCommand);
	const { status, error, retry } = useXterm(hostRef, {
		sessionId: tab.id,
		preset: tab.preset,
		fontSize: Math.max(11, settings.editorFontSize - 1),
		enabled: info?.available ?? false,
		initialCommand: initial,
		focus: visible && !initial,
		// The REPL is IPython or plain Python depending on the env: take main's name for it.
		onOpen: tab.preset === 'repl' ? ({ title }) => renameTab(tab.id, title) : undefined,
	});
	useEffect(() => {
		if (initial && status !== 'starting') useTerminalStore.getState().clearInitial(tab.id);
	}, [initial, status, tab.id]);

	// Profile checks only matter before the session starts; afterwards the host div must stay
	// mounted or xterm would be left rendering into a detached element.
	if (status === 'starting') {
		if (presets.isLoading) {
			return (
				<div className='flex h-full items-center justify-center'>
					<Spinner label='Checking terminal tools' />
				</div>
			);
		}
		if (presets.error)
			return (
				<ErrorState
					message={presets.error.message}
					onRetry={() => void presets.refetch()}
				/>
			);
		if (presets.data && !info) {
			// cmd / Git Bash off Windows, or a profile from an older version of Anvil.
			return (
				<EmptyState
					icon={<TerminalSquare size={22} />}
					title="This terminal profile isn't available on this system"
					description={`"${tab.preset}" can't be started here.`}
					action={
						<Button size='sm' onClick={() => closeTerminal(tab.id)}>
							Close terminal
						</Button>
					}
				/>
			);
		}
		if (info && !info.available) {
			return (
				<EmptyState
					icon={<TerminalSquare size={22} />}
					title={`${info.label} isn't available`}
					description={
						<span className='flex flex-col items-center gap-2'>
							<span>{info.reason}</span>
							{info.installHint && (
								<span className='flex items-center gap-1'>
									<code className='selectable rounded-sm bg-bg-2 px-2 py-1 text-12 text-fg-0'>
										{info.installHint}
									</code>
									<Button
										size='sm'
										variant='ghost'
										icon={<Copy size={12} />}
										onClick={() => copyInstallHint(info.installHint ?? '')}
									>
										Copy
									</Button>
								</span>
							)}
						</span>
					}
					action={
						<Button
							size='sm'
							loading={presets.isFetching}
							onClick={() => void presets.refetch()}
						>
							Check again
						</Button>
					}
				/>
			);
		}
	}
	if (status === 'error') {
		// The host div is unmounted here; retry() re-runs the start once it is back.
		return (
			<div className='flex h-full flex-col items-center justify-center'>
				<ErrorState
					className='h-auto'
					title='Terminal failed to start'
					message={error ?? 'Unknown error'}
					onRetry={retry}
				/>
				<Button size='sm' variant='ghost' onClick={() => closeTerminal(tab.id)}>
					Close terminal
				</Button>
			</div>
		);
	}

	return (
		<div
			className='relative h-full px-2 pt-1'
			data-terminal-session={tab.id}
			data-terminal-status={status}
		>
			<div ref={hostRef} className='h-full w-full' />
			{status === 'starting' && (
				<div className='absolute inset-0 flex items-center justify-center'>
					<Spinner label='Starting terminal' />
				</div>
			)}
		</div>
	);
}
