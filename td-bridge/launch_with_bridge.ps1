# launch_with_bridge.ps1 — start TouchDesigner with the MCP bridge (port 9981) switched on automatically.
# The start command waits ~3 s (180 frames) so /project1 exists before start_bridge.py runs.
$script = (Join-Path $PSScriptRoot 'start_bridge.py') -replace '\\', '/'
$env:TOUCH_START_COMMAND = "run(`"exec(open(r'$script').read())`", delayFrames=180)"
Start-Process 'C:\Program Files\Derivative\TouchDesigner\bin\TouchDesigner.exe' @args
