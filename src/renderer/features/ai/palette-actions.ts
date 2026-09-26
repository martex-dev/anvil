import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';
import { attachCurrent, attachDiff } from './chat-attach';
import { useChat } from './chat-store';
import { acceptInlineEdit, cancelInlineEdit, useInlineEdit } from './inline-edit';

// Palette versions of controls that otherwise need the mouse in the AI panel or inline box.

/** Stops the chat reply, or else the inline edit, that is being generated. */
export function stopGenerating(): void {
	const chat = useChat.getState();
	if (chat.activeRequest) chat.stop();
	else if (useInlineEdit.getState().phase === 'generating') cancelInlineEdit();
	else toast.info('Nothing is generating');
}

/** Attaches to the next chat message and shows the panel, so the chip is visible. */
export function attachToChat(kind: 'file' | 'selection' | 'diff'): Promise<void> {
	useLayoutStore.getState().toggleAi(true);
	if (kind === 'diff') return attachDiff();
	attachCurrent(kind);
	return Promise.resolve();
}

export function acceptInline(): void {
	if (useInlineEdit.getState().phase === 'review') acceptInlineEdit();
	else toast.info('No inline edit to accept', 'Press Ctrl+I in the editor to start one.');
}

export function rejectInline(): void {
	if (useInlineEdit.getState().phase) cancelInlineEdit();
	else toast.info('No inline edit open');
}
