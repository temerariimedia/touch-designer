import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Get TD Nodes (Alias)",
  description: "Compatibility alias for get_td_nodes",
  inputSchema: {
    parentPath: z.string(),
    pattern: z.string().optional(),
    includeProperties: z.boolean().optional(),
    limit: z.number().int().positive().max(1000).optional()
  }
};

export async function handler({ parentPath, pattern, includeProperties = false, limit = 200 }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "list_nodes",
      data: {
        parent: parentPath,
        pattern,
        include_properties: includeProperties,
        limit
      }
    });
    return resultResponse("get_td_nodes", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}
