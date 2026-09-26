import { QueryClientProvider } from '@tanstack/react-query';
import type { JSX } from 'react';

import { queryClient } from '../lib/query-client';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Toaster } from '../ui/Toast';
import { TooltipProvider } from '../ui/Tooltip';
import { AppShell } from './AppShell';

export function App(): JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<ErrorBoundary name='Anvil'>
					<AppShell />
				</ErrorBoundary>
				<Toaster />
			</TooltipProvider>
		</QueryClientProvider>
	);
}
