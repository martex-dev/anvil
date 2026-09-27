import { readFileSync, renameSync } from 'node:fs';

/** What is on disk: nothing yet, a parsed value, or text that isn't JSON. */
export type JsonFile =
	{ kind: 'missing' } | { kind: 'ok'; value: unknown } | { kind: 'corrupt'; reason: string };

/**
 * Read errors that say nothing about the file itself: an antivirus scanner, a backup tool or
 * OneDrive has it open for a moment. The file must never be treated as corrupt for these.
 */
const TRANSIENT = new Set(['EBUSY', 'EPERM', 'EACCES', 'EAGAIN', 'EMFILE', 'ENFILE']);
const RETRY_DELAYS_MS = [25, 100];

const codeOf = (error: unknown): string =>
	error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : '';

/** Blocks briefly. Only used at startup, before any window exists, for a file that's locked. */
function sleepSync(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Reads and parses a small JSON file (settings, secrets). A locked file is retried a couple of
 * times and then the error is thrown, so the caller keeps the file instead of replacing it. A
 * UTF-8 BOM (Notepad and PowerShell 5 add one) is not an error.
 */
export function readJsonFile(
	path: string,
	delaysMs: readonly number[] = RETRY_DELAYS_MS,
): JsonFile {
	let text: string;
	for (let attempt = 0; ; attempt++) {
		try {
			text = readFileSync(path, 'utf8');
			break;
		} catch (error) {
			if (codeOf(error) === 'ENOENT') return { kind: 'missing' };
			const delay = delaysMs[attempt];
			if (delay === undefined || !TRANSIENT.has(codeOf(error))) throw error;
			sleepSync(delay);
		}
	}
	try {
		return { kind: 'ok', value: JSON.parse(text.replace(/^\uFEFF/, '')) as unknown };
	} catch (error) {
		return { kind: 'corrupt', reason: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Moves an unusable file aside for inspection, as `<name>.corrupt-<timestamp>` so an earlier
 * copy is never overwritten. Returns the new path; throws if the rename fails.
 */
export function moveAside(path: string, now: Date = new Date()): string {
	const stamp = now.toISOString().replace(/[:.]/g, '-');
	const target = `${path}.corrupt-${stamp}`;
	renameSync(path, target);
	return target;
}
