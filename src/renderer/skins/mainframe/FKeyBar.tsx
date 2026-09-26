import { type JSX, useEffect, useState } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import { windowActions } from '../../app/hooks/use-window-state';
import { FKey } from './FKey';

/** The ten keys, each running a real command (ids from app/commands and features/*). */
const KEYS: ReadonlyArray<{ word: string; label: string; command: string }> = [
	{ word: 'Help', label: 'Keyboard shortcuts', command: 'anvil.shortcuts' },
	{ word: 'Save', label: 'Save file', command: 'file.save' },
	{ word: 'Find', label: 'Search in files', command: 'view.search' },
	{ word: 'Split', label: 'Split editor right', command: 'view.splitEditor' },
	{ word: 'Run', label: 'Run Python file', command: 'python.runFile' },
	{ word: 'Term', label: 'Toggle terminal', command: 'view.toggleTerminal' },
	{ word: 'Git', label: 'Source control', command: 'view.git' },
	{ word: 'AI', label: 'Toggle AI assistant', command: 'view.toggleAi' },
	{ word: 'Menu', label: 'Command palette', command: 'view.palette' },
];

/** How long "10 Quit" stays armed before a second press is needed again. */
const ARM_MS = 2500;

/**
 * The bottom key bar of a 1990s file manager. Every cap is clickable. 10 Quit closes the
 * window, but only on a second press while it flashes "Sure?", so a stray click can't.
 */
export function FKeyBar(): JSX.Element {
	const [armed, setArmed] = useState(false);
	useEffect(() => {
		if (!armed) return;
		const id = setTimeout(() => setArmed(false), ARM_MS);
		return () => clearTimeout(id);
	}, [armed]);
	return (
		<nav aria-label='Function keys' data-part='fkeybar' className='mf-fkeybar'>
			{KEYS.map((k, i) => (
				<FKey
					key={k.command}
					n={i + 1}
					word={k.word}
					label={k.label}
					shortcut={shortcutFor(k.command)}
					onClick={() => runCommandById(k.command)}
				/>
			))}
			<FKey
				n={10}
				word={armed ? 'Sure?' : 'Quit'}
				label={armed ? 'Press again to close Anvil' : 'Quit (press twice)'}
				armed={armed}
				onClick={() => (armed ? windowActions.close() : setArmed(true))}
			/>
		</nav>
	);
}
