# start_bridge.py — run inside TouchDesigner at launch to bring up the MCP bridge on port 9981.
# Launch: set TOUCH_START_COMMAND to run this file a few seconds AFTER the project loads (run(..., delayFrames=180)),
# because TOUCH_START_COMMAND fires before /project1 exists. See td-bridge/launch_with_bridge.ps1.
# Creates /project1/td_bridge_callbacks (Text DAT, synced to webserver_callbacks.py) and
# /project1/td_bridge_ws (Web Server DAT, port 9981, active). Safe to run twice.
import os

_here = r'C:/Users/temer/tools/touch-designer/touchdesigner-mcp-server/td-bridge'
_base = op('/project1')
_cb = _base.op('td_bridge_callbacks') or _base.create(textDAT, 'td_bridge_callbacks')
_cb.par.file = os.path.join(_here, 'webserver_callbacks.py').replace('\\', '/')
_cb.par.syncfile = True
_ws = _base.op('td_bridge_ws') or _base.create(webserverDAT, 'td_bridge_ws')
_ws.par.port = 9981
_ws.par.callbacks = _cb
_ws.par.active = True
print('[td-bridge] Web Server DAT active on port 9981 with webserver_callbacks.py')

# Save a ready-made bridge project once, so later launches need no setup:
#   TouchDesigner.exe "<this folder>/bridge-project.toe"   -> bridge comes up on its own.
_toe = os.path.join(_here, 'bridge-project.toe').replace('\\', '/')
if not os.path.exists(_toe):
    project.save(_toe)
    print('[td-bridge] saved ' + _toe + ' (open this file next time; the bridge starts with it)')
