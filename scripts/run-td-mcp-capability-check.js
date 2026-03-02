#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import process from "process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function parseArgs(argv) {
  const args = {
    checklist: "scripts/td-capability-checklist.json",
    serverCommand: "node",
    serverArgs: ["index.js"],
    outDir: "results",
    failFast: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--checklist" && argv[i + 1]) {
      args.checklist = argv[i + 1];
      i += 1;
    } else if (arg === "--server-command" && argv[i + 1]) {
      args.serverCommand = argv[i + 1];
      i += 1;
    } else if (arg === "--server-args" && argv[i + 1]) {
      args.serverArgs = argv[i + 1].split(" ").filter(Boolean);
      i += 1;
    } else if (arg === "--out-dir" && argv[i + 1]) {
      args.outDir = argv[i + 1];
      i += 1;
    } else if (arg === "--fail-fast") {
      args.failFast = true;
    }
  }

  return args;
}

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function deepGet(obj, dottedPath) {
  return dottedPath.split(".").reduce((acc, part) => (acc && part in acc ? acc[part] : undefined), obj);
}

function substituteVars(input, vars) {
  if (typeof input === "string") {
    return input.replace(/\$\{([^}]+)\}/g, (_m, key) => (key in vars ? String(vars[key]) : _m));
  }
  if (Array.isArray(input)) {
    return input.map((item) => substituteVars(item, vars));
  }
  if (input && typeof input === "object") {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = substituteVars(v, vars);
    }
    return out;
  }
  return input;
}

function extractTextResult(toolResult) {
  if (!toolResult || !Array.isArray(toolResult.content)) {
    return "";
  }
  return toolResult.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

function extractJsonBlock(text) {
  if (!text || !text.includes("```json")) {
    return null;
  }
  const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (_error) {
    return null;
  }
}

function inferSuccess(text, parsedJson) {
  if (parsedJson && typeof parsedJson.success === "boolean") {
    return parsedJson.success;
  }
  const looksLikeError = /failed|\berror\b|requires capability|not connected/i.test(text || "");
  return !looksLikeError;
}

function isBridgeUnavailableMessage(message) {
  return /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|Connection timed out|connect\s+ECONNREFUSED|No route to host/i.test(message || "");
}

function classifyErrorClass({ status, text, error }) {
  if (status === "blocked") {
    return "infra";
  }
  const msg = `${text || ""} ${error || ""}`;
  if (isBridgeUnavailableMessage(msg)) {
    return "infra";
  }
  if (/requires capability|allow_/i.test(msg)) {
    return "policy";
  }
  if (/failed|error/i.test(msg)) {
    return "functional";
  }
  return "unknown";
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const checklistPath = resolve(args.checklist);
  const checklist = JSON.parse(readFileSync(checklistPath, "utf8"));
  const vars = {};

  const client = new Client({
    name: "td-mcp-capability-runner",
    version: "1.1.0"
  });

  const transport = new StdioClientTransport({
    command: args.serverCommand,
    args: args.serverArgs
  });

  await client.connect(transport);

  const startedAt = new Date().toISOString();
  const phaseResults = [];
  const stepStatusMap = new Map();
  const infraBlockers = [];
  let infraBlockerActive = false;

  let total = 0;
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let expectedFailurePassed = 0;
  let functionalFailed = 0;

  try {
    for (const phase of checklist.phases) {
      const phaseStart = Date.now();
      const stepResults = [];

      for (const step of phase.steps) {
        total += 1;
        const stepStart = Date.now();
        const stepArgs = substituteVars(step.args || {}, vars);
        const dependsOn = Array.isArray(step.depends_on) ? step.depends_on : [];
        const requiresBridge = step.requires_bridge !== false;

        const failedDependency = dependsOn.find((id) => {
          const depStatus = stepStatusMap.get(id);
          return depStatus && depStatus !== "passed" && depStatus !== "expected_failure_passed";
        });

        if (failedDependency) {
          const status = "blocked";
          blocked += 1;
          stepStatusMap.set(step.id, status);
          stepResults.push({
            id: step.id,
            tool: step.tool,
            args: stepArgs,
            expect_failure: Boolean(step.expect_failure),
            status,
            block_reason: `depends_on_failed:${failedDependency}`,
            error_class: "functional",
            duration_ms: Date.now() - stepStart,
            result: null,
            error: null
          });
          continue;
        }

        if (infraBlockerActive && requiresBridge) {
          const status = "blocked";
          blocked += 1;
          stepStatusMap.set(step.id, status);
          stepResults.push({
            id: step.id,
            tool: step.tool,
            args: stepArgs,
            expect_failure: Boolean(step.expect_failure),
            status,
            block_reason: "bridge_unavailable",
            error_class: "infra",
            duration_ms: Date.now() - stepStart,
            result: null,
            error: null
          });
          continue;
        }

        let callResult = null;
        let errorMessage = null;
        let text = "";
        let parsedJson = null;
        let status = "failed";

        try {
          callResult = await client.callTool({
            name: step.tool,
            arguments: stepArgs
          });

          text = extractTextResult(callResult);
          parsedJson = extractJsonBlock(text);
          const inferredSuccess = inferSuccess(text, parsedJson);

          if (step.expect_failure) {
            status = inferredSuccess ? "unexpected_success" : "expected_failure_passed";
          } else {
            status = inferredSuccess ? "passed" : "failed";
          }

          if (Array.isArray(step.capture) && parsedJson) {
            for (const capture of step.capture) {
              const value = deepGet(parsedJson, capture.json_path);
              if (value !== undefined) {
                vars[capture.as] = value;
              }
            }
          }
        } catch (error) {
          errorMessage = error.message;
          status = step.expect_failure ? "expected_failure_passed" : "failed";
        }

        const combined = `${text || ""} ${errorMessage || ""}`;
        if (step.tool === "td_connect" && status === "failed" && isBridgeUnavailableMessage(combined)) {
          infraBlockerActive = true;
          infraBlockers.push({
            step_id: step.id,
            tool: step.tool,
            message: combined.trim()
          });
        }

        const errorClass = classifyErrorClass({ status, text, error: errorMessage });

        if (status === "passed") {
          passed += 1;
        } else if (status === "expected_failure_passed") {
          passed += 1;
          expectedFailurePassed += 1;
        } else {
          failed += 1;
          if (errorClass !== "infra") {
            functionalFailed += 1;
          }
        }

        stepStatusMap.set(step.id, status);

        stepResults.push({
          id: step.id,
          tool: step.tool,
          args: stepArgs,
          expect_failure: Boolean(step.expect_failure),
          status,
          block_reason: null,
          error_class: errorClass,
          duration_ms: Date.now() - stepStart,
          result: callResult,
          error: errorMessage
        });

        if (args.failFast && (status === "failed" || status === "unexpected_success")) {
          break;
        }
      }

      phaseResults.push({
        name: phase.name,
        duration_ms: Date.now() - phaseStart,
        steps: stepResults
      });

      if (args.failFast) {
        const hasHardFail = phaseResults.some((p) => p.steps.some((s) => s.status === "failed" || s.status === "unexpected_success"));
        if (hasHardFail) {
          break;
        }
      }
    }
  } finally {
    await client.close();
  }

  const completedAt = new Date().toISOString();
  const status = infraBlockers.length > 0
    ? "infra_blocker"
    : functionalFailed > 0
      ? "functional_fail"
      : "pass";

  const summary = {
    checklist: checklist.name,
    started_at: startedAt,
    completed_at: completedAt,
    status,
    total_steps: total,
    passed_steps: passed,
    failed_steps: failed,
    blocked_steps: blocked,
    functional_failed_steps: functionalFailed,
    infra_blockers_count: infraBlockers.length,
    expected_failure_passed_steps: expectedFailurePassed,
    pass_rate: total > 0 ? Number(((passed / total) * 100).toFixed(2)) : 0,
    captured_vars: vars
  };

  const stamp = formatTimestamp();
  const reportDir = resolve(args.outDir, stamp);
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, "report.json");
  writeFileSync(reportPath, JSON.stringify({ summary, infra: { blockers: infraBlockers }, phases: phaseResults }, null, 2));

  console.log(JSON.stringify({ summary, infra_blockers: infraBlockers, report_path: reportPath }, null, 2));

  if (functionalFailed > 0) {
    process.exit(2);
  }
  if (infraBlockers.length > 0) {
    process.exit(3);
  }
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
