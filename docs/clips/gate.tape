# The gate in 16 seconds: the check passes, fails on a call that the model does not draw, and
# passes again. Render it from the repository root, after npm ci and npm run setup:
#   vhs docs/clips/gate.tape
Output docs/clips/gate.gif

Set Shell bash
Set FontSize 18
Set Width 1320
Set Height 800
Set Padding 28
Set LineHeight 1.25
Set TypingSpeed 28ms
Set CursorBlink false
Set Theme { "name": "Archboard night", "background": "#16140f", "foreground": "#e6e2d8", "cursor": "#e9c46a", "selection": "#3a352b", "black": "#16140f", "brightBlack": "#8f897d", "red": "#f39a8c", "brightRed": "#f39a8c", "green": "#7fe0a0", "brightGreen": "#7fe0a0", "yellow": "#e9c46a", "brightYellow": "#f0d48a", "blue": "#8fb4f5", "brightBlue": "#8fb4f5", "magenta": "#c4b2f2", "brightMagenta": "#c4b2f2", "cyan": "#86dbc8", "brightCyan": "#86dbc8", "white": "#e6e2d8", "brightWhite": "#f2f0ea" }

# Warm the server, put the pinned CLI on the PATH, and print each command's exit status.
Hide
Type `export PATH="$PWD/node_modules/.bin:$PATH"; archboard check >/dev/null 2>&1` Enter
Type `PROMPT_COMMAND='s=$?; [ -n "$shown" ] && { [ $s -eq 0 ] && c=32 || c=31; printf "\e[${c}mexit $s\e[0m\n\n"; }; shown=1'; PS1=$'\e[33m$\e[0m '; shown=; clear` Enter
Sleep 6s
Show

Type "archboard check > /dev/null" Enter
Sleep 2.4s

Type "npm run -s gate:break" Enter
Sleep 1.2s
Type "archboard check > /dev/null" Enter
Sleep 5.5s

Type "npm run -s gate:restore" Enter
Sleep 1.2s
Type "archboard check > /dev/null" Enter
Sleep 3s
