/** Query key for the detected tasks of a folder (main's tasks:list). */
export const tasksKey = (root: string | null): readonly ['tasks', string | null] =>
	['tasks', root] as const;

/** Top-level files main's task detection reads (scripts, runners, lock files, test config). */
const TASK_FILES = new Set([
	'package.json',
	'pnpm-lock.yaml',
	'yarn.lock',
	'bun.lock',
	'bun.lockb',
	'pyproject.toml',
	'uv.lock',
	'pytest.ini',
	'requirements.txt',
	'makefile',
	'justfile',
	'.justfile',
]);

/**
 * Whether a watcher batch can change the task list: a task source edited, or anything added or
 * removed at the top level (a new `tests/` folder or `train.py`). Paths are root-relative.
 */
export function touchesTaskFiles(batch: {
	dirs: readonly string[];
	files: readonly string[];
}): boolean {
	return (
		batch.dirs.includes('') ||
		batch.files.some((f) => !f.includes('/') && TASK_FILES.has(f.toLowerCase()))
	);
}
