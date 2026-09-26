import { BrowserWindow, dialog } from 'electron';

import { AnvilError, errorMessage } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { TEMPLATES } from './catalog';
import { writeTemplate } from './write-template';

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
			let root: string;
			try {
				root = writeTemplate(template, parent, name);
			} catch (error) {
				ctx.log.error('creating project from template failed', {
					templateId,
					parent,
					message: errorMessage(error),
				});
				throw error;
			}
			ctx.log.info('project created from template', { templateId, root });
			// The renderer opens it, so its unsaved-changes guard applies like any folder switch.
			return { root };
		});
	},
};
