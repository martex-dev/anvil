# Changelog

What changed in each release of Anvil. The release workflow publishes a version's section as
its GitHub release notes.

## [0.2.8] - 2026-09-26

App shell, commands, layout and themes: 60 fixes from the full bug sweep of 0.2.0.

### Fixed

- **layout:** Announce scm badge and align activity bar button states
- **layout:** Add error boundaries and global error handlers
- **layout:** Return focus to the editor when a focused pane hides
- **layout:** Stop re-rendering the workbench on every splitter move
- **layout:** Fade panes and side views in on show
- **layout:** Keep side and ai panes inside the window
- **layout:** Keep editors mounted while the panel is maximized
- **terminal:** Put terminals on the editor plate
- **terminal:** Make terminal tabs keyboard reachable
- **terminal:** Show loading, error and empty states in the profile menu
- **terminal:** Add focus ring and arrow keys to panel tabs
- **palette:** Make quick open command and symbol modes match items
- **palette:** Scope quick open's pending enter to its query
- **palette:** Keep editor focus after quick open navigates
- **palette:** Show empty, error and truncated states in quick open
- **palette:** Record quick open commands as recently used
- **shortcuts:** Show an empty state and reset the filter on reopen
- **git:** Keep the commit message draft across side view switches
- **editor:** Repaint the secret shield whenever the setting changes
- **layout:** Make status bar, title pill and scrim blurs follow glass setting
- **layout:** Align the status bar clock to the second
- **layout:** Truncate long branch names and keep status bar items on screen
- **layout:** Run title bar menu commands after the menu closes
- **layout:** Make the title bar menus a real menubar
- **layout:** Keep the title bar search pill in the flex flow
- **commands:** Surface failures of window and log commands
- **commands:** Move keyboard focus with focus editor group
- **commands:** Describe check for updates results instead of raw states
- **commands:** Hold global shortcuts while dialogs are open or keys repeat
- **layout:** Log layout save failures and keep early toggles
- **settings:** Save settings optimistically and show load errors
- **settings:** Paint the saved theme before the first render
- **settings:** Save a picked custom accent when settings closes
- **settings:** Show focus on accent swatches and keep the custom color current
- **settings:** Preview each editor font in its own face
- **settings:** Trim pasted api keys and confirm before deleting one
- **settings:** Make segmented controls keyboard friendly radio groups
- **settings:** Keep stepper focus at min and max and announce the value
- **settings:** Show ai settings load errors and validate the ollama url
- **settings:** Show loading and error states on the api keys tab
- **settings:** Surface about-tab failures and an unreadable version
- **settings:** Report failed update checks and restart to update only once
- **themes:** Give the focused theme card a ring distinct from selection
- **themes:** Revert the theme preview when saving the pick fails
- **commands:** Let altgr characters through global shortcuts
- **layout:** Reveal panes from zen mode and add a way out
- **editor:** Release replaced preview tabs
- **editor:** Fold an empty left editor group
- **toast:** Keep error toasts over bursts and fold repeats
- **themes:** Drop backdrop filters on panes when glass is off
- **themes:** Stop looping animations under reduced motion
- **themes:** Keep the ambient grid still behind blurred panes
- **themes:** Darken accent presets on light themes
- **ui:** Keep active icon buttons lit on hover and expose toggles
- **ui:** Drop stale quick pick loads and show load errors
- **ui:** Ellipsize long quick pick labels and show them in full on hover
- **ui:** Give selects a hover cue and a scrollable height cap
- **layout:** End splitter drags on cancel and report pane sizes
- **ui:** Animate overlays and toasts out, and let toasts follow a swipe
- **ui:** Wrap long toast text instead of clipping it
- **themes:** Use the darker accent presets on the light palettes of every skin
- **themes:** Revert the skin preview when saving the pick fails
- **themes:** Give the focused skin card a ring distinct from selection
- **settings:** Preview each interface font in its own face
- **skins:** Run the skin title menus' commands after the menu closes
- **skins:** Light skin title bar toggles only for panes that are visible
- **skins:** Align the Cockpit and Mainframe clocks to the second
- **skins:** Stop Mainframe's loader and Cyber's backdrop loops under reduced motion

## [0.2.7] - 2026-09-26

Core, IPC, settings and language servers: 39 fixes from the full bug sweep of 0.2.0.

### Fixed

- **settings:** Validate stored settings per field
- **settings:** Report when the log folder cannot be opened
- **core:** Keep starting features when one data folder fails
- **core:** Tell the user which module failed to start
- **lsp:** Actually kill language servers on linux and macos
- **secrets:** Recover from a corrupt secrets file
- **core:** Surface failures to open external links
- **settings:** Retry failed background settings writes
- **settings:** Log when settings.json is not a json object
- **update:** Classify offline and not-published errors precisely
- **settings:** Match the window background to the palette, so light looks start without a dark flash (the skins draw the window buttons themselves)
- **core:** Show the window and explain when the interface fails
- **core:** Remember window size, position and maximized state
- **explorer:** Let symlinked and junctioned folders expand
- **editor:** Keep a file's utf-8 bom when saving
- **editor:** Keep windows-1252 files intact when saving
- **explorer:** Explain locked and failed file operations clearly
- **explorer:** Stop delete and rename from reaching through outside links
- **explorer:** Tell the user when file watching fails
- **explorer:** Keep watching out, dist and build data folders
- **core:** Forget a recent folder without restarting services
- **lsp:** Stop a crashed language server from crashing the main process
- **lsp:** Report language servers that fail to start
- **lsp:** Only run a folder's own typescript after opting in
- **core:** Run a single anvil per profile
- **core:** Explain fatal startup errors in a dialog
- **core:** Quit within five seconds and always save settings
- **core:** Keep delivering events when one subscriber throws
- **lsp:** Start language servers for drive-root and network-share folders
- **lsp:** Add restart language servers to the command palette
- **lsp:** Stop the starting pulse when reduce motion is on
- **lsp:** Match the language server item to the other status bar items
- **lsp:** Say each language server's state, not only its dot colour
- **lsp:** Restart only the chosen servers and clean up failed ones
- **terminal:** Open http links to local notebook and dashboard servers
- **settings:** Keep other settings when one setting changes
- **editor:** Stop flagging pkg_, secretary and seed_file names as secrets
- **git:** Show real paths for non-ascii files in the secret warning
- **git:** Report the right line after a no-newline marker

## [0.2.6] - 2026-09-26

Explorer, welcome, snippets and templates: 38 fixes from the full bug sweep of 0.2.0.

### Fixed

- **templates:** Stop trading bot re-buying right after a stop-loss
- **templates:** Keep unsaved changes when creating a project from a template
- **templates:** Clean up the project folder when writing a template fails
- **templates:** Show error and empty states in the templates dialog
- **templates:** Ignore repeated Enter while a project is being created
- **templates:** Validate project names with one shared schema
- **templates:** Give template choices radio semantics and arrow keys
- **ui:** Stop the shimmer animation under reduced motion
- **templates:** Show full file paths on hover in the template preview
- **explorer:** Add Retry to the explorer error state
- **explorer:** Make explorer actions reachable from the command palette
- **explorer:** Show a spinner on Refresh while folders are reloading
- **explorer:** Keep the inline name input focused after a context-menu action
- **explorer:** Clear the context-menu target when right-clicking non-entry rows
- **explorer:** Open the keyboard context menu on the focused row
- **explorer:** Return focus to the tree after closing the inline name input
- **explorer:** Scroll a revealed file into view once its folders load
- **explorer:** Confirm copied paths and add Copy Path to the explorer menu
- **explorer:** Report failures to reveal a path or forget a recent folder
- **explorer:** Disable Compare with Selected on the selected file itself
- **explorer:** Move focus to the neighbouring item after deleting
- **explorer:** Validate inline names and keep the input open on failure
- **explorer:** Fade the remove-from-recent button in and out
- **explorer:** Expand symlinked folders and junctions like folders
- **explorer:** Announce the focused tree row to screen readers
- **explorer:** Stop rebuilding tree rows on every render
- **explorer:** Add type-ahead to the tree and pass modified keys through
- **explorer:** Keep focus on an expanded folder that has no children yet
- **explorer:** Drop missing folders from recent and allow removal on Welcome
- **snippets:** Show the full snippet name on hover
- **explorer:** Focus the Explorer and Snippets views when shown by command
- **snippets:** Keep focus in the panel after clearing filters
- **snippets:** Replace the whole hyphenated prefix on completion
- **welcome:** Show the missing-key banner only once keys have loaded
- **welcome:** Fade the feature-card glow in on hover
- **welcome:** Add a focus ring and hover transition to the API-key banner
- **welcome:** Stack the Welcome layout in narrow editor groups
- **welcome:** Truncate long recent folder names and show the full path on hover

## [0.2.5] - 2026-09-26

Git, search and navigation: 69 fixes from the full bug sweep of 0.2.0.

### Fixed

- **git:** Re-detect the repo after git init or a deleted .git
- **git:** Resolve blame and head content paths against the open folder
- **git:** Pass the user's ssh client and config home to git
- **git:** Keep git messages in english for not-a-repo detection
- **git:** Stage and unstage large change sets in batches
- **git:** Keep files named '..something' inside the open folder
- **git:** Only swallow expected missing-path errors in diff and blame
- **git:** Say 'already up to date' after a no-op pull
- **search:** Drop highlight ranges hidden by indentation trimming
- **search:** Include dotfiles and dot-folders in find in files
- **search:** Flag searches stopped by the time limit as incomplete
- **search:** Show when a file hit the per-file match cap
- **search:** Treat unreadable files as warnings, not a bad query
- **search:** Include the reason in invalid-regex errors
- **git:** Give change-list rows and headers a visible focus ring
- **git:** Cap change lists at 1000 rendered rows
- **git:** Keep keyboard focus in the list after staging a file
- **git:** Announce change status to screen readers
- **git:** Keep the commit message when switching side views
- **git:** Confirm before the ai replaces a typed commit message
- **git:** Block committing while the ai message is streaming
- **ai:** Stop the shimmer sweep under reduced motion
- **git:** Return focus to the message box after committing
- **git:** Unstage both sides of a staged rename
- **git:** Highlight git diffs for every language the editor knows
- **git:** Keep the last status when a refresh fails
- **git:** Show progress for refresh, pull and push
- **git:** Disable pull on branches without an upstream
- **git:** Use arrow-up for push and a cloud for publish
- **git:** Report branch and log listing failures
- **git:** Only push in sync after the pull succeeded
- **git:** Copy the hash of a commit picked in recent commits
- **git:** Explain why diff active file cannot run
- **git:** Focus the message box from the commit command
- **git:** Share pull and push progress between the palette and the panel
- **history:** Key the snapshot list by workspace root
- **history:** Show loading and error states for snapshots
- **history:** Confirm before clearing a file's snapshots
- **history:** Report snapshots that cannot be read
- **history:** Show keyboard focus on snapshot rows
- **history:** Reveal the restore button on keyboard focus
- **history:** Keep the snapshot list valid and show the full path
- **history:** Keep snapshot ages current while the view is open
- **outline:** Make the remove-bookmark button reachable by keyboard
- **outline:** Reset the symbol filter per file and label it
- **outline:** Navigate the outline tree with the arrow keys
- **outline:** Skip class and def lines inside python docstrings
- **editor:** Refresh the outline when the editor shows another file
- **problems:** Make fix with ai reachable by keyboard
- **problems:** Keep the fix with ai icon in the accent color
- **problems:** Show an empty state when the filter matches nothing
- **problems:** Key rows by diagnostic, label the filter and show full paths
- **problems:** Navigate problems with the arrow keys
- **problems:** Discard the open-file result in the row handler
- **problems:** Sort warnings before infos consistently
- **search:** Show when hidden include/exclude globs still filter
- **search:** Fade the option toggles like other icon buttons
- **search:** Re-run on enter and clear or leave on escape
- **search:** Show searching for a first query and dim stale results
- **search:** Count per-file badges the same way as the summary
- **search:** Reset collapsed files per query and navigate results by keyboard
- **search:** Open results in the preview tab and show full paths
- **search:** Re-run the search when files change on disk
- **todos:** Scan todos on their own ripgrep lane
- **todos:** Take the tag from the matched marker
- **todos:** Drop a tag filter once its tag is gone
- **todos:** Rescan on file changes and say when the list is cut off
- **todos:** Strip owner tags from todo descriptions
- **todos:** Expose the active filter and full todo text
- **skins:** Keep the focus ring on keyboard-focused outline and problems rows in Cockpit and Y2K, fit outline rows inside the pane in Y2K and band them in Mainframe greenbar

## [0.2.4] - 2026-09-26

AI assistant: 53 fixes from the full bug sweep of 0.2.0.

### Fixed

- **ai:** Report missing key and timeout for autocomplete
- **ai:** Surface git diff failures instead of reporting no changes
- **ai:** End streams that go silent
- **ai:** Keep gpt-5 autocomplete from spending its budget on reasoning
- **ai:** Report truncated and blocked replies
- **ai:** Make the apply dialog a real modal
- **ai:** Keep the apply diff editor across mode toggles
- **ai:** Check the apply target before opening, not in an effect
- **ai:** Put the apply diff on an opaque surface
- **ai:** Truncate @-attached and problem files to the context limit
- **ai:** Only auto-scroll the chat while it is at the bottom
- **ai:** Add a chat error state and stop the false no-key banner
- **ai:** Keep the chat draft when a reply is still streaming
- **ai:** Let Escape close chat suggestions and respect IME composition
- **ai:** Keep the chat draft when the panel closes
- **ai:** Run chat starters, slash commands and model picker as commands
- **ai:** Offer undo after clearing the conversation
- **ai:** Announce chat replies without replaying stale errors
- **ai:** Show progress on the diff attach and ignore repeat clicks
- **ai:** Explain an empty @ mention popup
- **ai:** Give the mention popup combobox semantics
- **ai:** Keep focus when send turns into stop
- **ai:** Let esc and a stop button cancel an inline edit that is generating
- **ai:** Handle esc and tab for inline edit while the code has focus
- **ai:** Stop shift+tab from accepting an inline edit
- **ai:** Return focus to the inline edit input after picking a suggestion
- **ai:** Report a failed copy from a chat code block
- **ai:** Explain chat links that cannot open instead of ignoring them
- **ai:** Wrap long text and truncate context chips in the user bubble
- **ai:** Stop the shimmer and pulse loading animations under reduced motion
- **ai:** Offer retry on a failed chat reply
- **ai:** Mark stopped replies and show when a reply was written
- **ai:** Leave attachments alone when an AI action runs during a reply
- **ai:** Select the code before fix-here and vectorize inline edits
- **ai:** Leave zen mode when an AI action opens the chat
- **ai:** Ask for the right test framework per language
- **ai:** Say why fix-here, add docstring and ask-about-problem did less
- **ai:** Validate a typed model id before saving it
- **ai:** Always open the sent chat history with a user turn
- **ai:** Keep earlier attachments in follow-up chat requests
- **ai:** Cap chat attachments at the request limit
- **ai:** Make stop, attach and inline accept/reject palette commands
- **ai:** Leave ctrl+l to the terminal so it clears the screen
- **ai:** Key cached ghost text on the code after the cursor and the model
- **ai:** Stop the chat retry clashing with the settings retry
- **ai:** Apply an inline edit where its code is now
- **ai:** Keep the text after the cursor when rejecting an inline insert
- **ai:** End the inline edit when its editor is disposed
- **ai:** Keep an unfenced reply's indentation and refuse an empty one
- **ai:** Refit the inline edit box when the editor is resized
- **ai:** Keep the cursor marker in large files for inline inserts
- **ai:** Make inline reject and apply their own undo steps
- **ai:** Skip one-shot requests cancelled before they are sent
- **skins:** Keep Workbench 95's sunken chat log and Zen Paper's Jump to latest button styled after the chat rework
- **skins:** Keep the AI busy indicator still under reduced motion in Zen Paper and Mainframe

## [0.2.3] - 2026-09-26

Toolbox, transforms and snap: 38 fixes from the full bug sweep of 0.2.0.

### Fixed

- **snap:** Add roving arrow-key focus to background swatches
- **snap:** Keep keyboard focus in the font-size controls
- **snap:** Stop the loading shimmer under reduced motion
- **snap:** Fade in the preview's rendering badge and error pill
- **snap:** Match the ctrl+c copy shortcut by physical key
- **snap:** Guard copy image against double submits
- **snap:** Show the real render state in the sheet footer
- **snap:** Say the file is empty when a whole-file snap has no code
- **snap:** Ellipsize long titles in the title chrome
- **snap:** Drop the colorization cache when the appearance changes
- **snap:** Keep non-ascii letters in saved snap file names
- **snap:** Keep clipped lines within max columns
- **toolbox:** Count base58 bytes from the decoded hex input
- **toolbox:** Show the full value in the copy tooltip
- **toolbox:** Announce copied values to screen readers
- **toolbox:** Hint to pick a direction in the encode tool
- **toolbox:** Re-check jwt expiry against the ticking clock
- **toolbox:** Show tiny position sizes instead of rounding to 0
- **toolbox:** Run the regex tester in a worker with a timeout
- **toolbox:** Flag invalid regex flags on the flags field
- **toolbox:** Show an empty state in the regex tester
- **toolbox:** Add tooltips to truncated segmented options
- **toolbox:** Match the textarea style to the inputs beside it
- **toolbox:** Announce tool errors to screen readers
- **toolbox:** Keep tool inputs when leaving the toolbox view
- **toolbox:** Add a palette command for each tool
- **toolbox:** Show the full name and hint in tab tooltips
- **toolbox:** Stop wrapping the unit select in a label
- **toolbox:** Reject decimal commas in number fields
- **toolbox:** Stop reading arbitrary text as a date
- **toolbox:** Report compound overflow instead of nan
- **toolbox:** Render tab-indented output two columns wide
- **editor:** Stop overlapping edits when two cursors share a line
- **editor:** Insert a fresh unique value at each cursor
- **editor:** Apply the shuffle order shown in the transform preview
- **editor:** Surface failures of built-in editor actions
- **editor:** Decode uppercase hex html entities and keep invalid ones
- **editor:** Evaluate math on lines with trailing comments

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
