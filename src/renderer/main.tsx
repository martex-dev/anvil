import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { paintSavedAppearance } from './app/hooks/use-settings';
import { installGlobalErrorHandlers } from './lib/global-errors';

import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

installGlobalErrorHandlers();

// One local IPC round trip, so the first frame already wears the saved theme.
void paintSavedAppearance().then(() =>
	createRoot(root).render(
		<StrictMode>
			<App />
		</StrictMode>,
	),
);
