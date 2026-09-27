import type { JSX } from 'react';

import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { answerGitConfirm, useGitConfirm } from './git-confirm';

/** Host for confirmGit(): mounted by the Git view in every state (repo or not). */
export function GitConfirmDialog(): JSX.Element {
	const pending = useGitConfirm((s) => s.pending);
	return (
		<Dialog
			open={pending !== null}
			onOpenChange={(open) => !open && answerGitConfirm(false)}
			title={pending?.title ?? ''}
			description={pending?.description}
			width='sm'
			footer={
				<>
					{/* The safe choice has focus, so Enter never destroys work by accident. */}
					<Button variant='ghost' autoFocus onClick={() => answerGitConfirm(false)}>
						Cancel
					</Button>
					<Button
						variant={pending?.danger ? 'danger' : 'primary'}
						onClick={() => answerGitConfirm(true)}
					>
						{pending?.confirmLabel ?? 'OK'}
					</Button>
				</>
			}
		/>
	);
}
