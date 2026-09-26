import { type JSX, useRef } from 'react';

import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useEditorStore } from './editor-store';
import { reloadFromDisk, saveFile } from './file-ops';
import { finishClose, refocusGroup } from './open';

export function EditorDialogs(): JSX.Element {
	// Closing several dirty tabs asks about each in turn; Cancel stops the whole close.
	const closing = useEditorStore((s) => s.closing[0] ?? null);
	const dropClose = useEditorStore((s) => s.dropClose);
	const clearClosing = useEditorStore((s) => s.clearClosing);
	// Save All can hit several conflicts: they're asked about one after another.
	const conflict = useEditorStore((s) => s.conflicts[0] ?? null);
	const dropConflict = useEditorStore((s) => s.dropConflict);
	const onConflictDone = (): void => {
		if (conflict) dropConflict(conflict);
	};
	const name = (path: string | null): string => path?.split('/').at(-1) ?? '';
	// Set when "Don't Save" removes the tab: Radix would return focus to its (gone) close button.
	const tabRemoved = useRef(false);

	return (
		<>
			<Dialog
				open={closing !== null}
				onOpenChange={(open) => !open && clearClosing()}
				title={`Save changes to ${name(closing)}?`}
				description='Your changes will be lost if you close without saving.'
				width='sm'
				onCloseAutoFocus={(event) => {
					if (!tabRemoved.current) return;
					tabRemoved.current = false;
					event.preventDefault();
					refocusGroup();
				}}
				footer={
					<>
						<Button variant='ghost' onClick={clearClosing}>
							Cancel
						</Button>
						<Button
							variant='danger'
							onClick={() => {
								if (!closing) return;
								finishClose(closing);
								tabRemoved.current = true;
								dropClose(closing);
							}}
						>
							Don&apos;t Save
						</Button>
						<Button
							variant='primary'
							autoFocus
							onClick={() => {
								const path = closing;
								if (!path) return;
								dropClose(path);
								void saveFile(path).then((ok) => {
									if (!ok) return;
									// Focus went back to the tab while saving; closing it now drops it.
									finishClose(path);
									refocusGroup(true);
								});
							}}
						>
							Save
						</Button>
					</>
				}
			/>
			<Dialog
				open={conflict !== null}
				onOpenChange={(open) => !open && onConflictDone()}
				title={`${name(conflict)} changed on disk`}
				description='Another program modified this file after you opened it. Which version do you want to keep?'
				width='sm'
				footer={
					<>
						<Button variant='ghost' onClick={onConflictDone}>
							Cancel
						</Button>
						<Button
							onClick={() => {
								const path = conflict;
								onConflictDone();
								if (path) void reloadFromDisk(path);
							}}
						>
							Load Disk Version
						</Button>
						<Button
							variant='primary'
							onClick={() => {
								const path = conflict;
								onConflictDone();
								if (path) void saveFile(path, true);
							}}
						>
							Overwrite With Mine
						</Button>
					</>
				}
			/>
		</>
	);
}
