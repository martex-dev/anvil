import { AnvilError } from '../errors';

/** Readable reasons for the errno codes users actually hit (locked by Excel, read-only...). */
const REASONS: Record<string, { code: string; reason: string }> = {
	EBUSY: { code: 'FS_LOCKED', reason: 'it is open in another program' },
	EPERM: { code: 'FS_PERMISSION', reason: 'it is locked or you do not have permission' },
	EACCES: { code: 'FS_PERMISSION', reason: 'permission denied' },
	ENOENT: { code: 'FS_NOT_FOUND', reason: 'it no longer exists' },
	ENOSPC: { code: 'FS_DISK_FULL', reason: 'the disk is full' },
	EROFS: { code: 'FS_READ_ONLY', reason: 'the drive is read-only' },
	EEXIST: { code: 'FS_EXISTS', reason: 'the target already exists' },
	ENOTEMPTY: { code: 'FS_EXISTS', reason: 'the target folder is not empty' },
	EISDIR: { code: 'FS_NOT_A_FILE', reason: 'it is a folder' },
	ENAMETOOLONG: { code: 'FS_BAD_NAME', reason: 'the path is too long' },
};

/**
 * Turns a Node fs error into an AnvilError that names the workspace-relative path, so the user
 * sees `Cannot save "data.csv": it is open in another program` instead of `EBUSY: ... 'C:\Users\...'`.
 * AnvilErrors pass through unchanged; the original error is kept as the cause for the log.
 */
export function mapFsError(error: unknown, rel: string, action: string): AnvilError {
	if (error instanceof AnvilError) return error;
	const errno =
		error instanceof Error && 'code' in error && typeof error.code === 'string'
			? error.code
			: '';
	const known = REASONS[errno];
	const name = `"${rel || '.'}"`;
	if (known)
		return new AnvilError(known.code, `Cannot ${action} ${name}: ${known.reason}`, error);
	return new AnvilError(
		'FS_FAILED',
		`Cannot ${action} ${name}${errno ? ` (${errno})` : ''}`,
		error,
	);
}
