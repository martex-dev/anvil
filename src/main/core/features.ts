import log from 'electron-log/main';
import type { z } from 'zod';

import type { AnvilEvent, Channel, EventPayload } from '@shared/ipc/contract';

import { emitEvent, router } from './ipc';
import type { Handler } from './ipc-router';
import type { SecretsService } from './secrets/secrets-service';
import type { SettingsStore } from './store/json-store';
import type { WorkspaceService } from './workspace/workspace-service';

export interface FeatureLogger {
	info(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	error(message: string, meta?: Record<string, unknown>): void;
}

/** What a feature gets when it starts. Everything registered here is torn down on quit. */
export interface FeatureContext {
	log: FeatureLogger;
	ipc: { handle<C extends Channel>(channel: C, handler: Handler<C>): void };
	emit<E extends AnvilEvent>(event: E, payload: EventPayload<E>): void;
	onDispose(fn: () => void | Promise<void>): void;
	/** Main-only; a secret value must never be sent to the renderer or logged. */
	getSecret(key: string): string | null;
	/** Persistent, zod-validated settings, namespaced per feature (`<id>:<key>`). */
	settings: {
		get<S extends z.ZodType>(key: string, schema: S, fallback: z.output<S>): z.output<S>;
		set<S extends z.ZodType>(key: string, schema: S, value: z.input<S>): z.output<S>;
	};
	workspace: {
		root(): string | null;
		open(path: string): void;
		onChange(listener: (root: string | null) => void): void;
	};
	/** Absolute folder under userData this feature may write to (history, temp cells…). */
	dataDir: string;
}

export interface MainFeature {
	id: string;
	activate(ctx: FeatureContext): void | Promise<void>;
}

export interface FeatureHost {
	settings: SettingsStore;
	secrets: SecretsService;
	workspace: WorkspaceService;
	dataDir: (id: string) => string;
}

type Disposer = () => void | Promise<void>;

/**
 * Starts every feature with its own context. A feature that throws on activation is logged
 * and skipped: one broken integration must not take the editor down with it.
 */
export async function startFeatures(
	features: readonly MainFeature[],
	host: FeatureHost,
): Promise<{ stopAll(): Promise<void> }> {
	const disposers: Disposer[] = [];
	for (const feature of features) {
		try {
			// Built inside the try: dataDir creates a folder, which can fail (EPERM, disk full).
			await feature.activate(createContext(feature.id, host, disposers));
		} catch (error) {
			log.scope(feature.id).error('feature failed to start', error);
		}
	}
	return {
		async stopAll() {
			for (const dispose of disposers.reverse()) {
				try {
					await dispose();
				} catch (error) {
					log.error('[features] dispose failed', error);
				}
			}
		},
	};
}

function createContext(id: string, host: FeatureHost, disposers: Disposer[]): FeatureContext {
	const scoped = log.scope(id);
	return {
		log: {
			info: (m, meta) => scoped.info(m, meta ?? ''),
			warn: (m, meta) => scoped.warn(m, meta ?? ''),
			error: (m, meta) => scoped.error(m, meta ?? ''),
		},
		ipc: {
			handle: (channel, handler) => disposers.push(router.handle(channel, handler)),
		},
		emit: emitEvent,
		onDispose: (fn) => disposers.push(fn),
		getSecret: (key) => {
			try {
				return host.secrets.get(key);
			} catch (error) {
				// Unreadable (e.g. userData copied from another Windows account): act as unset.
				scoped.warn('secret unreadable', { key, error: String(error) });
				return null;
			}
		},
		settings: {
			get: (key, schema, fallback) => host.settings.get(`${id}:${key}`, schema, fallback),
			set: (key, schema, value) => host.settings.set(`${id}:${key}`, schema, value),
		},
		workspace: {
			root: () => host.workspace.getRoot(),
			open: (path) => void host.workspace.open(path),
			onChange: (listener) =>
				disposers.push(host.workspace.onChange((info) => listener(info.root))),
		},
		dataDir: host.dataDir(id),
	};
}
