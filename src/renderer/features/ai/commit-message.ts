import { call } from '../../lib/ipc';
import { streamOnce } from './requests';
import { maskSecrets } from './secret-filter';

/** Messages being written right now (normally one; the git panel owns the button). */
const running = new Set<AbortController>();

/**
 * Writes a Conventional Commits message from what's staged, streaming into `onPartial`.
 * Stopped (by `signal`, or cancelCommitMessage from the palette's Stop Generating), it resolves
 * with what was written so far rather than failing: that text stays in the box to edit or clear.
 */
export async function generateCommitMessage(
	onPartial: (text: string) => void,
	signal?: AbortSignal,
): Promise<string> {
	const abort = new AbortController();
	if (signal?.aborted) abort.abort();
	signal?.addEventListener('abort', () => abort.abort(), { once: true });
	running.add(abort);
	let partial = '';
	try {
		const { diff, truncated } = await call('ai:gitDiff', { staged: true });
		// Stopped while git ran: nothing was sent, nothing was written.
		if (abort.signal.aborted) return '';
		if (!diff.trim()) throw new Error('Nothing is staged');
		const text = await streamOnce({
			mode: 'commit',
			messages: [{ role: 'user', content: 'Write the commit message for this staged diff.' }],
			context: [
				{
					kind: 'diff',
					label: truncated ? 'staged diff (truncated)' : 'staged diff',
					language: 'diff',
					// The message needs what changed, not a staged key's value.
					text: maskSecrets(diff).text,
				},
			],
			signal: abort.signal,
			onPartial: (t) => {
				partial = t.trim();
				onPartial(partial);
			},
		});
		return text.trim();
	} catch (error) {
		if (abort.signal.aborted) return partial;
		throw error;
	} finally {
		running.delete(abort);
	}
}

/** Stops every commit message being written; false when none was. */
export function cancelCommitMessage(): boolean {
	if (running.size === 0) return false;
	for (const abort of running) abort.abort();
	return true;
}
