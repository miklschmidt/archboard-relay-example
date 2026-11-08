# Render from the repository root, after `npm ci` and `npm run setup`:
#   vhs docs/clips/gate.tape
Output docs/clips/gate.gif

Set Shell bash
Set Theme "Catppuccin Mocha"
Set FontSize 15
Set Width 1400
Set Height 760
Set Padding 16
Set TypingSpeed 35ms

# Start the Archboard server and warm the checks before recording.
Hide
Type "PS1='$ '; npm run check >/dev/null 2>&1; clear" Enter
Type "PROMPT_COMMAND='echo exit $?'; clear" Enter
Sleep 6s
Show

Type "npm run check" Enter
Sleep 2.5s

Type "npm run gate:break" Enter
Sleep 1s
Type "npm run check" Enter
Sleep 5s

Type "npm run gate:restore" Enter
Sleep 1s
Type "npm run check" Enter
Sleep 3s
