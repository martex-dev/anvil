import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, type Settings } from '@shared/settings';

import { palettePatch, resolveLook, uiFontPatch } from './look';

const with_ = (patch: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

describe('resolveLook', () => {
	it('defaults to Cyber Glass with its own fonts', () => {
		const look = resolveLook(DEFAULT_SETTINGS);
		expect(look.skin.id).toBe('cyber');
		expect(look.palette.id).toBe('cyber');
		expect(look.codeFontId).toBe('jetbrains');
		expect(look.uiFont).toContain('Geist Sans');
	});

	it('falls back for unknown skins and palettes', () => {
		const look = resolveLook(with_({ skin: 'nope', theme: 'nope' }));
		expect(look.skin.id).toBe('cyber');
		expect(look.palette.id).toBe('cyber');
	});

	it('keeps pre-skin Cyber palettes from `theme`', () => {
		expect(resolveLook(with_({ theme: 'dracula' })).palette.id).toBe('dracula');
	});

	it('uses an explicit code font over the skin default', () => {
		expect(resolveLook(with_({ editorFont: 'fira' })).codeFont).toContain('Fira Code');
	});

	it('only honours UI fonts the skin offers', () => {
		const offered = resolveLook(with_(uiFontPatch(DEFAULT_SETTINGS, 'space-grotesk')));
		expect(offered.uiFontId).toBe('space-grotesk');
		const foreign = resolveLook(with_(uiFontPatch(DEFAULT_SETTINGS, 'vt323')));
		expect(foreign.uiFontId).toBe('geist');
	});

	it('lets the user move the side bar', () => {
		expect(resolveLook(with_({ sidebarSide: 'right' })).layout.sidebar).toBe('right');
		expect(resolveLook(DEFAULT_SETTINGS).layout.sidebar).toBe('left');
	});
});

describe('palettePatch', () => {
	it('writes Cyber palettes to `theme` too', () => {
		const patch = palettePatch(DEFAULT_SETTINGS, 'nord');
		expect(patch.theme).toBe('nord');
		expect(patch.skinPrefs?.['cyber']?.palette).toBe('nord');
	});
});
