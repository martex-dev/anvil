import {
	Bot,
	FolderOpen,
	FolderPlus,
	History,
	KeyRound,
	ListChecks,
	ShieldCheck,
	Table,
	Wand2,
	Wrench,
} from 'lucide-react';
import type { JSX, ReactNode } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { useUiStore } from '../../stores/ui-store';
import { Kbd } from '../../ui/Kbd';
import { PROVIDER_LABEL, useAiSettings } from '../ai/ai-settings';
import { openRecentFolder } from '../explorer/workspace-actions';

function Action({
	icon,
	label,
	command,
}: {
	icon: ReactNode;
	label: string;
	command: string;
}): JSX.Element {
	const keys = shortcutFor(command);
	return (
		<button
			type='button'
			onClick={() => runCommandById(command)}
			className='group flex h-10 items-center gap-3 rounded-lg border border-glass-edge bg-bg-2/30 px-3 text-13 text-fg-1 outline-none transition-all transition-fast hover:border-accent/40 hover:bg-accent-faint hover:text-fg-0 hover:shadow-glow-soft focus-visible:shadow-glow'
		>
			<span className='text-accent'>{icon}</span>
			<span className='flex-1 text-left'>{label}</span>
			{keys && <Kbd keys={keys} />}
		</button>
	);
}

function Feature({
	icon,
	title,
	body,
	keys,
}: {
	icon: ReactNode;
	title: string;
	body: string;
	keys?: string | undefined;
}): JSX.Element {
	return (
		<div className='group relative overflow-hidden rounded-xl border border-glass-edge bg-bg-2/25 p-4 transition-colors transition-base hover:border-accent/30'>
			<span className='absolute -top-10 -right-10 size-28 rounded-full bg-accent-faint blur-2xl transition-opacity transition-base group-hover:opacity-100' />
			<div className='relative flex items-center gap-2 text-accent'>
				{icon}
				<h3 className='text-13 font-semibold text-fg-0'>{title}</h3>
				{keys && <Kbd keys={keys} className='ml-auto' />}
			</div>
			<p className='relative mt-1.5 text-12 leading-relaxed text-fg-2'>{body}</p>
		</div>
	);
}

/** Start page: the mark, how to begin, recent folders, and what makes Anvil different. */
export function Welcome(): JSX.Element {
	const { info } = useWorkspace();
	const { settings, keys } = useAiSettings();
	const aiReady = settings ? (keys?.[settings.chat.provider] ?? false) : true;
	return (
		<div className='mx-auto flex max-w-5xl flex-col gap-10 px-10 py-12'>
			<header className='flex items-center gap-6'>
				<div className='relative flex size-20 shrink-0 items-center justify-center'>
					<span className='absolute inset-0 rounded-full bg-accent/20 blur-2xl' />
					<span className='accent-gradient absolute size-12 rotate-45 shadow-glow' />
					<span className='absolute size-4 rotate-45 bg-bg-0' />
				</div>
				<div>
					<h1 className='text-gradient font-mono text-48 leading-none font-bold tracking-[0.3em]'>
						ANVIL
					</h1>
					<p className='mt-2 text-14 text-fg-1'>
						The AI code editor for quant, trading, crypto, ML and data work.
					</p>
					<p className='hud mt-1'>python · typescript · polars · torch · ccxt · duckdb</p>
				</div>
			</header>

			{!aiReady && settings && (
				<button
					type='button'
					onClick={() => useUiStore.getState().openSettings('keys')}
					className='flex items-center gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-left text-13 text-warn hover:border-warn/60'
				>
					<KeyRound size={16} />
					<span className='flex-1'>
						Add your {PROVIDER_LABEL[settings.chat.provider]} API key to turn on chat,
						inline edit and autocomplete.
					</span>
					<span className='text-12'>Settings → API Keys</span>
				</button>
			)}

			<div className='grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-10'>
				<section className='flex flex-col gap-2'>
					<h2 className='hud mb-1 text-accent'>Start</h2>
					<Action
						icon={<FolderOpen size={16} />}
						label='Open folder'
						command='file.openFolder'
					/>
					<Action
						icon={<FolderPlus size={16} />}
						label='New project from template'
						command='file.newProject'
					/>
					<Action
						icon={<Wrench size={16} />}
						label='Command palette'
						command='view.palette'
					/>
					<h2 className='hud mt-5 mb-1 text-accent'>Recent</h2>
					{info.recent.length === 0 ? (
						<p className='text-12 text-fg-2'>Folders you open show up here.</p>
					) : (
						<ul className='flex flex-col'>
							{info.recent.slice(0, 7).map((path) => (
								<li key={path}>
									<button
										type='button'
										onClick={() => openRecentFolder(path)}
										className='group flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent-faint focus-visible:bg-accent-faint'
									>
										<History
											size={12}
											className='shrink-0 text-fg-2 group-hover:text-accent'
										/>
										<span className='shrink-0 text-13 text-fg-0'>
											{path.split(/[\\/]/).at(-1)}
										</span>
										<span className='truncate font-mono text-11 text-fg-2'>
											{path}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</section>

				<section className='grid grid-cols-2 content-start gap-3'>
					<Feature
						icon={<ListChecks size={15} />}
						title='Run # %% cells'
						body='Split any .py into cells and run them in a live IPython REPL, Jupyter-style, without leaving the editor.'
						keys={shortcutFor('python.runCell')}
					/>
					<Feature
						icon={<Wand2 size={15} />}
						title='Edit with AI in place'
						body='Select code, describe the change, review the result inline. Accept with Tab, reject with Esc.'
						keys={shortcutFor('ai.inlineEdit')}
					/>
					<Feature
						icon={<Table size={15} />}
						title='Data viewer'
						body='Open CSV, Parquet, Feather, JSONL and Excel as a fast grid with filtering, sorting and column profiles.'
					/>
					<Feature
						icon={<ShieldCheck size={15} />}
						title='Secret shield'
						body='.env values blurred, API keys, wallet keys and seed phrases flagged, and blocked from commits.'
					/>
					<Feature
						icon={<Bot size={15} />}
						title='Autocomplete + chat'
						body='Ghost text from a fast model, and a chat that knows your file, selection, diff and errors. @ to attach files.'
						keys={shortcutFor('ai.focusChat')}
					/>
					<Feature
						icon={<Wrench size={15} />}
						title='Toolbox'
						body='Unix timestamps, wei/lamports/bps, base58, JWT, regex, position sizing: the stuff you google ten times a day.'
						keys={shortcutFor('view.toolbox')}
					/>
				</section>
			</div>
		</div>
	);
}
