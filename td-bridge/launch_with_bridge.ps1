# launch_with_bridge.ps1 — open TouchDesigner with the MCP bridge (port 9981) already running.
# bridge-project.toe is saved the first time start_bridge.py runs inside TouchDesigner (Textport:
#   exec(open(r'<this folder>/start_bridge.py').read())  ). TOUCH_START_COMMAND is ignored by TD 2025, so we open the project file.
$toe = Join-Path $PSScriptRoot 'bridge-project.toe'
if (Test-Path $toe) {
  Start-Process 'C:\Program Files\Derivative\TouchDesigner\bin\TouchDesigner.exe' -ArgumentList "`"$toe`""
} else {
  Write-Host "No bridge-project.toe yet. Open TouchDesigner, press Alt+T and run:"
  Write-Host "exec(open(r'$((Join-Path $PSScriptRoot 'start_bridge.py') -replace '\\','/')').read())"
}
