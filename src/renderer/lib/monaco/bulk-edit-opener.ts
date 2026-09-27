// Kept free of Monaco imports (like workspace-root.ts): the editor module registers the opener
// at startup, and importing Monaco here would pull it into the main bundle.
import type * as Monaco from 'monaco-editor';

/** Opens a workspace file as an editor buffer (without stealing the view) and returns its model. */
export type BufferOpener = (path: string) => Promise<Monaco.editor.ITextModel | null>;

let opener: BufferOpener | null = null;

/** Set by the editor module: how a refactoring gets at a file that isn't open yet. */
export function setBulkEditOpener(open: BufferOpener | null): void {
	opener = open;
}

export function getBulkEditOpener(): BufferOpener | null {
	return opener;
}
