import { join } from 'node:path';

import { app, safeStorage } from 'electron';

import { isKnownSecret } from '@shared/secrets';

import { emitEvent, router } from '../ipc';
import { SecretsService } from './secrets-service';

/** Keys Anvil declares; e2e runs additionally get a throwaway key. */
function isDeclaredKey(key: string): boolean {
	if (process.env['ANVIL_E2E'] === '1' && key === 'e2e.test') return true;
	return isKnownSecret(key);
}

export function createSecretsService(): SecretsService {
	return new SecretsService(
		join(app.getPath('userData'), 'secrets.json'),
		safeStorage,
		isDeclaredKey,
	);
}

export function registerSecretsHandlers(secrets: SecretsService): void {
	router.handle('secrets:has', (key) => secrets.has(key));
	router.handle('secrets:listSaved', () => secrets.savedKeys());
	// Views that depend on a key (AI) refresh as soon as it's saved or removed.
	router.handle('secrets:set', ({ key, value }) => {
		secrets.set(key, value);
		emitEvent('secrets:changed', { key, saved: true });
	});
	router.handle('secrets:delete', (key) => {
		secrets.delete(key);
		emitEvent('secrets:changed', { key, saved: false });
	});
}
