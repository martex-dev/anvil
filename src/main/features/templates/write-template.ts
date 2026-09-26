import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { AnvilError, errorMessage } from '../../core/errors';
import type { TemplateDef } from './catalog';

function escapesFolder(rel: string): boolean {
	return (
		rel.includes('..') || rel.includes('\\') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)
	);
}

/**
 * Writes a template into a new folder. Never overwrites: the folder must not exist yet.
 * All-or-nothing: paths are checked before anything is written, and a failed write removes
 * the half-written folder so retrying with the same name works.
 */
export function writeTemplate(template: TemplateDef, parent: string, name: string): string {
	const root = join(parent, name);
	if (existsSync(root)) throw new AnvilError('TEMPLATE_EXISTS', `${root} already exists`);
	const files = Object.entries(template.files);
	const bad = files.find(([rel]) => escapesFolder(rel));
	if (bad)
		throw new AnvilError('TEMPLATE_BAD_PATH', `Template path escapes its folder: ${bad[0]}`);

	try {
		// Not recursive: if something created the folder since the check above, fail instead of
		// writing into (and later cleaning up) a folder we don't own.
		mkdirSync(root);
	} catch (error) {
		throw new AnvilError(
			'TEMPLATE_WRITE_FAILED',
			`Could not create ${root}: ${errorMessage(error)}`,
			error,
		);
	}
	try {
		for (const [rel, content] of files) {
			const abs = join(root, ...rel.split('/'));
			mkdirSync(dirname(abs), { recursive: true });
			writeFileSync(abs, content.replaceAll('{{name}}', name), 'utf8');
		}
	} catch (error) {
		let cleanup = '';
		try {
			rmSync(root, { recursive: true, force: true });
		} catch (rmError) {
			cleanup = ` The partial folder could not be removed: ${errorMessage(rmError)}`;
		}
		throw new AnvilError(
			'TEMPLATE_WRITE_FAILED',
			`Could not write the project: ${errorMessage(error)}.${cleanup}`,
			error,
		);
	}
	return root;
}
