import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// IPC is local and cheap; data changes are pushed via events, not polled.
			staleTime: Infinity,
			refetchOnWindowFocus: false,
			retry: 1,
			// Every query goes over local IPC, never the network. The default ('online') pauses
			// queries whenever Chromium thinks the machine is offline, leaving panels stuck on
			// "Loading". Main handles real network failures and reports them as errors.
			networkMode: 'always',
		},
		mutations: { networkMode: 'always' },
	},
});
