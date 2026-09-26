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
});
export type SearchFile = z.infer<typeof SearchFileSchema>;

export const SearchResultSchema = z.object({
	files: z.array(SearchFileSchema),
	matchCount: z.number().int(),
	/** Stopped at the match limit; refine the query to see everything. */
	truncated: z.boolean(),
	durationMs: z.number(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const searchChannels = defineChannels({
	/** Runs ripgrep in the open folder. A newer search cancels the previous one. */
	'search:run': { input: SearchQuerySchema, output: SearchResultSchema },
	/** Every file in the open folder (gitignore-aware), for Quick Open. */
	'search:files': {
		input: z.void(),
		output: z.object({ files: z.array(z.string()), truncated: z.boolean() }),
	},
});
