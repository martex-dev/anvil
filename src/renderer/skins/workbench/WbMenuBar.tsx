import { Menubar } from 'radix-ui';
import { type JSX, useEffect, useState } from 'react';

import { useRegisterOverlay } from '../../stores/overlay-store';
import { menuForKey, MENUS } from './menus';
import { WbMenu } from './WbMenu';

/**
 * File Edit View Go Run AI Git Tools. Arrow keys walk the bar (Radix Menubar); Alt+<letter>
 * opens a menu by its underlined mnemonic and F10 opens File, as on the desktop of the era.
 */
export function WbMenuBar(): JSX.Element {
	const [open, setOpen] = useState('');
	useRegisterOverlay(open !== '');

	useEffect(() => {
		const onKey = (e: KeyboardEvent): void => {
			// Terminals keep their own Alt chords (readline word motions).
			if (e.target instanceof Element && e.target.closest('.xterm')) return;
			// Autofill and some synthetic events arrive without a key.
			if (typeof e.key !== 'string') return;
			const plainAlt = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
			const menu =
				e.key === 'F10' && !e.altKey && !e.ctrlKey && !e.shiftKey
					? MENUS[0]
					: plainAlt && e.key.length === 1
						? menuForKey(e.key)
						: undefined;
			if (!menu) return;
			e.preventDefault();
			e.stopPropagation();
			setOpen(menu.label);
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, []);

	return (
		<Menubar.Root
			value={open}
			onValueChange={setOpen}
			loop
			data-part='menubar'
			aria-label='Menu'
			className='wb-menubar'
		>
			{MENUS.map((menu) => (
				<WbMenu key={menu.label} menu={menu} />
			))}
		</Menubar.Root>
	);
}
