import type { JSX } from 'react';

import { runCommandById } from '../../app/commands/run';
import { useEditorStore } from '../../features/editor/editor-store';
import { useProblems } from '../../features/problems/problems-store';
import { useLayoutStore } from '../../stores/layout-store';
import { focusedTab, useTabsStore } from '../../stores/tabs-store';
import { ColophonItem } from './ColophonItem';
import { wordsInFocusedEditor } from './word-count';

const n = (value: number): string => value.toLocaleString('en-US');

/** The document half of the colophon: name, language, position, words, problems. */
export function DocumentPhrases(): JSX.Element {
	const tab = useTabsStore(focusedTab);
	const cursor = useEditorStore((s) => s.cursor);
	// Re-render on edits too, so the word count follows the text.
	useEditorStore((s) => s.contentVersion);
	const errors = useProblems((s) => s.errors);
	const warnings = useProblems((s) => s.warnings);
	const words = cursor ? wordsInFocusedEditor() : null;
	const name = tab ? (tab.kind === 'welcome' ? 'Welcome' : tab.title) : null;
	const problems = errors + warnings;
	return (
		<>
			{name && <ColophonItem className='zn-doc'>{name}</ColophonItem>}
			{cursor && (
				<>
					<ColophonItem title='Language'>{cursor.language}</ColophonItem>
					<ColophonItem onClick={() => runCommandById('go.line')} title='Go to line'>
						ln <span className='zn-num'>{n(cursor.line)}</span>, col{' '}
						<span className='zn-num'>{cursor.column}</span>
						{cursor.selected > 0 && (
							<span className='zn-accent'>
								{' '}
								({n(cursor.selected)} selected
								{cursor.selectedWords > 0 && `, ${n(cursor.selectedWords)} words`})
							</span>
						)}
					</ColophonItem>
				</>
			)}
			{words !== null && (
				<ColophonItem title='Words in this document'>
					<span className='zn-num'>{n(words)}</span> {words === 1 ? 'word' : 'words'}
				</ColophonItem>
			)}
			<ColophonItem
				onClick={() => useLayoutStore.getState().togglePanel('problems')}
				title={`${errors} errors, ${warnings} warnings`}
				className={errors > 0 ? 'zn-errors' : ''}
			>
				{problems === 0 ? (
					'no problems'
				) : (
					<>
						<span className='zn-num'>{n(errors)}</span>{' '}
						{errors === 1 ? 'error' : 'errors'},{' '}
						<span className='zn-num'>{n(warnings)}</span>{' '}
						{warnings === 1 ? 'warning' : 'warnings'}
					</>
				)}
			</ColophonItem>
		</>
	);
}
