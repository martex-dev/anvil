import { z } from 'zod';

import { defineChannels } from '../define';

/** Workspace-relative, '/'-separated. '' is the workspace root. */
export const RelPathSchema = z.string().max(4096);

export const FsEntrySchema = z.object({
	name: z.string(),
	path: z.string(),
	kind: z.enum(['file', 'dir', 'symlink']),
	size: z.number(),
	mtimeMs: z.number(),
});
export type FsEntry = z.infer<typeof FsEntrySchema>;

export const FileContentSchema = z.object({
	path: z.string(),
	content: z.string(),
	size: z.number(),
	mtimeMs: z.number(),
	/** Binary or too large: content is empty and the editor shows a notice instead. */
	binary: z.boolean(),
	tooLarge: z.boolean(),
	eol: z.enum(['\n', '\r\n']),
});
export type FileContent = z.infer<typeof FileContentSchema>;

/** Metadata only, for callers (Monaco's file service) that must not read the whole file. */
export const FsStatSchema = z.object({
	kind: z.enum(['file', 'dir']),
	size: z.number(),
	mtimeMs: z.number(),
	ctimeMs: z.number(),
});
export type FsStat = z.infer<typeof FsStatSchema>;

export const fsChannels = defineChannels({
	'fs:list': { input: RelPathSchema, output: z.array(FsEntrySchema) },
	'fs:readFile': { input: RelPathSchema, output: FileContentSchema },
	'fs:stat': { input: RelPathSchema, output: FsStatSchema },
	'fs:writeFile': {
		input: z.object({
			path: RelPathSchema,
			content: z.string().max(50 * 1024 * 1024),
			/** If set and the file changed on disk since, the write fails with FS_CONFLICT. */
			expectedMtimeMs: z.number().optional(),
		}),
		output: z.object({ mtimeMs: z.number() }),
	},
	'fs:create': {
		input: z.object({ parent: RelPathSchema, name: z.string(), kind: z.enum(['file', 'dir']) }),
		output: FsEntrySchema,
	},
	'fs:rename': {
		input: z.object({ path: RelPathSchema.min(1), newName: z.string() }),
		output: FsEntrySchema,
	},
	/** Moves to the Recycle Bin — never a permanent delete. */
	'fs:trash': { input: RelPathSchema.min(1), output: z.void() },
	'fs:reveal': { input: RelPathSchema, output: z.void() },
	/** Images (plots, charts) as data: URLs for the image viewer. Capped at 25 MB. */
	'fs:readDataUrl': {
		input: RelPathSchema.min(1),
		output: z.object({ url: z.string(), size: z.number() }),
	},
	'fs:copyPath': {
		input: z.object({ path: RelPathSchema, absolute: z.boolean() }),
		output: z.string(),
	},
});

export const fsEvents = {
	/** Directories whose listing changed and files whose content changed, workspace-relative. */
	'fs:changed': z.object({ dirs: z.array(z.string()), files: z.array(z.string()) }),
};
