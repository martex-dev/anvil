import type { JSX } from 'react';

import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';

interface ConfirmTrashDialogProps {
	/** The workspace path about to be trashed; null keeps the dialog closed. */
	path: string | null;
	onCancel: () => void;
	onConfirm: (path: string) => void;
}

/** Asks before moving a file or folder to the Recycle Bin. */
export function ConfirmTrashDialog({
	path,
	onCancel,
	onConfirm,
}: ConfirmTrashDialogProps): JSX.Element {
	return (
		<Dialog
			open={path !== null}
			onOpenChange={(open) => !open && onCancel()}
			title='Move to Recycle Bin?'
			description={<span className='selectable font-mono'>{path}</span>}
			width='sm'
			footer={
				<>
					<Button variant='ghost' onClick={onCancel}>
						Cancel
					</Button>
					<Button variant='danger' autoFocus onClick={() => path && onConfirm(path)}>
						Move to Recycle Bin
					</Button>
				</>
			}
		/>
	);
}
