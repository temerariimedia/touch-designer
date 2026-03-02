import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Create TD Node (Alias)",
  description: "Compatibility alias for create_td_node",
  inputSchema: {
    parentPath: z.string(),
    nodeType: z.string(),
    nodeName: z.string().optional()
  }
};

export async function handler({ parentPath, nodeType, nodeName }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "create_op",
      data: {
        parent: parentPath,
        type: nodeType,
        name: nodeName
      }
    });
    return resultResponse("create_td_node", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}
