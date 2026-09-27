import { type JSX, useState } from 'react';

import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useEditorStore } from './editor-store';
import { saveEach } from './unsaved';

/**
 * Save / Don't Save / Cancel for the files that would be lost when the window closes or
 * reloads, the folder changes, or Anvil restarts to update (unsaved.ts).
 */
export function UnsavedDialog(): JSX.Element {
	const prompt = useEditorStore((s) => s.unsaved);
	const [saving, setSaving] = useState(false);
	const paths = prompt?.paths ?? [];
	const one = paths.length === 1;
	const title = one
		? `Save changes to ${paths[0]?.split('/').at(-1) ?? ''}?`
		: `Save changes to ${paths.length} files?`;
	const save = async (): Promise<void> => {
		if (!prompt) return;
		setSaving(true);
		try {
			// A failed save (error toast, or the disk-conflict dialog) keeps everything open.
			prompt.resolve(await saveEach(prompt.paths));
		} finally {
			setSaving(false);
		}
	};
	return (
		<Dialog
			open={prompt !== null}
			onOpenChange={(open) => !open && prompt?.resolve(false)}
			title={title}
			description={`Your changes will be lost if you continue ${prompt?.action ?? ''} without saving.`}
			width='sm'
			footer={
				<>
					<Button variant='ghost' onClick={() => prompt?.resolve(false)}>
						Cancel
					</Button>
					<Button variant='danger' onClick={() => prompt?.resolve(true)}>
						Don&apos;t Save
					</Button>
					<Button
						variant='primary'
						autoFocus
						loading={saving}
						onClick={() => void save()}
					>
						{one ? 'Save' : 'Save All'}
					</Button>
				</>
			}
		>
			{one ? null : (
				<ul className='flex flex-col gap-0.5 text-12'>
					{paths.map((p) => (
						<li key={p} className='truncate font-mono text-fg-1' title={p}>
							{p}
						</li>
					))}
				</ul>
			)}
		</Dialog>
	);
}
