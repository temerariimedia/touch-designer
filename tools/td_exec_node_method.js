import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Execute TouchDesigner Node Method",
  description: "Call a method on a TouchDesigner operator",
  inputSchema: {
    path: z.string().describe("Operator path"),
    method: z.string().describe("Method name on the operator"),
    args: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    kwargs: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    timeout_ms: z.number().int().positive().max(120000).optional()
  }
};

export async function handler({ path, method, args = [], kwargs = {}, timeout_ms = 5000 }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "exec_node_method",
      data: { path, method, args, kwargs },
      timeoutMs: timeout_ms
    });
    return resultResponse("TouchDesigner Node Method Result", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}

