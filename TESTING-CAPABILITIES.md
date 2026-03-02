# Full Capability Testing

This project includes an automated MCP capability checker:

- Checklist manifest: `scripts/td-capability-checklist.json`
- Runner: `scripts/run-td-mcp-capability-check.js`

The runner launches this MCP server via stdio and executes tool calls end-to-end.

## Prerequisites

1. TouchDesigner Web Server DAT is running with:
   - `td-bridge/webserver_callbacks.py`
   - WebSocket on `9981`
2. This repo dependencies are installed:
   - `npm install`

## Run

```bash
npm run capability-check
```

Session startup shortcut:

```bash
npm run session-boot
```

This does:

1. checks TD bridge reachability on `127.0.0.1:9981`
2. runs a fast regression gate (`capability-check:failfast`)

Full startup gate:

```bash
npm run session-boot:full
```

Release blocker gate:

```bash
npm run release-gate
```

Treat any non-zero exit as a release blocker.

Fail-fast mode:

```bash
npm run capability-check:failfast
```

Custom checklist:

```bash
node scripts/run-td-mcp-capability-check.js --checklist scripts/td-capability-checklist.json
```

## Output

A timestamped report is written to:

`results/<YYYYMMDD-HHMMSS>/report.json`

The report includes:

- step-by-step status (`passed`, `expected_failure_passed`, `failed`, `blocked`)
- duration per step
- captured variables (for plan/apply chaining)
- overall pass rate

Runner exit codes:

- `0`: pass
- `2`: functional failures
- `3`: infrastructure blocker (typically TD bridge unavailable)

When the bridge is unavailable, the runner classifies this as an infra blocker and marks bridge-dependent steps as `blocked` instead of counting them as individual functional failures.

## Guardrail Behavior

By default, these are disabled:

- script execution
- destructive ops
- project I/O

Some checklist steps intentionally expect policy failures.

`td_test_reset_workspace` behavior:

- `dry_run: true` does not require destructive capability
- `dry_run: false` requires `allow_destructive_ops=true`

To run with elevated capabilities, set env vars before startup:

```bash
set TD_ALLOW_SCRIPT_EXECUTION=true
set TD_ALLOW_DESTRUCTIVE_OPS=true
set TD_ALLOW_PROJECT_IO=true
```

Then rerun the checklist and verify previously blocked steps pass.

## Recommended Progression

1. Baseline run with default guardrails.
2. Elevated run for full capability coverage.
3. TD bridge restart during run to validate reconnect behavior.
4. Save reports for regression comparison after code changes.
