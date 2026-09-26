/** The parts of a Monaco URI needed to place it on disk. */
export interface UriLike {
	scheme: string;
	/** The server of a UNC path (file://server/share/...), else ''. */
	authority: string;
	path: string;
}

/**
 * Whether a file URI is inside the open folder. Compares normalised Windows-style paths so drive
 * roots (D:\) and network shares (\\server\share, whose server is the URI's authority) work.
 */
export function isInWorkspace(root: string, uri: UriLike): boolean {
	if (uri.scheme !== 'file') return false;
	// 'D:\' → 'd:', '\\server\share\' → '//server/share': one separator is added below.
	const base = root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
	const file = uri.authority
		? `//${uri.authority}${uri.path}`
		: // Monaco file URIs look like /c:/Users/...; drop the slash before the drive.
			uri.path.replace(/^\/([a-zA-Z]:)/, '$1');
	return file.toLowerCase().startsWith(`${base}/`);
}
