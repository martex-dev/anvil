import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { installGlobalErrorHandlers } from './lib/global-errors';

import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

installGlobalErrorHandlers();

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
