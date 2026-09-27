import { z } from 'zod';

import { defineChannels } from '../define';

export const SearchQuerySchema = z.object({
	query: z.string().min(1).max(1000),
	regex: z.boolean().default(false),
	caseSensitive: z.boolean().default(false),
	wholeWord: z.boolean().default(false),
	/** Comma-separated globs, e.g. "src/**, *.py". Empty = everything. */
	include: z.string().max(1000).default(''),
	exclude: z.string().max(1000).default(''),
});
export type SearchQuery = z.input<typeof SearchQuerySchema>;

export const SearchMatchSchema = z.object({
	/** 1-based. */
	line: z.number().int(),
	/** 1-based column of the first match on the line (UTF-16). */
	column: z.number().int(),
	/** The line (trimmed around the match when very long). */
	text: z.string(),
	/** [start, end) UTF-16 offsets into `text`. */
	ranges: z.array(z.tuple([z.number().int(), z.number().int()])),
});
export type SearchMatch = z.infer<typeof SearchMatchSchema>;

export const SearchFileSchema = z.object({
	/** Workspace-relative, '/'-separated. */
	path: z.string(),
	matches: z.array(SearchMatchSchema),
	/** Hit the per-file line cap: the file may have more matches than listed. */
	capped: z.boolean().optional(),
	/** Modification time when searched; a replace skips the file if it changed since. */
	mtimeMs: z.number().optional(),
});
export type SearchFile = z.infer<typeof SearchFileSchema>;

export const SearchResultSchema = z.object({
	files: z.array(SearchFileSchema),
	matchCount: z.number().int(),
	/** Incomplete (match limit or time limit); refine the query to see everything. */
	truncated: z.boolean(),
	/** Stopped by the time limit on a very large folder. */
	timedOut: z.boolean().optional(),
	durationMs: z.number(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const ReplaceResultSchema = z.object({
	/** Occurrences replaced. */
	replaced: z.number().int(),
	/** Files written. */
	files: z.array(z.string()),
	/** Files left alone, e.g. changed since the search, binary, or unwritable. */
	skipped: z.array(z.object({ path: z.string(), reason: z.string() })),
});
export type ReplaceResult = z.infer<typeof ReplaceResultSchema>;

const RelPath = z.string().min(1).max(4096);

export const searchChannels = defineChannels({
	/** Runs ripgrep in the open folder. A newer search cancels the previous one. */
	'search:run': { input: SearchQuerySchema, output: SearchResultSchema },
	/**
	 * The TODO scan. Same search, but its own ripgrep: Find-in-files and the scan would otherwise
	 * cancel each other. A newer scan cancels the previous scan only.
	 */
	'search:todos': { input: SearchQuerySchema, output: SearchResultSchema },
	/**
	 * Replaces the query's matches on the lines the user saw, in files on disk. A file that changed
	 * since the search (mtime, or a listed line without a match) is skipped and reported. Files open
	 * in the editor are the renderer's job: their buffers are edited in place, undoably.
	 */
	'search:replace': {
		input: z.object({
			query: SearchQuerySchema,
			replacement: z.string().max(10_000),
			files: z
				.array(
					z.object({
						path: RelPath,
						lines: z.array(z.number().int().min(1)).min(1).max(10_000),
						mtimeMs: z.number().optional(),
					}),
				)
				.min(1)
				.max(10_000),
		}),
		output: ReplaceResultSchema,
	},
	/** Every file in the open folder (gitignore-aware), for Quick Open. */
	'search:files': {
		input: z.void(),
		output: z.object({ files: z.array(z.string()), truncated: z.boolean() }),
	},
});
