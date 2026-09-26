import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Task } from '@shared/ipc/channels/tools';

import type { MainFeature } from '../../core/features';

function read(root: string, name: string): string | null {
	try {
		return readFileSync(join(root, name), 'utf8');
	} catch {
		return null;
	}
}

/** The body of one `[section]` of a TOML file, up to the next table header. */
export function tomlSection(toml: string, section: string): string | null {
	const lines = toml.split(/\r?\n/);
	const start = lines.findIndex((l) => l.trim() === `[${section}]`);
	if (start === -1) return null;
	const body: string[] = [];
	for (const line of lines.slice(start + 1)) {
		if (/^\s*\[/.test(line)) break;
		body.push(line);
	}
	return body.join('\n');
}

/** Keys of `key = ...` lines (quoted or bare). */
export function tomlKeys(body: string): string[] {
	const keys: string[] = [];
	for (const line of body.split('\n')) {
		const m = /^\s*"?([A-Za-z0-9_.-]+)"?\s*=/.exec(line);
		if (m?.[1]) keys.push(m[1]);
	}
	return keys;
}

export function makeTargets(makefile: string): string[] {
	const targets: string[] = [];
	for (const line of makefile.split(/\r?\n/)) {
		const m = /^([A-Za-z0-9][\w.-]*)\s*:(?!=)/.exec(line);
		if (m?.[1] && !targets.includes(m[1])) targets.push(m[1]);
	}
	return targets;
}

const JUST_KEYWORDS = new Set(['set', 'export', 'alias', 'import', 'mod']);

export function justRecipes(justfile: string): string[] {
	const recipes: string[] = [];
	for (const line of justfile.split(/\r?\n/)) {
		const m = /^@?([A-Za-z0-9][\w-]*)(?:\s+[^:]*)?:(?!=)/.exec(line);
		if (m?.[1] && !JUST_KEYWORDS.has(m[1]) && !recipes.includes(m[1])) recipes.push(m[1]);
	}
	return recipes;
}

/** Runnable things a project declares: npm scripts, pyproject scripts/poe tasks, make, just. */
export function detectTasks(root: string): Task[] {
	const tasks: Task[] = [];
	const add = (task: Omit<Task, 'id'>): void => {
		tasks.push({ ...task, id: `${task.source}:${task.label}` });
	};

	const pkg = read(root, 'package.json');
	if (pkg) {
		try {
			const scripts = (JSON.parse(pkg) as { scripts?: Record<string, string> }).scripts ?? {};
			const runner = existsSync(join(root, 'pnpm-lock.yaml'))
				? 'pnpm'
				: existsSync(join(root, 'yarn.lock'))
					? 'yarn'
					: existsSync(join(root, 'bun.lockb'))
						? 'bun run'
						: 'npm run';
			for (const [name, script] of Object.entries(scripts)) {
				add({ label: name, command: `${runner} ${name}`, source: 'npm', detail: script });
			}
		} catch {
			// A broken package.json just has no tasks.
		}
	}

	const pyproject = read(root, 'pyproject.toml');
	const uv = existsSync(join(root, 'uv.lock'));
	const prefix = uv ? 'uv run ' : '';
	if (pyproject) {
		for (const name of tomlKeys(tomlSection(pyproject, 'project.scripts') ?? '')) {
			add({
				label: name,
				command: `${prefix}${name}`,
				source: uv ? 'uv' : 'python',
				detail: 'project.scripts',
			});
		}
		for (const name of tomlKeys(tomlSection(pyproject, 'tool.poe.tasks') ?? '')) {
			add({
				label: name,
				command: `${prefix}poe ${name}`,
				source: 'python',
				detail: 'poe task',
			});
		}
	}
	const hasTests =
		existsSync(join(root, 'tests')) ||
		(pyproject?.includes('[tool.pytest') ?? false) ||
		existsSync(join(root, 'pytest.ini'));
	if (hasTests && (pyproject || existsSync(join(root, 'requirements.txt')))) {
		add({
			label: 'pytest',
			command: `${prefix}pytest -q`,
			source: uv ? 'uv' : 'python',
			detail: 'run the test suite',
		});
	}
	if (pyproject && /\[tool\.ruff/.test(pyproject)) {
		add({
			label: 'ruff check',
			command: `${prefix}ruff check .`,
			source: uv ? 'uv' : 'python',
			detail: 'lint',
		});
		add({
			label: 'ruff format',
			command: `${prefix}ruff format .`,
			source: uv ? 'uv' : 'python',
			detail: 'format',
		});
	}
	if (uv)
		add({
			label: 'uv sync',
			command: 'uv sync',
			source: 'uv',
			detail: 'install the locked dependencies',
		});

	const makefile = read(root, 'Makefile') ?? read(root, 'makefile');
	if (makefile)
		for (const t of makeTargets(makefile))
			add({ label: t, command: `make ${t}`, source: 'make', detail: null });

	const justfile = read(root, 'justfile') ?? read(root, 'Justfile') ?? read(root, '.justfile');
	if (justfile)
		for (const r of justRecipes(justfile))
			add({ label: r, command: `just ${r}`, source: 'just', detail: null });

	// Notebook-style scripts at the top level are common entry points in research repos.
	try {
		for (const name of readdirSync(root)) {
			if (/^(main|train|backtest|run|app)\.py$/.test(name)) {
				add({
					label: name,
					command: uv ? `uv run python ${name}` : `python ${name}`,
					source: 'python',
					detail: 'entry point',
				});
			}
		}
	} catch {
		// Unreadable folder: no extra tasks.
	}
	return tasks;
}

export const tasksFeature: MainFeature = {
	id: 'tasks',
	activate(ctx) {
		ctx.ipc.handle('tasks:list', () => {
			const root = ctx.workspace.root();
			return root ? detectTasks(root) : [];
		});
	},
};
