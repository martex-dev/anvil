import { useQuery } from '@tanstack/react-query';
import { FolderPlus } from 'lucide-react';
import { type JSX, useState } from 'react';

import { cn } from '../lib/cn';
import { call } from '../lib/ipc';
import { openRecentFolder } from '../features/explorer/workspace-actions';
import { toast } from '../stores/toast-store';
import { useUiStore } from '../stores/ui-store';
import { reasonNotToLeaveWorkspace } from '../stores/workbench-store';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** New project from a template: pick one, name it, choose where it goes, and it opens. */
export function TemplatesDialog(): JSX.Element {
	const open = useUiStore((s) => s.templatesOpen);
	const setOpen = useUiStore((s) => s.setTemplatesOpen);
	const templates = useQuery({
		queryKey: ['templates'],
		queryFn: () => call('templates:list'),
		enabled: open,
		staleTime: Infinity,
	});
	const [picked, setPicked] = useState<string | null>(null);
	const [name, setName] = useState('');
	const [busy, setBusy] = useState(false);
	const selected = templates.data?.find((t) => t.id === picked) ?? templates.data?.[0];
	const valid = NAME.test(name);

	const create = async (): Promise<void> => {
		if (!selected || !valid) return;
		// Opening the new project replaces the workspace, so check the unsaved-changes guard
		// before creating anything rather than dropping dirty tabs afterwards.
		const reason = reasonNotToLeaveWorkspace();
		if (reason) {
			toast.warn("Can't switch folders yet", reason);
			return;
		}
		setBusy(true);
		try {
			const { root } = await call('templates:create', { templateId: selected.id, name });
			if (root) {
				toast.success('Project created', root);
				setOpen(false);
				setName('');
				openRecentFolder(root);
			}
		} catch (error) {
			toast.error(
				'Could not create the project',
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={setOpen}
			title='New project'
			description='Starts from a working template: uv, ruff (tabs, single quotes), pytest and a README.'
			width='lg'
			footer={
				<>
					<Button variant='ghost' onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						variant='primary'
						icon={<FolderPlus size={13} />}
						disabled={!valid || !selected}
						loading={busy}
						onClick={() => void create()}
					>
						Choose folder & create
					</Button>
				</>
			}
		>
			<div className='grid grid-cols-[1fr_1.1fr] gap-4'>
				<ul className='flex flex-col gap-1.5'>
					{(templates.data ?? []).map((t) => (
						<li key={t.id}>
							<button
								type='button'
								onClick={() => setPicked(t.id)}
								className={cn(
									'w-full rounded-lg border p-3 text-left outline-none transition-colors transition-fast focus-visible:shadow-glow',
									selected?.id === t.id
										? 'border-accent/50 bg-accent-faint'
										: 'border-glass-edge hover:border-border-strong',
								)}
							>
								<div className='text-13 font-medium text-fg-0'>{t.name}</div>
								<div className='mt-0.5 text-12 text-fg-2'>{t.description}</div>
								<div className='mt-1.5 flex flex-wrap gap-1'>
									{t.tags.map((tag) => (
										<span
											key={tag}
											className='rounded-sm bg-bg-3/70 px-1.5 font-mono text-10 text-fg-1'
										>
											{tag}
										</span>
									))}
								</div>
							</button>
						</li>
					))}
					{templates.isLoading && <li className='shimmer h-20 rounded-lg' />}
				</ul>
				<div className='flex flex-col gap-3'>
					<label className='flex flex-col gap-1'>
						<span className='hud'>Project name</span>
						<Input
							autoFocus
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder='e.g. momentum-research'
							invalid={name.length > 0 && !valid}
							onKeyDown={(e) => e.key === 'Enter' && void create()}
						/>
						{name.length > 0 && !valid && (
							<span className='text-11 text-down'>
								Letters, digits, dot, dash and underscore only.
							</span>
						)}
					</label>
					{selected && (
						<div className='min-h-0 flex-1 rounded-lg border border-glass-edge bg-bg-0/40 p-3'>
							<div className='hud mb-2'>Files · {selected.files.length}</div>
							<ul className='max-h-64 overflow-auto font-mono text-11 text-fg-1'>
								{selected.files.map((f) => (
									<li key={f} className='truncate'>
										{name || 'project'}/{f}
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</div>
		</Dialog>
	);
}
