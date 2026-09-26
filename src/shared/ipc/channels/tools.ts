import { z } from 'zod';

import { defineChannels } from '../define';

/** Local file history, detected tasks and project templates. */

export const SnapshotSchema = z.object({
	id: z.string(),
	/** Epoch ms. */
	time: z.number(),
	size: z.number().int(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const TaskSchema = z.object({
	id: z.string(),
	label: z.string(),
	command: z.string(),
	source: z.enum(['npm', 'python', 'make', 'just', 'uv']),
	detail: z.string().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TemplateSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	tags: z.array(z.string()),
	files: z.array(z.string()),
});
export type Template = z.infer<typeof TemplateSchema>;

/**
 * A new project's folder name, which uv also uses as the PEP 508 package name: it must start
 * and end with a letter or digit (Windows strips a trailing dot) and can't be a reserved
 * Windows device name. The dialog validates with this same schema.
 */
export const ProjectNameSchema = z
	.string()
	.min(1, 'Enter a project name')
	.max(64, 'At most 64 characters')
	.regex(/^[A-Za-z0-9._-]*$/, 'Letters, digits, dot, dash and underscore only')
	.regex(/^[A-Za-z0-9](?:.*[A-Za-z0-9])?$/, 'Start and end with a letter or digit')
	.refine(
		(name) => !/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(name),
		'That name is reserved by Windows',
	);

const RelPath = z.string().min(1).max(4096);

export const toolsChannels = defineChannels({
	'history:list': { input: RelPath, output: z.array(SnapshotSchema) },
	'history:read': {
		input: z.object({ path: RelPath, id: z.string().regex(/^\d{13}-[a-f0-9]{8}$/) }),
		output: z.object({ content: z.string() }),
	},
	'history:clear': { input: RelPath, output: z.void() },

	'tasks:list': { input: z.void(), output: z.array(TaskSchema) },

	'templates:list': { input: z.void(), output: z.array(TemplateSchema) },
	/** Asks for a parent folder and creates `<parent>/<name>` from the template; the renderer opens it. */
	'templates:create': {
		input: z.object({
			templateId: z.string().min(1).max(64),
			name: ProjectNameSchema,
		}),
		output: z.object({ root: z.string().nullable() }),
	},
});
