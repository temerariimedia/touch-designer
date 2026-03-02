import { z } from "zod";
import { formatJsonBlock, textResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Connect to TouchDesigner Bridge",
  description: "Connect this MCP server to a running TouchDesigner WebSocket bridge",
  inputSchema: {
    url: z.string().optional().describe("WebSocket URL (default: ws://127.0.0.1:9981)"),
    token: z.string().optional().describe("Shared secret token, if bridge requires auth"),
    timeout_ms: z.number().int().positive().max(120000).optional().describe("Connection timeout in milliseconds"),
    max_reconnect_attempts: z.number().int().min(0).max(100).optional().describe("Maximum reconnect attempts"),
    heartbeat_interval_ms: z.number().int().positive().max(120000).optional().describe("Heartbeat interval in milliseconds")
  }
};

export async function handler({
  url,
  token,
  timeout_ms = 5000,
  max_reconnect_attempts = 5,
  heartbeat_interval_ms = 15000
}, { tdBridgeClient }) {
  try {
    const status = await tdBridgeClient.connect({
      url,
      token,
      timeoutMs: timeout_ms,
      maxReconnectAttempts: max_reconnect_attempts,
      heartbeatIntervalMs: heartbeat_interval_ms
    });
    return textResponse(formatJsonBlock("TouchDesigner Bridge Connected", status));
  } catch (error) {
    return textResponse(`Failed to connect to TouchDesigner bridge: ${error.message}`);
  }
}
