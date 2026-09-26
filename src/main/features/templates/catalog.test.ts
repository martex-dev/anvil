import { describe, expect, it } from 'vitest';

import { TEMPLATES } from './catalog';

const entries = TEMPLATES.flatMap((t) =>
	Object.entries(t.files).map(([path, content]) => ({ template: t.id, path, content })),
);

describe('template catalog', () => {
	it('has unique kebab-case ids', () => {
		const ids = TEMPLATES.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) {
			expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
			expect(id.length).toBeLessThanOrEqual(64);
		}
	});

	it('gives every template a name, description and tags', () => {
		for (const t of TEMPLATES) {
			expect(t.name.length).toBeGreaterThan(0);
			expect(t.description.length).toBeGreaterThan(0);
			expect(t.tags.length).toBeGreaterThan(0);
		}
	});

	it('includes README.md, .gitignore and pyproject.toml in every template', () => {
		for (const t of TEMPLATES) {
			expect(Object.keys(t.files)).toEqual(
				expect.arrayContaining(['README.md', '.gitignore', 'pyproject.toml']),
			);
		}
	});

	it('only uses relative paths that stay inside the project folder', () => {
		for (const { path } of entries) {
			expect(path).not.toContain('..');
			expect(path).not.toContain('\\');
			expect(path.startsWith('/')).toBe(false);
			expect(path).not.toMatch(/^[A-Za-z]:/);
		}
	});

	it('configures ruff for tabs and single quotes in every pyproject', () => {
		for (const t of TEMPLATES) {
			const pyproject = t.files['pyproject.toml'] ?? '';
			expect(pyproject).toContain('[tool.ruff]');
			expect(pyproject).toContain('line-length = 100');
			expect(pyproject).toContain("indent-style = 'tab'");
			expect(pyproject).toContain("quote-style = 'single'");
			expect(pyproject).toContain("ignore = ['W191', 'E101']");
			expect(pyproject).toContain("requires-python = '>=3.12'");
		}
	});

	it('contains nothing that looks like a real secret', () => {
		const secretLike = [
			/sk-[A-Za-z0-9]{8,}/,
			/AKIA[0-9A-Z]{12,}/,
			/-----BEGIN/,
			/gh[pousr]_[A-Za-z0-9]{20,}/,
			/xox[abpr]-/,
		];
		for (const { path, content } of entries) {
			for (const pattern of secretLike) expect(content, path).not.toMatch(pattern);
		}
	});

	it('leaves every key in .env.example empty', () => {
		for (const { path, content } of entries.filter((e) => e.path.endsWith('.env.example'))) {
			for (const line of content.split('\n')) {
				if (/^[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD)[A-Z_]*=/.test(line))
					expect(line, path).toMatch(/=$/);
			}
		}
	});

	it('ignores .env in every .gitignore', () => {
		for (const t of TEMPLATES) {
			const lines = (t.files['.gitignore'] ?? '').split('\n');
			expect(lines, t.id).toContain('.env');
		}
	});

	it('indents Python with tabs, not spaces', () => {
		for (const { path, content } of entries.filter((e) => e.path.endsWith('.py'))) {
			const spaced = content.split('\n').filter((line) => /^ {4}/.test(line));
			expect(spaced, path).toEqual([]);
		}
	});

	it('ends every non-empty file with a newline', () => {
		for (const { path, content } of entries) {
			if (content !== '') expect(content.endsWith('\n'), path).toBe(true);
		}
	});

	it('only uses {{name}} as a placeholder', () => {
		for (const { path, content } of entries) {
			const placeholders = content.match(/\{\{[^}]*\}\}/g) ?? [];
			for (const p of placeholders) expect(p, path).toBe('{{name}}');
		}
	});
});
