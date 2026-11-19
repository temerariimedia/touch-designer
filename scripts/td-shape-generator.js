#!/usr/bin/env node

import net from "net";
import { spawn } from "child_process";
import process from "process";

function parseArgs(argv) {
  const args = {
    host: "127.0.0.1",
    port: 9981
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--host" && argv[i + 1]) {
      args.host = argv[i + 1];
      i += 1;
    } else if (arg === "--port" && argv[i + 1]) {
      args.port = Number.parseInt(argv[i + 1], 10);
      i += 1;
    }
  }

  return args;
}

function checkPortOpen(host, port, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finalize(true));
    socket.once("timeout", () => finalize(false));
    socket.once("error", () => finalize(false));
    socket.connect(port, host);
  });
}

function runChecklist() {
  return new Promise((resolve) => {
    const child = spawn(
      "node",
      [
        "scripts/run-td-mcp-capability-check.js",
        "--checklist",
        "scripts/td-shape-generator-checklist.json"
      ],
      {
        shell: true,
        stdio: "inherit",
        env: {
          ...process.env,
          TD_ALLOW_SCRIPT_EXECUTION: "true",
          TD_ALLOW_NETWORK_MUTATION: "true"
        }
      }
    );
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const isOpen = await checkPortOpen(args.host, args.port);

  if (!isOpen) {
    console.error(
      `[td-shape-gen] TouchDesigner bridge is not reachable at ws://${args.host}:${args.port}.\n` +
      "Start Web Server DAT on port 9981 with td-bridge/webserver_callbacks.py, then run td-shape-gen again."
    );
    process.exit(3);
  }

  console.log(`[td-shape-gen] Bridge reachable at ws://${args.host}:${args.port}`);
  const code = await runChecklist();
  process.exit(code);
}

main().catch((error) => {
  console.error("[td-shape-gen] Unexpected error:", error.message);
  process.exit(1);
});

