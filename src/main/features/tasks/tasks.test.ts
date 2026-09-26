import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectTasks, justRecipes, makeTargets, tomlKeys, tomlSection } from './index';

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'anvil-tasks-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('parsers', () => {
	it('reads a TOML section and its keys', () => {
		const toml =
			'[project]\nname = "x"\n\n[project.scripts]\nbacktest = "q.cli:main"\n"fetch-data" = "q.data:main"\n[tool.ruff]\n';
		expect(tomlKeys(tomlSection(toml, 'project.scripts') ?? '')).toEqual([
			'backtest',
			'fetch-data',
		]);
		expect(tomlSection(toml, 'missing')).toBeNull();
	});

	it('reads make targets and just recipes, not variables', () => {
		expect(makeTargets('CC := gcc\nbuild: deps\n\tgo\ntest:\n.PHONY: x\n')).toEqual([
			'build',
			'test',
		]);
		expect(justRecipes('set shell := ["pwsh"]\nlint:\n  ruff\ntrain epochs="3":\n')).toEqual([
			'lint',
			'train',
		]);
	});
});

describe('detectTasks', () => {
	it('finds npm scripts with the right runner', () => {
		writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }));
		writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
		expect(detectTasks(dir)).toContainEqual(
			expect.objectContaining({ label: 'dev', command: 'pnpm dev', source: 'npm' }),
		);
	});

	it('prefixes Python tasks with uv run in uv projects', () => {
		writeFileSync(
			join(dir, 'pyproject.toml'),
			'[project.scripts]\nbt = "a:b"\n[tool.ruff]\n[tool.pytest.ini_options]\n',
		);
		writeFileSync(join(dir, 'uv.lock'), '');
		writeFileSync(join(dir, 'train.py'), '');
		const commands = detectTasks(dir).map((t) => t.command);
		expect(commands).toEqual(
			expect.arrayContaining([
				'uv run bt',
				'uv run pytest -q',
				'uv run ruff check .',
				'uv sync',
				'uv run python train.py',
			]),
		);
	});

	it('returns nothing for an empty folder', () => {
		expect(detectTasks(dir)).toEqual([]);
	});
});
