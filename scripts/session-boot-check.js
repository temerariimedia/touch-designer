#!/usr/bin/env node

import net from "net";
import { spawn } from "child_process";
import process from "process";

function parseArgs(argv) {
  return {
    host: "127.0.0.1",
    port: 9981,
    full: argv.includes("--full")
  };
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

function runNpmScript(scriptName) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", scriptName], {
      shell: true,
      stdio: "inherit"
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const isOpen = await checkPortOpen(args.host, args.port);

  if (!isOpen) {
    console.error(
      `[session-boot] TouchDesigner bridge is not reachable at ws://${args.host}:${args.port}.\n` +
      "Start TouchDesigner Web Server DAT on port 9981 with td-bridge/webserver_callbacks.py, then run session-boot again."
    );
    process.exit(3);
  }

  console.log(`[session-boot] Bridge reachable at ws://${args.host}:${args.port}`);

  const scriptToRun = args.full ? "release-gate" : "capability-check:failfast";
  const code = await runNpmScript(scriptToRun);
  process.exit(code);
}

main().catch((error) => {
  console.error("[session-boot] Unexpected error:", error.message);
  process.exit(1);
});

