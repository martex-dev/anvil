import { FolderOpen, History, X } from 'lucide-react';
import type { JSX } from 'react';

import { call } from '../../lib/ipc';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { openFolderDialog, openRecentFolder } from './workspace-actions';

export function NoFolder({ recent }: { recent: string[] }): JSX.Element {
	const open = openRecentFolder;
	const forget = (path: string): void => {
		call('workspace:forgetRecent', path).catch(() => undefined);
	};

	return (
		<div className='flex h-full flex-col'>
			<EmptyState
				className='min-h-0 flex-none pt-10'
				icon={<FolderOpen size={22} />}
				title='No folder open'
				description='Open a project to browse, edit and run it.'
				action={
					<Button variant='primary' size='sm' onClick={openFolderDialog}>
						Open Folder…
					</Button>
				}
			/>
			{recent.length > 0 && (
				<section className='px-3 pb-3'>
					<h3 className='mb-1 flex items-center gap-1 text-11 font-medium tracking-widest text-fg-2 uppercase'>
						<History size={12} /> Recent
					</h3>
					<ul className='flex flex-col'>
						{recent.map((path) => (
							<li key={path} className='group flex items-center gap-1'>
								<button
									type='button'
									onClick={() => open(path)}
									title={path}
									className='min-w-0 flex-1 truncate rounded-sm px-1.5 py-1 text-left text-12 text-fg-1 hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
								>
									<span className='text-fg-0'>{path.split(/[\\/]/).at(-1)}</span>
									<span className='ml-2 text-fg-2'>{path}</span>
								</button>
								<IconButton
									size='sm'
									label='Remove from recent'
									icon={<X size={12} />}
									className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
									onClick={() => forget(path)}
								/>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
