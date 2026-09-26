# Changelog

What changed in each release of Anvil. The release workflow publishes a version's section as
its GitHub release notes.

## [0.2.2] - 2026-09-26

Terminal, Python and tasks: 47 fixes from the full bug sweep of 0.2.0.

### Fixed

- **python:** Find all-users conda installs via %ProgramData%
- **python:** Handle ruff stdin errors and time out a hung format
- **python:** Point cell tracebacks at the source file and line
- **python:** Log failures when announcing the selected interpreter
- **python:** Only accept discovered interpreters in python:select
- **python:** Log and surface why package listing failed
- **python:** Escape single quotes in run commands on macOS/Linux
- **python:** Pass ruff an absolute --stdin-filename
- **python:** Fall back to system Pythons when a folder has no env
- **tasks:** Keep task ids unique across task kinds
- **tasks:** Quote npm script names and detect bun.lock
- **terminal:** Type the initial command only into a newly started session
- **terminal:** Restart an exited terminal instead of dropping commands
- **terminal:** Let 'Check again' find a just-installed CLI
- **terminal:** Start each session once when opens race
- **terminal:** Keep the backlog as chunks and replay it from a full line
- **python:** Show a neutral chip while the interpreter loads
- **python:** Pick up a venv created or deleted in the open folder
- **tasks:** Show an error state when listing tasks fails
- **tasks:** Refresh the task list when task files change
- **python:** Make 'Rescan interpreters' rescan and show busy refresh buttons
- **python:** Truncate long interpreter labels in the Run view
- **python:** Show interpreter and tool-check errors instead of 'none'
- **python:** Add empty and no-match package states; stop shimmer under reduced motion
- **python:** Save dirty files before tests and tasks; explain an empty pytest target
- **python:** Open the REPL without printing sys.version into it
- **python:** Send to the REPL without waiting on a tools check
- **python:** Run one-line compound statements instead of hanging the REPL
- **python:** Report interpreter discovery failures and keep 'Automatic' in the picker
- **python:** Handle python:changed once, under the folder it was resolved for
- **terminal:** Let a terminal that failed to start retry or close
- **terminal:** Explain a terminal profile this system doesn't offer
- **terminal:** Keep a running terminal mounted when the presets query fails
- **terminal:** Confirm the install-command copy only after it succeeds
- **terminal:** Confirm and report 'Kill Active Terminal'
- **terminal:** Link absolute paths that contain spaces
- **terminal:** Don't reuse another folder's Run, REPL and task terminals
- **terminal:** Run the first command sent to a restored terminal tab
- **terminal:** Validate restored terminal tabs and restore the active one
- **terminal:** Give new terminals unique names and add rename/switch commands
- **terminal:** Copy with Ctrl+C regardless of Caps Lock, and with Ctrl+Shift+C
- **terminal:** Report a failed terminal restart instead of looking alive
- **terminal:** Focus the terminal after switching tabs or killing the active one
- **terminal:** Change the terminal font size without re-creating xterm
- **terminal:** Stop the cursor blinking under reduced motion
- **terminal:** Refit after a font change and keep a monospace fallback
- **terminal:** Paint xterm on an opaque editor-token background
- **skins:** The Workbench skin's taskbar focuses the terminal it switches to
- **terminal:** Draw the terminal cursor in the editor's caret color, so it stays visible on light palettes

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
