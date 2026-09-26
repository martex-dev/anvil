import {
	ArrowDownUp,
	ArrowUpDown,
	ClipboardCopy,
	FileText,
	PanelRight,
	RefreshCw,
	Search,
	X,
} from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { toast } from '../../stores/toast-store';
import { activeDataViewer, type DataViewerActions } from './data-actions';

function onActiveTable(action: (viewer: DataViewerActions) => void): () => void {
	return () => {
		const viewer = activeDataViewer();
		if (viewer) action(viewer);
		else toast.info('Open a data file in the table viewer first');
	};
}

const KEYWORDS = ['table', 'csv', 'parquet', 'grid', 'dataframe'];

export const DATA_COMMANDS: Command[] = [
	{
		id: 'data.focusFilter',
		title: 'Filter Table Rows',
		category: 'Data',
		keywords: [...KEYWORDS, 'search', 'find'],
		icon: Search,
		run: onActiveTable((v) => v.focusFilter()),
	},
	{
		id: 'data.clearFilter',
		title: 'Clear Table Filter',
		category: 'Data',
		keywords: KEYWORDS,
		icon: X,
		run: onActiveTable((v) => v.clearFilter()),
	},
	{
		id: 'data.sortBySelection',
		title: 'Sort Table by Selected Column',
		category: 'Data',
		keywords: [...KEYWORDS, 'order', 'ascending', 'descending'],
		icon: ArrowDownUp,
		run: onActiveTable((v) => v.sortBySelection()),
	},
	{
		id: 'data.clearSort',
		title: 'Clear Table Sort',
		category: 'Data',
		keywords: [...KEYWORDS, 'order'],
		icon: ArrowUpDown,
		run: onActiveTable((v) => v.clearSort()),
	},
	{
		id: 'data.copyCsv',
		title: 'Copy Table Selection (or Visible Rows) as CSV',
		category: 'Data',
		keywords: [...KEYWORDS, 'clipboard', 'export'],
		icon: ClipboardCopy,
		run: onActiveTable((v) => v.copyCsv()),
	},
	{
		id: 'data.reload',
		title: 'Reload Table from Disk',
		category: 'Data',
		keywords: [...KEYWORDS, 'refresh'],
		icon: RefreshCw,
		run: onActiveTable((v) => v.reload()),
	},
	{
		id: 'data.toggleProfile',
		title: 'Toggle Column Profile',
		category: 'Data',
		keywords: [...KEYWORDS, 'stats', 'histogram'],
		icon: PanelRight,
		run: onActiveTable((v) => v.toggleProfile()),
	},
	{
		id: 'data.openAsText',
		title: 'Open Table as Text',
		category: 'Data',
		keywords: [...KEYWORDS, 'raw', 'source'],
		icon: FileText,
		run: onActiveTable((v) => v.openAsText()),
	},
];
