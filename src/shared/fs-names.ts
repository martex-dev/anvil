const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const ILLEGAL_CHARS = /[<>:"/\\|?*]/;
const hasControlChar = (s: string): boolean => [...s].some((c) => c.charCodeAt(0) < 0x20);

/**
 * Why a single file/folder name is not allowed on Windows (the strictest target), or null.
 * Shared so the Explorer can flag a bad name while typing and main still enforces it.
 */
export function fileNameProblem(name: string): string | null {
	if (name.length === 0) return 'Name is empty';
	if (name.length > 255) return 'Name is too long';
	if (name === '.' || name === '..') return 'Name is reserved';
	if (ILLEGAL_CHARS.test(name) || hasControlChar(name))
		return 'Name contains characters Windows does not allow (<>:"/\\|?*)';
	if (RESERVED.test(name)) return `"${name}" is a reserved Windows name`;
	if (/[. ]$/.test(name)) return 'Name cannot end with a dot or space';
	return null;
}
