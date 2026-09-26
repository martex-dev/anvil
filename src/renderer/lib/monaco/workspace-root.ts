// Kept free of Monaco imports: the editor module sets this at startup, and pulling the VS Code
// API into the main bundle would defeat loading Monaco lazily.

let workspaceRoot: string | null = null;

/** The open folder, as Monaco's file service should see it (set by the editor module). */
export function setMonacoWorkspaceRoot(root: string | null): void {
	workspaceRoot = root ? root.replace(/\\/g, '/').replace(/\/+$/, '') : null;
}

/** file:///c%3A/proj/src/a.py → "src/a.py" when inside the open folder, else null. */
export function toWorkspacePath(uri: { scheme: string; fsPath: string }): string | null {
	if (uri.scheme !== 'file' || !workspaceRoot) return null;
	const path = uri.fsPath.replace(/\\/g, '/');
	const root = `${workspaceRoot.toLowerCase()}/`;
	if (!path.toLowerCase().startsWith(root)) return null;
	return path.slice(root.length);
}
