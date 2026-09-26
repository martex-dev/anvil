import { type JSX, useRef } from 'react';

import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useEditorStore } from './editor-store';
import { reloadFromDisk, saveFile } from './file-ops';
import { finishClose, refocusGroup } from './open';

export function EditorDialogs(): JSX.Element {
	const closing = useEditorStore((s) => s.closing);
	const setClosing = useEditorStore((s) => s.setClosing);
	const onCloseDone = (): void => setClosing(null);
	const conflict = useEditorStore((s) => s.conflict);
	const setConflict = useEditorStore((s) => s.setConflict);
	const name = (path: string | null): string => path?.split('/').at(-1) ?? '';
	// Set when "Don't Save" removes the tab: Radix would return focus to its (gone) close button.
	const tabRemoved = useRef(false);

	return (
		<>
			<Dialog
				open={closing !== null}
				onOpenChange={(open) => !open && onCloseDone()}
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
						<Button variant='ghost' onClick={onCloseDone}>
							Cancel
						</Button>
						<Button
							variant='danger'
							onClick={() => {
								if (closing) {
									finishClose(closing);
									tabRemoved.current = true;
								}
								onCloseDone();
							}}
						>
							Don&apos;t Save
						</Button>
						<Button
							variant='primary'
							autoFocus
							onClick={() => {
								const path = closing;
								onCloseDone();
								if (!path) return;
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
				onOpenChange={(open) => !open && setConflict(null)}
				title={`${name(conflict)} changed on disk`}
				description='Another program modified this file after you opened it. Which version do you want to keep?'
				width='sm'
				footer={
					<>
						<Button variant='ghost' onClick={() => setConflict(null)}>
							Cancel
						</Button>
						<Button
							onClick={() => {
								const path = conflict;
								setConflict(null);
								if (path) void reloadFromDisk(path);
							}}
						>
							Load Disk Version
						</Button>
						<Button
							variant='primary'
							onClick={() => {
								const path = conflict;
								setConflict(null);
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
