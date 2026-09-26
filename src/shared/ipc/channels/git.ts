import { z } from 'zod';

import { SecretFindingSchema } from '../../secret-scan';
import { defineChannels } from '../define';

export const GitChangeKindSchema = z.enum([
	'modified',
	'added',
	'deleted',
	'renamed',
	'untracked',
	'conflicted',
]);
export type GitChangeKind = z.infer<typeof GitChangeKindSchema>;

export const GitChangeSchema = z.object({
	/** Repo-relative, '/'-separated. */
	path: z.string(),
	/** Original path for renames. */
	from: z.string().optional(),
	kind: GitChangeKindSchema,
	/** Same file relative to the open folder (null if it lies outside it). */
	workspacePath: z.string().nullable(),
});
export type GitChange = z.infer<typeof GitChangeSchema>;

export const GitStatusSchema = z.object({
	isRepo: z.boolean(),
	branch: z.string().nullable(),
	detached: z.boolean(),
	tracking: z.string().nullable(),
	ahead: z.number().int(),
	behind: z.number().int(),
	staged: z.array(GitChangeSchema),
	unstaged: z.array(GitChangeSchema),
});
export type GitStatus = z.infer<typeof GitStatusSchema>;

const RepoPath = z.string().min(1).max(4096);

export const GitCommitSchema = z.object({
	hash: z.string(),
	author: z.string(),
	/** Epoch ms. */
	date: z.number(),
	message: z.string(),
	refs: z.string(),
});
export type GitCommit = z.infer<typeof GitCommitSchema>;

export const GitBlameSchema = z.object({
	hash: z.string(),
	author: z.string(),
	date: z.number(),
	summary: z.string(),
});
export type GitBlame = z.infer<typeof GitBlameSchema>;

export const gitChannels = defineChannels({
	'git:status': { input: z.void(), output: GitStatusSchema },
	'git:diff': {
		/** `from`: the old path of a staged rename (HEAD side of the diff). */
		input: z.object({ path: RepoPath, staged: z.boolean(), from: RepoPath.optional() }),
		output: z.object({
			path: z.string(),
			original: z.string(),
			modified: z.string(),
			/** Binary or too large to diff as text. */
			binary: z.boolean(),
		}),
	},
	'git:stage': { input: z.array(RepoPath).min(1).max(5000), output: z.void() },
	'git:unstage': { input: z.array(RepoPath).min(1).max(5000), output: z.void() },
	'git:commit': {
		input: z.object({ message: z.string().trim().min(1).max(20_000) }),
		output: z.object({ hash: z.string() }),
	},
	'git:pull': { input: z.void(), output: z.object({ summary: z.string() }) },
	'git:push': { input: z.void(), output: z.object({ summary: z.string() }) },
	'git:branches': {
		input: z.void(),
		output: z.object({ current: z.string().nullable(), local: z.array(z.string()) }),
	},
	'git:checkout': {
		input: z.object({ branch: z.string().min(1).max(255), create: z.boolean() }),
		output: z.void(),
	},
	/** Recent commits of HEAD, newest first. */
	'git:log': {
		input: z.object({ limit: z.number().int().min(1).max(500) }),
		output: z.array(GitCommitSchema),
	},
	/** Who last touched this line (1-based); null for uncommitted lines. */
	'git:blame': {
		input: z.object({ path: z.string().min(1).max(4096), line: z.number().int().min(1) }),
		output: GitBlameSchema.nullable(),
	},
	/** The file as committed in HEAD, for gutter change markers; null if untracked. */
	'git:headContent': {
		input: z.string().min(1).max(4096),
		output: z.object({ content: z.string().nullable() }),
	},
	/** Scans what is staged for API keys, private keys and seed phrases before committing. */
	'git:scanStaged': { input: z.void(), output: z.array(SecretFindingSchema) },
});

export const gitEvents = {
	/** Repository state changed through Anvil (stage, commit, pull…). */
	'git:changed': z.object({}),
};
