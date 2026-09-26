import type { AnvilApi } from '@shared/ipc/api';

declare global {
	interface Window {
		anvil: AnvilApi;
	}
}

export {};
