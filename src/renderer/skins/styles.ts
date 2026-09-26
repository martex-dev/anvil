/**
 * Loads every skin's stylesheets (palettes.css, skin.css, fonts.css, ...). They are scoped by
 * `[data-theme]` and `[data-skin]`, so all of them can be present at once; only the active
 * skin's rules match. Imported once, after the global styles, so skin rules win ties.
 */
import.meta.glob('./*/*.css', { eager: true });
