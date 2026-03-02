import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Ping TouchDesigner Bridge",
  description: "Check bridge liveness and ping latency",
  inputSchema: {
    timeout_ms: z.number().int().positive().max(120000).optional()
  }
};

export async function handler({ timeout_ms = 2500 }, { tdBridgeClient }) {
  const started = Date.now();
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "ping",
      data: {},
      timeoutMs: timeout_ms
    });

    return resultResponse("TouchDesigner Bridge Ping", {
      ...result,
      latency_ms: Date.now() - started
    });
  } catch (error) {
    return errorResponse(error.message);
  }
}

