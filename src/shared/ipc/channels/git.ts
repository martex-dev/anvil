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
/**
 * Path lists go to git in command-line-sized batches, so Stage All on a fresh checkout with tens
 * of thousands of files works.
 */
const RepoPaths = z.array(RepoPath).max(100_000);

export const GitCommitSchema = z.object({
	hash: z.string(),
	author: z.string(),
	/** Epoch ms. */
	date: z.number(),
	message: z.string(),
	refs: z.string(),
	/** File history only: the file's repo path in this commit, and its old path if renamed here. */
	path: z.string().optional(),
	from: z.string().optional(),
});
export type GitCommit = z.infer<typeof GitCommitSchema>;

export const GitStashSchema = z.object({
	/** n of stash@{n}; 0 is the newest. */
	index: z.number().int(),
	message: z.string(),
	/** Epoch ms. */
	date: z.number(),
});
export type GitStash = z.infer<typeof GitStashSchema>;

const StashIndex = z.object({ index: z.number().int().min(0).max(10_000) });

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
	'git:stage': { input: RepoPaths.min(1), output: z.void() },
	/** Pass a staged rename's `from` too, or the old path's deletion stays staged. */
	'git:unstage': { input: RepoPaths.min(1), output: z.void() },
	/**
	 * Throws away working-tree changes: `tracked` files go back to their staged (index) version,
	 * `untracked` files are deleted.
	 */
	'git:discard': {
		input: z
			.object({ tracked: RepoPaths, untracked: RepoPaths })
			.refine((d) => d.tracked.length + d.untracked.length > 0, 'No paths to discard'),
		output: z.void(),
	},
	/** `git init` in the open folder. */
	'git:init': { input: z.void(), output: z.void() },
	/** Which of these files still contain conflict markers (<<<<<<<, =======, >>>>>>>). */
	'git:conflictMarkers': { input: RepoPaths.min(1).max(5000), output: z.array(z.string()) },
	'git:commit': {
		input: z.object({
			message: z.string().trim().min(1).max(20_000),
			/** Replace the last commit (message and staged changes) instead of adding one. */
			amend: z.boolean().optional(),
		}),
		output: z.object({ hash: z.string() }),
	},
	/** Full message of HEAD (to prefill an amend); null before the first commit. */
	'git:lastCommitMessage': {
		input: z.void(),
		output: z.object({ message: z.string().nullable() }),
	},
	'git:pull': { input: z.void(), output: z.object({ summary: z.string() }) },
	'git:push': { input: z.void(), output: z.object({ summary: z.string() }) },
	/**
	 * `git fetch --all --prune`. `background` (the periodic auto-fetch) never opens a sign-in
	 * window; a fetch that needs credentials just fails.
	 */
	'git:fetch': {
		input: z.object({ background: z.boolean().optional() }),
		output: z.object({ summary: z.string() }),
	},
	/** Stashes every change, untracked files included (VS Code's "Stash (Include Untracked)"). */
	'git:stash': {
		input: z.object({ message: z.string().trim().max(500).optional() }),
		output: z.void(),
	},
	'git:stashList': { input: z.void(), output: z.array(GitStashSchema) },
	'git:stashApply': { input: StashIndex, output: z.void() },
	'git:stashPop': { input: StashIndex, output: z.void() },
	'git:stashDrop': { input: StashIndex, output: z.void() },
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
		input: z.object({
			limit: z.number().int().min(1).max(500),
			/** Relative to the open folder: only commits touching that file, following renames. */
			path: z.string().min(1).max(4096).optional(),
		}),
		output: z.array(GitCommitSchema),
	},
	/**
	 * A file (repo path) as it was in a commit, or in the commit's first parent. null when it
	 * didn't exist there; binary or oversized files come back as `binary`.
	 */
	'git:show': {
		input: z.object({
			hash: z.string().regex(/^[0-9a-f]{4,64}$/, 'Not a commit hash'),
			path: RepoPath,
			parent: z.boolean().optional(),
		}),
		output: z.object({ content: z.string().nullable(), binary: z.boolean() }),
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
