import { useQuery } from '@tanstack/react-query';
import { FolderPlus } from 'lucide-react';
import { type JSX, useRef, useState } from 'react';

import { ProjectNameSchema } from '@shared/ipc/channels/tools';

import { openRecentFolder } from '../features/explorer/workspace-actions';
import { call } from '../lib/ipc';
import { toast } from '../stores/toast-store';
import { useUiStore } from '../stores/ui-store';
import { reasonNotToLeaveWorkspace } from '../stores/workbench-store';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Input } from '../ui/Input';
import { TemplateOptions } from './TemplateOptions';

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
	// State updates land after a re-render, so a quick second Enter would still see busy=false;
	// the ref blocks a second create (and a second native folder picker) immediately.
	const busyRef = useRef(false);
	const selected = templates.data?.find((t) => t.id === picked) ?? templates.data?.[0];
	const nameCheck = ProjectNameSchema.safeParse(name);
	const valid = nameCheck.success;
	const nameError = nameCheck.error?.issues[0]?.message;

	const create = async (): Promise<void> => {
		if (!selected || !valid || busyRef.current) return;
		// Opening the new project replaces the workspace, so check the unsaved-changes guard
		// before creating anything rather than dropping dirty tabs afterwards.
		const reason = reasonNotToLeaveWorkspace();
		if (reason) {
			toast.warn("Can't switch folders yet", reason);
			return;
		}
		busyRef.current = true;
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
			busyRef.current = false;
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
				<div className='flex flex-col gap-1.5'>
					{templates.data && templates.data.length > 0 && (
						<TemplateOptions
							templates={templates.data}
							selectedId={selected?.id}
							onSelect={setPicked}
						/>
					)}
					{templates.isLoading && <div className='shimmer h-20 rounded-lg' />}
					{templates.isError && (
						<ErrorState
							title='Could not load templates'
							message={templates.error.message}
							onRetry={() => void templates.refetch()}
						/>
					)}
					{templates.data?.length === 0 && <EmptyState title='No templates available' />}
				</div>
				<div className='flex flex-col gap-3'>
					<label className='flex flex-col gap-1'>
						<span className='hud'>Project name</span>
						<Input
							autoFocus
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder='e.g. momentum-research'
							invalid={name.length > 0 && !valid}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.repeat)
									void create();
							}}
						/>
						{name.length > 0 && nameError && (
							<span className='text-11 text-down'>{nameError}</span>
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
