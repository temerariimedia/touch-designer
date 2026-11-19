#!/usr/bin/env node

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import OperatorDataManager from "./wiki/operator-data-manager.js";

import * as getOperatorTool from "./tools/get_operator.js";
import * as searchOperatorsTool from "./tools/search_operators.js";
import * as suggestWorkflowTool from "./tools/suggest_workflow.js";
import * as listOperatorsTool from "./tools/list_operators.js";
import * as getTutorialTool from "./tools/get_tutorial.js";
import * as listTutorialsTool from "./tools/list_tutorials.js";
import * as getPythonApiTool from "./tools/get_python_api.js";
import * as searchPythonApiTool from "./tools/search_python_api.js";
// Upstream v3 documentation tools (merged 2026-11-19; upstream's own live-control tools are NOT registered — ours are)
import * as searchTutorialsTool from "./tools/search_tutorials.js";
import * as getOperatorExamplesTool from "./tools/get_operator_examples.js";
import * as listPythonClassesTool from "./tools/list_python_classes.js";
import * as compareOperatorsTool from "./tools/compare_operators.js";
import * as getVersionInfoTool from "./tools/get_version_info.js";
import * as listVersionsTool from "./tools/list_versions.js";
import * as getExperimentalTechniquesTool from "./tools/get_experimental_techniques.js";
import * as searchExperimentalTool from "./tools/search_experimental.js";
import * as getGlslPatternTool from "./tools/get_glsl_pattern.js";
import * as getOperatorConnectionsTool from "./tools/get_operator_connections.js";
import * as getNetworkTemplateTool from "./tools/get_network_template.js";
import * as getExperimentalBuildTool from "./tools/get_experimental_build.js";
import * as listExperimentalBuildsTool from "./tools/list_experimental_builds.js";

import TdBridgeClient from "./bridge/td-bridge-client.js";
import CapabilityManager from "./security/capability-manager.js";

import * as tdConnectTool from "./tools/td_connect.js";
import * as tdDisconnectTool from "./tools/td_disconnect.js";
import * as tdStatusTool from "./tools/td_status.js";
import * as tdEvalTool from "./tools/td_eval.js";
import * as tdRunScriptTool from "./tools/td_run_script.js";
import * as tdSetParamTool from "./tools/td_set_param.js";
import * as tdPulseTool from "./tools/td_pulse.js";
import * as tdCreateOpTool from "./tools/td_create_op.js";
import * as tdDeleteOpTool from "./tools/td_delete_op.js";
import * as tdConnectOpsTool from "./tools/td_connect_ops.js";
import * as tdOpInfoTool from "./tools/td_op_info.js";
import * as tdTimelinePlayTool from "./tools/td_timeline_play.js";
import * as tdTimelineStopTool from "./tools/td_timeline_stop.js";
import * as tdOpenProjectTool from "./tools/td_open_project.js";
import * as tdSaveProjectTool from "./tools/td_save_project.js";

import * as tdBridgeStateTool from "./tools/td_bridge_state.js";
import * as tdBridgePingTool from "./tools/td_bridge_ping.js";
import * as tdListNodesTool from "./tools/td_list_nodes.js";
import * as tdNodeErrorsTool from "./tools/td_node_errors.js";
import * as tdExecNodeMethodTool from "./tools/td_exec_node_method.js";
import * as tdExecuteBatchTool from "./tools/td_execute_batch.js";
import * as tdPlanNetworkChangesTool from "./tools/td_plan_network_changes.js";
import * as tdApplyNetworkChangesTool from "./tools/td_apply_network_changes.js";
import * as tdDescribeToolsTool from "./tools/td_describe_tools.js";
import * as tdExportSnapshotTool from "./tools/td_export_snapshot.js";
import * as tdCapturePerformanceTool from "./tools/td_capture_performance.js";
import * as tdTestResetWorkspaceTool from "./tools/td_test_reset_workspace.js";
import TdPlanStore from "./tools/td-plan-store.js";
import * as aliasCreateTdNodeTool from "./tools/alias_create_td_node.js";
import * as aliasDeleteTdNodeTool from "./tools/alias_delete_td_node.js";
import * as aliasExecutePythonScriptTool from "./tools/alias_execute_python_script.js";
import * as aliasGetTdNodesTool from "./tools/alias_get_td_nodes.js";
import * as aliasGetTdNodeErrorsTool from "./tools/alias_get_td_node_errors.js";
import * as aliasGetTdNodeParametersTool from "./tools/alias_get_td_node_parameters.js";
import * as aliasUpdateTdNodeParametersTool from "./tools/alias_update_td_node_parameters.js";
import * as aliasExecNodeMethodTool from "./tools/alias_exec_node_method.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PATTERNS_PATH = join(__dirname, "data", "patterns.json");

const packageJson = JSON.parse(await fs.readFile(join(__dirname, "package.json"), "utf-8"));
const VERSION = packageJson.version;

const operatorDataManager = new OperatorDataManager({
  wikiPath: join(__dirname, "wiki"),
  dataPath: join(__dirname, "wiki", "data"),
  processedPath: join(__dirname, "wiki", "data", "processed"),
  searchIndexPath: join(__dirname, "wiki", "data", "search-index"),
  enablePersistence: true,
  autoIndex: true,
  tdDocsPath: join(__dirname, "wiki", "docs", "python")
});

const tdBridgeClient = new TdBridgeClient();
const capabilityManager = new CapabilityManager({
  configPath: join(__dirname, "config", "td-capabilities.json")
});
const planStore = new TdPlanStore();
tdBridgeClient.setCapabilityManager(capabilityManager);

let workflowPatterns = null;
let httpServer = null;
let shuttingDown = false;

async function loadPatterns() {
  try {
    const content = await fs.readFile(PATTERNS_PATH, "utf-8");
    workflowPatterns = JSON.parse(content);
    console.log(`[Patterns] Loaded ${workflowPatterns.patterns.length} workflow patterns`);
  } catch (error) {
    console.error("[Patterns] Failed to load patterns:", error);
    workflowPatterns = { patterns: [], common_transitions: {} };
  }
}

function parseRuntimeConfig(argv = process.argv.slice(2)) {
  const getValue = (flag, fallback = undefined) => {
    const inline = argv.find((arg) => arg.startsWith(`${flag}=`));
    if (inline) {
      return inline.split("=").slice(1).join("=");
    }

    const index = argv.indexOf(flag);
    if (index >= 0 && argv[index + 1]) {
      return argv[index + 1];
    }

    return fallback;
  };

  const mcpHttpPort = getValue("--mcp-http-port");
  const transport = getValue("--transport", mcpHttpPort ? "http" : "stdio");

  return {
    transport,
    mcpHttpHost: getValue("--mcp-http-host", "127.0.0.1"),
    mcpHttpPort: Number.parseInt(mcpHttpPort || getValue("--http-port", "6288"), 10),
    mcpHttpEndpoint: getValue("--mcp-http-endpoint", "/mcp")
  };
}

function registerCoreTools(server) {
  server.registerTool(
    "get_operator",
    getOperatorTool.schema,
    async (params) => await getOperatorTool.handler(params, { operatorDataManager })
  );

  server.registerTool(
    "search_operators",
    searchOperatorsTool.schema,
    async (params) => await searchOperatorsTool.handler(params, { operatorDataManager })
  );

  server.registerTool(
    "suggest_workflow",
    suggestWorkflowTool.schema,
    async (params) => await suggestWorkflowTool.handler(params, { operatorDataManager, workflowPatterns })
  );

  server.registerTool(
    "list_operators",
    listOperatorsTool.schema,
    async (params) => await listOperatorsTool.handler(params, { operatorDataManager })
  );

  server.registerTool(
    "get_tutorial",
    getTutorialTool.schema,
    async (params) => await getTutorialTool.handler(params, { operatorDataManager })
  );

  server.registerTool(
    "list_tutorials",
    listTutorialsTool.schema,
    async (params) => await listTutorialsTool.handler(params, { operatorDataManager })
  );

  server.registerTool(
    "get_python_api",
    getPythonApiTool.schema,
    async (params) => await getPythonApiTool.handler(params, { operatorDataManager })
  );

  server.registerTool(
    "search_python_api",
    searchPythonApiTool.schema,
    async (params) => await searchPythonApiTool.handler(params, { operatorDataManager })
  );

  server.registerTool(
    "search_tutorials",
    searchTutorialsTool.schema,
    async (params) => await searchTutorialsTool.handler(params, { operatorDataManager })
  );

  server.registerTool(
    "get_operator_examples",
    getOperatorExamplesTool.schema,
    async (params) => await getOperatorExamplesTool.handler(params, { operatorDataManager })
  );

  server.registerTool(
    "list_python_classes",
    listPythonClassesTool.schema,
    async (params) => await listPythonClassesTool.handler(params, { operatorDataManager })
  );

  server.registerTool(
    "compare_operators",
    compareOperatorsTool.schema,
    async (params) => await compareOperatorsTool.handler(params, { operatorDataManager })
  );

  server.registerTool(
    "get_version_info",
    getVersionInfoTool.schema,
    async (params) => await getVersionInfoTool.handler(params, {})
  );

  server.registerTool(
    "list_versions",
    listVersionsTool.schema,
    async (params) => await listVersionsTool.handler(params, {})
  );

  server.registerTool(
    "get_experimental_techniques",
    getExperimentalTechniquesTool.schema,
    async (params) => await getExperimentalTechniquesTool.handler(params)
  );

  server.registerTool(
    "search_experimental",
    searchExperimentalTool.schema,
    async (params) => await searchExperimentalTool.handler(params)
  );

  server.registerTool(
    "get_glsl_pattern",
    getGlslPatternTool.schema,
    async (params) => await getGlslPatternTool.handler(params)
  );

  server.registerTool(
    "get_operator_connections",
    getOperatorConnectionsTool.schema,
    async (params) => await getOperatorConnectionsTool.handler(params, {})
  );

  server.registerTool(
    "get_network_template",
    getNetworkTemplateTool.schema,
    async (params) => await getNetworkTemplateTool.handler(params, {})
  );

  server.registerTool(
    "get_experimental_build",
    getExperimentalBuildTool.schema,
    async (params) => await getExperimentalBuildTool.handler(params, {})
  );

  server.registerTool(
    "list_experimental_builds",
    listExperimentalBuildsTool.schema,
    async (params) => await listExperimentalBuildsTool.handler(params, {})
  );
}

function registerTdTools(server) {
  const tdContext = {
    tdBridgeClient,
    capabilityManager,
    planStore,
    tdToolCatalog: []
  };

  const catalog = [];

  const register = (name, toolModule, meta = {}) => {
    const requiredCapability = capabilityManager.getRequiredCapability(meta.action || "");
    catalog.push({
      name,
      aliasOf: meta.aliasOf || null,
      action: meta.action || null,
      requiredCapability,
      description: toolModule.schema?.description || ""
    });

    server.registerTool(
      name,
      toolModule.schema,
      async (params) => await toolModule.handler(params, tdContext)
    );
  };

  register("td_connect", tdConnectTool);
  register("td_disconnect", tdDisconnectTool);
  register("td_status", tdStatusTool, { action: "get_status" });
  register("td_eval", tdEvalTool, { action: "eval" });
  register("td_run_script", tdRunScriptTool, { action: "run_script" });
  register("td_set_param", tdSetParamTool, { action: "set_param" });
  register("td_pulse", tdPulseTool, { action: "pulse" });
  register("td_create_op", tdCreateOpTool, { action: "create_op" });
  register("td_delete_op", tdDeleteOpTool, { action: "delete_op" });
  register("td_connect_ops", tdConnectOpsTool, { action: "connect_ops" });
  register("td_op_info", tdOpInfoTool, { action: "op_info" });
  register("td_timeline_play", tdTimelinePlayTool, { action: "timeline_play" });
  register("td_timeline_stop", tdTimelineStopTool, { action: "timeline_stop" });
  register("td_open_project", tdOpenProjectTool, { action: "open_project" });
  register("td_save_project", tdSaveProjectTool, { action: "save_project" });

  register("td_bridge_state", tdBridgeStateTool);
  register("td_bridge_ping", tdBridgePingTool, { action: "ping" });
  register("td_list_nodes", tdListNodesTool, { action: "list_nodes" });
  register("td_node_errors", tdNodeErrorsTool, { action: "node_errors" });
  register("td_exec_node_method", tdExecNodeMethodTool, { action: "exec_node_method" });
  register("td_execute_batch", tdExecuteBatchTool, { action: "execute_batch" });
  register("td_plan_network_changes", tdPlanNetworkChangesTool);
  register("td_apply_network_changes", tdApplyNetworkChangesTool, { action: "apply_network_changes" });
  register("td_describe_tools", tdDescribeToolsTool);
  register("td_export_snapshot", tdExportSnapshotTool, { action: "export_snapshot" });
  register("td_capture_performance", tdCapturePerformanceTool, { action: "capture_performance" });
  register("td_test_reset_workspace", tdTestResetWorkspaceTool, { action: "test_reset_workspace" });

  // Ecosystem-style aliases
  register("create_td_node", aliasCreateTdNodeTool, { aliasOf: "td_create_op", action: "create_op" });
  register("delete_td_node", aliasDeleteTdNodeTool, { aliasOf: "td_delete_op", action: "delete_op" });
  register("execute_python_script", aliasExecutePythonScriptTool, { aliasOf: "td_run_script", action: "run_script" });
  register("get_td_info", tdStatusTool, { aliasOf: "td_status", action: "get_status" });
  register("get_td_nodes", aliasGetTdNodesTool, { aliasOf: "td_list_nodes", action: "list_nodes" });
  register("get_td_node_errors", aliasGetTdNodeErrorsTool, { aliasOf: "td_node_errors", action: "node_errors" });
  register("get_td_node_parameters", aliasGetTdNodeParametersTool, { aliasOf: "td_op_info", action: "op_info" });
  register("update_td_node_parameters", aliasUpdateTdNodeParametersTool, { aliasOf: "td_set_param", action: "set_param" });
  register("exec_node_method", aliasExecNodeMethodTool, { aliasOf: "td_exec_node_method", action: "exec_node_method" });
  register("describe_td_tools", tdDescribeToolsTool, { aliasOf: "td_describe_tools" });

  tdContext.tdToolCatalog = catalog;
}

function createMcpServer() {
  const server = new McpServer({
    name: "td-mcp",
    version: VERSION
  });

  registerCoreTools(server);
  registerTdTools(server);

  return server;
}

async function startStdioServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(`\n[Server] td-mcp v${VERSION} running on stdio transport`);
}

async function startHttpServer({ host, port, endpoint }) {
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  const sessions = new Map();

  const getSessionId = (req) => req.headers["mcp-session-id"];

  app.post(endpoint, async (req, res) => {
    const sessionId = getSessionId(req);
    let entry = sessionId ? sessions.get(sessionId) : null;

    if (!entry) {
      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: No valid session ID provided" },
          id: null
        });
        return;
      }

      let transport;
      const server = createMcpServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          sessions.set(newSessionId, { server, transport, createdAt: new Date().toISOString() });
        }
      });

      transport.onclose = async () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
        if (server?.close) {
          await server.close();
        }
      };

      await server.connect(transport);
      entry = { server, transport, createdAt: new Date().toISOString() };
    }

    await entry.transport.handleRequest(req, res, req.body);
  });

  const handleSessionRequest = async (req, res) => {
    const sessionId = getSessionId(req);
    const entry = sessionId ? sessions.get(sessionId) : null;

    if (!entry) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    await entry.transport.handleRequest(req, res);
  };

  app.get(endpoint, handleSessionRequest);
  app.delete(endpoint, handleSessionRequest);

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      version: VERSION,
      transport: "streamable-http",
      sessions: sessions.size,
      bridge: tdBridgeClient.getStatus()
    });
  });

  await new Promise((resolve, reject) => {
    const serverInstance = app.listen(port, host, () => {
      httpServer = serverInstance;
      resolve();
    });
    serverInstance.on("error", reject);
  });

  console.log(`[Server] td-mcp v${VERSION} running on http://${host}:${port}${endpoint}`);
}

async function initSharedState() {
  console.log(`TD-MCP v${VERSION} Server Starting...`);
  console.log("================================");
  console.log("TouchDesigner MCP Server (Docs + Live Control)");

  capabilityManager.reload();

  try {
    console.log("[Server] Initializing operator data manager...");
    await operatorDataManager.initialize();
    await loadPatterns();

    const stats = operatorDataManager.getSystemStats();
    const pythonApiStats = stats.pythonApiStats || { totalClasses: 0 };
    console.log(`[Server] Wiki ready: ${stats.totalEntries} operators, ${stats.totalTutorials} tutorials, ${pythonApiStats.totalClasses} Python classes`);
    console.log(`[Server] Capability policy: ${JSON.stringify(capabilityManager.getPolicy())}`);
  } catch (error) {
    console.error("[Server] Initialization error:", error);
    console.log("[Server] Continuing startup with limited functionality");
  }
}

async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.log("\n[Server] Shutting down...");

  try {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
      httpServer = null;
    }

    operatorDataManager.destroy();
    await tdBridgeClient.disconnect();
    console.log("[Server] Shutdown complete");
  } catch (error) {
    console.error("[Server] Error during shutdown:", error);
  } finally {
    process.exit(0);
  }
}

async function main() {
  await initSharedState();

  const runtime = parseRuntimeConfig();
  if (runtime.transport === "http") {
    await startHttpServer({
      host: runtime.mcpHttpHost,
      port: runtime.mcpHttpPort,
      endpoint: runtime.mcpHttpEndpoint
    });
    return;
  }

  await startStdioServer();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
