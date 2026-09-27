import type { JSX } from 'react';

import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import type { ReplaceAllPrompt } from './use-replace';

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "Replace N occurrences in M files?" before Replace All touches every listed file. */
export function ReplaceAllDialog({
	prompt,
	replacement,
	onAnswer,
}: {
	prompt: ReplaceAllPrompt | null;
	replacement: string;
	onAnswer: (ok: boolean) => void;
}): JSX.Element {
	const shown = replacement === '' ? 'nothing (delete the matches)' : `"${replacement}"`;
	return (
		<Dialog
			open={prompt !== null}
			onOpenChange={(open) => !open && onAnswer(false)}
			title={
				prompt
					? `Replace ${plural(prompt.matches, 'occurrence')} in ${plural(prompt.files, 'file')}?`
					: ''
			}
			description={
				<>
					Every listed match is replaced with {shown}. Files open in the editor change in
					their tab (unsaved, Ctrl+Z undoes it); other files are written to disk.
					{prompt?.partial &&
						' The search stopped early, so only the listed matches are replaced.'}
				</>
			}
			width='sm'
			footer={
				<>
					<Button variant='ghost' autoFocus onClick={() => onAnswer(false)}>
						Cancel
					</Button>
					<Button variant='primary' onClick={() => onAnswer(true)}>
						Replace All
					</Button>
				</>
			}
		/>
	);
}
