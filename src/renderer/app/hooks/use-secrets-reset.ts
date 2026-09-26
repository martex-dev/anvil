import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';

/**
 * Main reset an unreadable secrets file on its first read: say so, since saved API keys are
 * gone. Nothing to invalidate, as every key query already saw the reset (empty) state.
 */
export function useSecretsReset(): void {
	useAnvilEvent('secrets:reset', () => {
		toast.warn(
			'Saved API keys could not be read',
			'The encrypted keys file was damaged and has been reset. Re-enter your keys in Settings → API Keys.',
		);
	});
}
