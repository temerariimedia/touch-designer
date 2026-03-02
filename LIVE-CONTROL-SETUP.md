# Live Control Setup (Hybrid MCP)

This server now supports:

- Documentation tools (operators/tutorials/Python API)
- Live TouchDesigner control tools over WebSocket bridge
- `stdio` and streamable HTTP MCP transports

## 1) TouchDesigner Bridge

1. In TouchDesigner, configure a Web Server DAT for WebSocket use.
2. Load `td-bridge/webserver_callbacks.py` into callbacks.
3. Start it on port `9981` (default expected by this MCP server).
4. Optional auth token:
   - Create a Text DAT named `td_control_secret` with your secret.
   - Pass same token via `td_connect`.

## 2) MCP Server Startup

### Stdio mode (default)

```bash
node index.js
```

### HTTP mode (streamable MCP)

```bash
node index.js --transport=http --mcp-http-host=127.0.0.1 --mcp-http-port=6288 --mcp-http-endpoint=/mcp
```

Health endpoint:

```bash
GET http://127.0.0.1:6288/health
```

## 3) Capability Guardrails

Default policy file: `config/td-capabilities.json`

Defaults:

- `allow_eval: true`
- `allow_network_mutation: true`
- `allow_script_execution: false`
- `allow_destructive_ops: false`
- `allow_project_io: false`

Environment overrides:

- `TD_ALLOW_EVAL=true|false`
- `TD_ALLOW_NETWORK_MUTATION=true|false`
- `TD_ALLOW_SCRIPT_EXECUTION=true|false`
- `TD_ALLOW_DESTRUCTIVE_OPS=true|false`
- `TD_ALLOW_PROJECT_IO=true|false`

## 4) New Control Tools

- `td_bridge_state`
- `td_bridge_ping`
- `td_list_nodes`
- `td_node_errors`
- `td_exec_node_method`
- `td_execute_batch`
- `td_plan_network_changes`
- `td_apply_network_changes`
- `td_describe_tools`
- `td_export_snapshot`
- `td_capture_performance`
- `td_test_reset_workspace`

Compatibility aliases are also available:

- `create_td_node`
- `delete_td_node`
- `execute_python_script`
- `get_td_info`
- `get_td_nodes`
- `get_td_node_errors`
- `get_td_node_parameters`
- `update_td_node_parameters`
- `exec_node_method`
- `describe_td_tools`

## 5) Automated Capability Check

Run the full MCP checklist:

```bash
npm run capability-check
```

Detailed guide:

- `TESTING-CAPABILITIES.md`

Notes:

- If the TouchDesigner bridge is offline, the runner reports an `infra_blocker` status and blocks bridge-dependent checks.
- `td_test_reset_workspace` supports safe dry-run mode without destructive capability:
  - `dry_run=true` allowed
  - `dry_run=false` requires `TD_ALLOW_DESTRUCTIVE_OPS=true`
