import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Exec Node Method (Alias)",
  description: "Compatibility alias for exec_node_method",
  inputSchema: {
    nodePath: z.string(),
    method: z.string(),
    args: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    kwargs: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    timeout_ms: z.number().int().positive().max(120000).optional()
  }
};

export async function handler({ nodePath, method, args = [], kwargs = {}, timeout_ms = 5000 }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "exec_node_method",
      data: {
        path: nodePath,
        method,
        args,
        kwargs
      },
      timeoutMs: timeout_ms
    });
    return resultResponse("exec_node_method", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}
