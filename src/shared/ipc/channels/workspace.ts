import { z } from 'zod';

import { defineChannels } from '../define';

export const WorkspaceInfoSchema = z.object({
	/** Absolute path of the open folder, or null when none is open. */
	root: z.string().nullable(),
	name: z.string().nullable(),
	recent: z.array(z.string()),
});
export type WorkspaceInfo = z.infer<typeof WorkspaceInfoSchema>;

export const workspaceChannels = defineChannels({
	'workspace:get': { input: z.void(), output: WorkspaceInfoSchema },
	/** Shows the native folder picker; unchanged result if cancelled. */
	'workspace:openDialog': { input: z.void(), output: WorkspaceInfoSchema },
	'workspace:open': { input: z.string().min(1).max(1024), output: WorkspaceInfoSchema },
	'workspace:close': { input: z.void(), output: WorkspaceInfoSchema },
	'workspace:forgetRecent': { input: z.string().min(1).max(1024), output: WorkspaceInfoSchema },
});

export const workspaceEvents = {
	'workspace:changed': WorkspaceInfoSchema,
};
