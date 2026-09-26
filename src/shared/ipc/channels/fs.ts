import { z } from 'zod';

import { defineChannels } from '../define';

/** Workspace-relative, '/'-separated. '' is the workspace root. */
export const RelPathSchema = z.string().max(4096);

export const FsEntrySchema = z.object({
	name: z.string(),
	path: z.string(),
	/** What the entry resolves to; 'symlink' only for a link whose target is missing. */
	kind: z.enum(['file', 'dir', 'symlink']),
	/** Reached through a symlink or junction (shown with a link badge; kind is the target's). */
	isLink: z.boolean(),
	size: z.number(),
	mtimeMs: z.number(),
});
export type FsEntry = z.infer<typeof FsEntrySchema>;

export const TextEncodingSchema = z.enum(['utf8', 'windows-1252']);
export type TextEncoding = z.infer<typeof TextEncodingSchema>;

export const FileContentSchema = z.object({
	path: z.string(),
	content: z.string(),
	size: z.number(),
	mtimeMs: z.number(),
	/** Binary or too large: content is empty and the editor shows a notice instead. */
	binary: z.boolean(),
	tooLarge: z.boolean(),
	eol: z.enum(['\n', '\r\n']),
	/** Started with a UTF-8 BOM (stripped from content); pass it back on save to keep it. */
	bom: z.boolean(),
	/** 'windows-1252' when the bytes are not valid UTF-8; pass it back on save to keep them. */
	encoding: TextEncodingSchema,
});
export type FileContent = z.infer<typeof FileContentSchema>;

export const fsChannels = defineChannels({
	'fs:list': { input: RelPathSchema, output: z.array(FsEntrySchema) },
	'fs:readFile': { input: RelPathSchema, output: FileContentSchema },
	'fs:writeFile': {
		input: z.object({
			path: RelPathSchema,
			content: z.string().max(50 * 1024 * 1024),
			/** If set and the file changed on disk since, the write fails with FS_CONFLICT. */
			expectedMtimeMs: z.number().optional(),
			/** Prepend a UTF-8 BOM (the file had one when it was read). */
			bom: z.boolean().optional(),
			/** Encoding the file was read with (default UTF-8). */
			encoding: TextEncodingSchema.optional(),
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
