import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Get TD Node Parameters (Alias)",
  description: "Compatibility alias for get_td_node_parameters",
  inputSchema: {
    nodePath: z.string()
  }
};

export async function handler({ nodePath }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "op_info",
      data: { path: nodePath }
    });
    return resultResponse("get_td_node_parameters", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}
