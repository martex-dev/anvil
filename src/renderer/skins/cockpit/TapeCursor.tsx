import type { JSX } from 'react';

import { runCommandById } from '../../app/commands/run';
import { useEditorStore } from '../../features/editor/editor-store';
import { TapeCell } from './TapeCell';

/** Caret position and the file's format fields: "LN 9 COL 1 │ SPC 4 │ UTF-8 │ CRLF │ PYTHON". */
export function TapeCursor(): JSX.Element | null {
	const cursor = useEditorStore((s) => s.cursor);
	if (!cursor) return null;
	return (
		<>
			<TapeCell onClick={() => runCommandById('go.line')} title='Go to line (Ctrl+G)'>
				<span className='ck-field-label'>LN</span>
				<span className='ck-field-value num'>{cursor.line}</span>
				<span className='ck-field-label'>COL</span>
				<span className='ck-field-value num'>{cursor.column}</span>
				{cursor.selected > 0 && (
					<>
						<span className='ck-field-label'>SEL</span>
						<span className='ck-field-accent num'>
							{cursor.selected}
							{cursor.selectedLines > 1 && `/${cursor.selectedLines}L`}
						</span>
					</>
				)}
			</TapeCell>
			<TapeCell title='Indentation'>
				<span className='ck-field-label'>{cursor.insertSpaces ? 'SPC' : 'TAB'}</span>
				<span className='ck-field-value num'>{cursor.tabSize}</span>
			</TapeCell>
			<TapeCell title='Encoding'>UTF-8</TapeCell>
			<TapeCell title='Line endings'>{cursor.eol}</TapeCell>
			<TapeCell title='Language' className='ck-cell-strong'>
				{cursor.language}
			</TapeCell>
		</>
	);
}
