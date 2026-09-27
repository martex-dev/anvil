import { existsSync, statSync } from 'node:fs';

import type { DebugTarget } from '@shared/ipc/channels/debug';

import { AnvilError } from '../../core/errors';
import { toAbsolute, toRelative } from '../../core/workspace/fs-guard';

export interface LaunchContext {
	/** The open folder: the program's working directory. */
	root: string;
	/** The interpreter main picked; the renderer never names an executable. */
	python: string;
	justMyCode: boolean;
}

function existingFile(root: string, rel: string): string {
	const abs = toAbsolute(root, rel);
	if (!existsSync(abs) || !statSync(abs).isFile())
		throw new AnvilError('DEBUG_NOT_FOUND', `File not found: ${rel}`);
	return abs;
}

/** Short title for the terminal and the toolbar. */
export function targetLabel(target: DebugTarget): string {
	switch (target.kind) {
		case 'file':
			return target.path.split('/').at(-1) ?? target.path;
		case 'module':
			return `-m ${target.module}`;
		case 'pytest':
			return target.test.split('::').at(-1) ?? target.test;
	}
}

/**
 * debugpy's `launch` arguments. Built in main so the renderer can't choose the interpreter or
 * a program outside the open folder; the relay swaps these in for whatever a launch request
 * carries.
 */
export function launchConfig(target: DebugTarget, ctx: LaunchContext): Record<string, unknown> {
	const common = {
		type: 'python',
		request: 'launch',
		name: targetLabel(target),
		python: ctx.python,
		cwd: ctx.root,
		// The program runs in an Anvil terminal (via runInTerminal), so input() works.
		console: 'integratedTerminal',
		justMyCode: ctx.justMyCode,
		showReturnValue: true,
	};
	switch (target.kind) {
		case 'file':
			return { ...common, program: existingFile(ctx.root, target.path) };
		case 'module':
			return { ...common, module: target.module };
		case 'pytest': {
			const abs = existingFile(ctx.root, target.path);
			// pytest node ids are relative to the rootdir (the cwd here) with forward slashes.
			const node = `${toRelative(ctx.root, abs)}::${target.test}`;
			return { ...common, module: 'pytest', args: [node, '-q'] };
		}
	}
}
