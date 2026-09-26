import { describe, expect, it } from 'vitest';

import { languageForFile, type LanguageInfo } from './diff-language';

const registry: LanguageInfo[] = [
	{ id: 'typescript', extensions: ['.ts', '.tsx', '.mts'] },
	{ id: 'javascript', extensions: ['.js', '.jsx', '.mjs', '.cjs'] },
	{ id: 'shellscript', extensions: ['.sh', '.bash'] },
	{ id: 'dockerfile', extensions: ['.dockerfile'], filenames: ['Dockerfile'] },
	{ id: 'declaration', extensions: ['.d.ts'] },
];

describe('languageForFile', () => {
	it('uses the language registry for any extension it knows', () => {
		expect(languageForFile('App.jsx', registry)).toBe('javascript');
		expect(languageForFile('build.MJS', registry)).toBe('javascript');
		expect(languageForFile('deploy.sh', registry)).toBe('shellscript');
	});

	it('prefers exact filenames and the longest extension', () => {
		expect(languageForFile('Dockerfile', registry)).toBe('dockerfile');
		expect(languageForFile('env.d.ts', registry)).toBe('declaration');
	});

	it('falls back to a built-in table before Monaco has loaded', () => {
		expect(languageForFile('main.rs', null)).toBe('rust');
		expect(languageForFile('pyproject.toml', null)).toBe('ini');
		expect(languageForFile('notes.unknown', null)).toBeNull();
		expect(languageForFile('.gitignore', null)).toBeNull();
	});

	it('returns null when nothing claims the file', () => {
		expect(languageForFile('data.parquet', registry)).toBeNull();
	});
});
