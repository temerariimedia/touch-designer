import { z } from "zod";
import { executeBatchOperations } from "./td-batch-utils.js";
import { resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Update TD Node Parameters (Alias)",
  description: "Compatibility alias for update_td_node_parameters",
  inputSchema: {
    nodePath: z.string(),
    properties: z.record(z.union([z.string(), z.number(), z.boolean()]))
  }
};

export async function handler({ nodePath, properties }, { tdBridgeClient }) {
  try {
    const operations = Object.entries(properties).map(([param, value]) => ({
      action: "set_param",
      data: {
        path: nodePath,
        param,
        value
      }
    }));

    const result = await executeBatchOperations({
      tdBridgeClient,
      operations,
      stopOnError: false,
      rollbackOnFailure: "none",
      timeoutMs: 5000
    });

    return resultResponse("update_td_node_parameters", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}
