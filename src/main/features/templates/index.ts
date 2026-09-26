import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { BrowserWindow, dialog } from 'electron';

import { AnvilError } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { type TemplateDef, TEMPLATES } from './catalog';

/** Writes a template into a new folder. Never overwrites: the folder must not exist yet. */
export function writeTemplate(template: TemplateDef, parent: string, name: string): string {
	const root = join(parent, name);
	if (existsSync(root)) throw new AnvilError('TEMPLATE_EXISTS', `${root} already exists`);
	for (const [rel, content] of Object.entries(template.files)) {
		if (rel.includes('..') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel))
			throw new AnvilError('TEMPLATE_BAD_PATH', `Template path escapes its folder: ${rel}`);
		const abs = join(root, ...rel.split('/'));
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, content.replaceAll('{{name}}', name), 'utf8');
	}
	return root;
}

export const templatesFeature: MainFeature = {
	id: 'templates',
	activate(ctx) {
		ctx.ipc.handle('templates:list', () =>
			TEMPLATES.map((t) => ({
				id: t.id,
				name: t.name,
				description: t.description,
				tags: t.tags,
				files: Object.keys(t.files).sort(),
			})),
		);
		ctx.ipc.handle('templates:create', async ({ templateId, name }) => {
			const template = TEMPLATES.find((t) => t.id === templateId);
			if (!template)
				throw new AnvilError('TEMPLATE_UNKNOWN', `Unknown template ${templateId}`);
			const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
			const options: Electron.OpenDialogOptions = {
				title: `Where should "${name}" be created?`,
				buttonLabel: 'Create here',
				properties: ['openDirectory', 'createDirectory'],
			};
			const picked = win
				? await dialog.showOpenDialog(win, options)
				: await dialog.showOpenDialog(options);
			const parent = picked.filePaths[0];
			if (picked.canceled || !parent) return { root: null };
			const root = writeTemplate(template, parent, name);
			ctx.log.info('project created from template', { templateId, root });
			// The renderer opens it, so its unsaved-changes guard applies like any folder switch.
			return { root };
		});
	},
};
