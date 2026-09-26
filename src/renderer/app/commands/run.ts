import { rlog } from '../../lib/log';
import { toast } from '../../stores/toast-store';
import type { Command } from './types';

/**
 * Commands are registered here at startup (see all.ts). Kept as a plain module-level list so
 * features can run each other's commands by id without importing each other.
 */
let registry: readonly Command[] = [];

export function setCommands(commands: readonly Command[]): void {
	const seen = new Set<string>();
	for (const c of commands) {
		if (seen.has(c.id)) throw new Error(`Duplicate command id: ${c.id}`);
		seen.add(c.id);
	}
	registry = commands;
}

export function getCommands(): readonly Command[] {
	return registry;
}

export async function runCommand(command: Command): Promise<void> {
	try {
		await command.run();
	} catch (error) {
		rlog.error('commands', `command ${command.id} failed`, error);
		toast.error(`${command.title} failed`, error instanceof Error ? error.message : undefined);
	}
}

export function runCommandById(id: string): void {
	const command = registry.find((c) => c.id === id);
	if (command) void runCommand(command);
	else toast.error('Unknown command', id);
}

export function shortcutFor(id: string): string | undefined {
	return registry.find((c) => c.id === id)?.shortcut;
}
