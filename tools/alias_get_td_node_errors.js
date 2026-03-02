import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Get TD Node Errors (Alias)",
  description: "Compatibility alias for get_td_node_errors",
  inputSchema: {
    nodePath: z.string(),
    includeChildren: z.boolean().optional(),
    limit: z.number().int().positive().max(500).optional()
  }
};

export async function handler({ nodePath, includeChildren = true, limit = 200 }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "node_errors",
      data: {
        path: nodePath,
        include_children: includeChildren,
        limit
      }
    });
    return resultResponse("get_td_node_errors", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}
