import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Delete TD Node (Alias)",
  description: "Compatibility alias for delete_td_node",
  inputSchema: {
    nodePath: z.string()
  }
};

export async function handler({ nodePath }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "delete_op",
      data: { path: nodePath }
    });
    return resultResponse("delete_td_node", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}
