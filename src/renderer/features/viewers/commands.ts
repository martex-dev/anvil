import {
	ChevronsDownUp,
	Columns2,
	FileCode2,
	FilePenLine,
	RotateCw,
	Scan,
	ZoomIn,
	ZoomOut,
} from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { toast } from '../../stores/toast-store';
import { activeViewer, type ViewerActions, type ViewerKind } from './viewer-actions';

const NOUN: Record<ViewerKind, string> = {
	image: 'an image',
	notebook: 'a notebook',
	markdown: 'a Markdown preview',
	diff: 'a diff',
};

function onActive<K extends ViewerKind>(
	kind: K,
	action: (viewer: ViewerActions[K]) => void,
): () => void {
	return () => {
		const viewer = activeViewer(kind);
		if (viewer) action(viewer);
		else toast.info(`Open ${NOUN[kind]} first`);
	};
}

/** Toolbar actions of the image, notebook, Markdown and diff viewers, for the palette. */
export const VIEWER_COMMANDS: Command[] = [
	{
		id: 'image.zoomIn',
		title: 'Zoom Image In',
		category: 'View',
		keywords: ['image', 'picture', 'plot', 'magnify'],
		icon: ZoomIn,
		run: onActive('image', (v) => v.zoomIn()),
	},
	{
		id: 'image.zoomOut',
		title: 'Zoom Image Out',
		category: 'View',
		keywords: ['image', 'picture', 'plot'],
		icon: ZoomOut,
		run: onActive('image', (v) => v.zoomOut()),
	},
	{
		id: 'image.fit',
		title: 'Fit Image to Pane',
		category: 'View',
		keywords: ['image', 'picture', 'plot', 'zoom'],
		icon: Scan,
		run: onActive('image', (v) => v.fit()),
	},
	{
		id: 'image.actualSize',
		title: 'Show Image at Actual Size (1:1)',
		category: 'View',
		keywords: ['image', 'picture', 'plot', 'zoom', '100%'],
		run: onActive('image', (v) => v.actualSize()),
	},
	{
		id: 'image.reload',
		title: 'Reload Image from Disk',
		category: 'View',
		keywords: ['image', 'picture', 'plot', 'refresh'],
		icon: RotateCw,
		run: onActive('image', (v) => v.reload()),
	},
	{
		id: 'notebook.toggleOutputs',
		title: 'Collapse or Expand All Notebook Outputs',
		category: 'View',
		keywords: ['notebook', 'ipynb', 'jupyter', 'output', 'fold'],
		icon: ChevronsDownUp,
		run: onActive('notebook', (v) => v.toggleOutputs()),
	},
	{
		id: 'notebook.convert',
		title: 'Convert Notebook to # %% Script',
		category: 'Python',
		keywords: ['notebook', 'ipynb', 'jupyter', 'cells', 'export'],
		icon: FileCode2,
		run: onActive('notebook', (v) => v.convert()),
	},
	{
		id: 'notebook.reload',
		title: 'Reload Notebook from Disk',
		category: 'View',
		keywords: ['notebook', 'ipynb', 'jupyter', 'refresh'],
		icon: RotateCw,
		run: onActive('notebook', (v) => v.reload()),
	},
	{
		id: 'markdown.reload',
		title: 'Reload Markdown Preview from Disk',
		category: 'View',
		keywords: ['markdown', 'preview', 'md', 'refresh'],
		icon: RotateCw,
		run: onActive('markdown', (v) => v.reload()),
	},
	{
		id: 'markdown.editSource',
		title: 'Edit Markdown Source',
		category: 'View',
		keywords: ['markdown', 'preview', 'md', 'open'],
		icon: FilePenLine,
		run: onActive('markdown', (v) => v.editSource()),
	},
	{
		id: 'diff.toggleInline',
		title: 'Toggle Inline / Side-by-Side Diff',
		category: 'View',
		keywords: ['diff', 'compare', 'changes', 'layout'],
		icon: Columns2,
		run: onActive('diff', (v) => v.toggleInline()),
	},
];
