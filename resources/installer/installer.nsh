; Windows Explorer integration, included by electron-builder's NSIS script (nsis.include).
;
; - "Open with Anvil" on a folder, on the empty space inside a folder, and on any file.
; - Anvil in the "Open with" list of research files (.py, .ipynb, .csv, .parquet).
;
; Nothing becomes a default handler (ADR-021): electron-builder's own fileAssociations would
; set each extension's default program, taking .py away from Python or VS Code and .csv away
; from Excel. OpenWithProgids only adds Anvil to the list.
;
; The installer is per user (perMachine: false), so SHCTX is HKCU and no admin rights are needed.
; Every command passes one quoted path; Anvil decides whether it is a folder or a file.

; Included before electron-builder's common.nsh, so APP_EXECUTABLE_FILENAME is not defined yet.
!define ANVIL_EXE_NAME "${PRODUCT_FILENAME}.exe"
!define ANVIL_EXE "$INSTDIR\${ANVIL_EXE_NAME}"
!define ANVIL_PROGID "Anvil.File"
!define ANVIL_VERB "Open with Anvil"

!macro anvilMenuEntry KEY ARG
	WriteRegStr SHCTX "Software\Classes\${KEY}\shell\Anvil" "" "${ANVIL_VERB}"
	WriteRegStr SHCTX "Software\Classes\${KEY}\shell\Anvil" "Icon" '"${ANVIL_EXE}",0'
	WriteRegStr SHCTX "Software\Classes\${KEY}\shell\Anvil\command" "" '"${ANVIL_EXE}" "${ARG}"'
!macroend

!macro anvilOpenWith EXT
	WriteRegNone SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${ANVIL_PROGID}"
	WriteRegStr SHCTX "Software\Classes\Applications\${ANVIL_EXE_NAME}\SupportedTypes" ".${EXT}" ""
!macroend

!macro anvilForgetOpenWith EXT
	DeleteRegValue SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${ANVIL_PROGID}"
!macroend

!macro customInstall
	; %1 is the clicked folder or file. The folder background only offers %V, which is "C:\"
	; at a drive root: quoted as "C:\" the backslash would escape the closing quote and the
	; argument would arrive as C:". "%V\." keeps it a plain path ("C:\proj\." is C:\proj).
	!insertmacro anvilMenuEntry "Directory" "%1"
	!insertmacro anvilMenuEntry "Directory\Background" "%V\."
	!insertmacro anvilMenuEntry "*" "%1"

	WriteRegStr SHCTX "Software\Classes\${ANVIL_PROGID}" "" "${PRODUCT_NAME} file"
	WriteRegStr SHCTX "Software\Classes\${ANVIL_PROGID}\DefaultIcon" "" '"${ANVIL_EXE}",0'
	WriteRegStr SHCTX "Software\Classes\${ANVIL_PROGID}\shell\open\command" "" '"${ANVIL_EXE}" "%1"'
	WriteRegStr SHCTX "Software\Classes\Applications\${ANVIL_EXE_NAME}" "FriendlyAppName" "${PRODUCT_NAME}"
	WriteRegStr SHCTX "Software\Classes\Applications\${ANVIL_EXE_NAME}\shell\open\command" "" '"${ANVIL_EXE}" "%1"'
	!insertmacro anvilOpenWith "py"
	!insertmacro anvilOpenWith "ipynb"
	!insertmacro anvilOpenWith "csv"
	!insertmacro anvilOpenWith "parquet"

	; Explorer caches associations; tell it they changed (SHCNE_ASSOCCHANGED).
	System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
	; An update runs the old uninstaller first and then installs again: keep the entries.
	${ifNot} ${isUpdated}
		DeleteRegKey SHCTX "Software\Classes\Directory\shell\Anvil"
		DeleteRegKey SHCTX "Software\Classes\Directory\Background\shell\Anvil"
		DeleteRegKey SHCTX "Software\Classes\*\shell\Anvil"
		!insertmacro anvilForgetOpenWith "py"
		!insertmacro anvilForgetOpenWith "ipynb"
		!insertmacro anvilForgetOpenWith "csv"
		!insertmacro anvilForgetOpenWith "parquet"
		DeleteRegKey SHCTX "Software\Classes\${ANVIL_PROGID}"
		DeleteRegKey SHCTX "Software\Classes\Applications\${ANVIL_EXE_NAME}"
		System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
	${endIf}
!macroend
