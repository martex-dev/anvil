# Changelog

What changed in each release of Anvil. The release workflow publishes a version's section as
its GitHub release notes.

## [0.2.1] - 2026-09-26

Editor: 66 fixes from the full bug sweep of 0.2.0.

### Fixed

- **editor:** Keep breadcrumbs of an unfocused group
- **editor:** Truncate long breadcrumbs with a tooltip
- **editor:** Name the editor after the file it shows
- **editor:** Stop copying huge selections on every cursor event
- **editor:** Keep scroll and cursor per editor group
- **editor:** Don't steal focus on session restore or previews
- **editor:** Reveal lines in the group the file opened in
- **editor:** Load waiting files after retrying a failed monaco boot
- **editor:** Show loading and error states for diff tabs
- **editor:** Drop the backdrop filter under monaco
- **editor:** Add retry to the file open error state
- **editor:** Offer actions for binary and too-large files
- **editor:** Reset navigation, compare pick and git cache on folder switch
- **editor:** Cancel session restore when the folder changes
- **editor:** Keep navigation jumps and the scratchpad out of recents
- **editor:** Keep focus after closing a dirty tab from its close button
- **editor:** Make reveal in explorer from a tab work
- **editor:** Navigate and close tabs from the keyboard
- **editor:** Copy tab paths with feedback and error handling
- **editor:** Keep preview tabs open from the menu, palette or an edit
- **editor:** Drop tabs on the side the indicator shows
- **editor:** Explain and resolve the changed-on-disk tab state
- **editor:** Show the tab close button on focus and give it a tooltip
- **editor:** Scroll the active tab into view
- **editor:** Show the shortcut in the markdown preview tooltip
- **editor:** Let AltGr type characters instead of running Ctrl+Alt shortcuts
- **editor:** Report folder errors and open existing files from new file
- **editor:** Don't rewrite files without changes on save
- **editor:** Say when there is no bookmark to jump to
- **editor:** Copy path of active file only for real files
- **editor:** Let only the front tab decide the active file
- **editor:** Keep bookmarks per folder
- **editor:** Move bookmarks with the code they mark
- **editor:** Draw cell arrows and bookmarks in separate glyph lanes
- **editor:** Run a cell from the gutter on a plain left click only
- **editor:** Record context-menu copies in clipboard history
- **editor:** Stop showing color swatches on issue refs and hex words
- **git:** Save the inline blame toggle as a setting
- **git:** Show commit text literally in the blame hover
- **git:** Recolor the git change markers when the theme changes
- **editor:** Blur the whole quoted .env value, # included
- **editor:** Clear secret shield problems in every file when it is turned off
- **editor:** Reveal a blurred secret on the line the cursor moves to
- **editor:** Keep the cursor and folds when saving, formatting or reloading
- **editor:** Drop file reads that land after their tab closed
- **editor:** Queue saves of the same file instead of racing them
- **editor:** Keep keystrokes typed while a reload reads the disk
- **editor:** Explain when reloading from disk fails
- **editor:** Build correct file URIs for a drive-root folder
- **editor:** Stop the format-on-save warning from piling up on every save
- **editor:** Ask about every save conflict, not just the last
- **editor:** Ignore the watcher echo of your own save in edited files
- **editor:** Keep back/forward history recording after a jump that never lands
- **editor:** Open to the side without replacing the current tab
- **editor:** Ask about every unsaved tab when closing several
- **editor:** Move open tabs and buffers along when a file is renamed
- **editor:** Log when the scratchpad fails to open
- **editor:** Stop toasting a Monaco load failure once per file
- **editor:** Keep a table's data while another group still shows it
- **editor:** Keep monaco loaded when a load listener throws
- **editor:** Apply appearance changes made while monaco boots
- **editor:** Say when a definition is outside the open folder
- **editor:** Honour the os reduced-motion setting in the editor
- **editor:** Take the editor surface color from a token
- **editor:** Stat workspace files without reading them for monaco
- **skins:** Show where a dragged tab will land and which tab has keyboard focus in every skin

### Performance

- **editor:** Stop rescanning the file on every cursor move for cells and spotlight
