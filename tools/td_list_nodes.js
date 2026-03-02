import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "List TouchDesigner Nodes",
  description: "List operators under a parent path with optional pattern filter",
  inputSchema: {
    parent: z.string().default("/project1").describe("Parent path"),
    pattern: z.string().optional().describe("Name glob pattern, default '*'"),
    include_properties: z.boolean().optional().describe("Include parameter snapshot"),
    limit: z.number().int().positive().max(1000).optional().describe("Maximum number of nodes")
  }
};

export async function handler({ parent = "/project1", pattern, include_properties = false, limit = 200 }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "list_nodes",
      data: { parent, pattern, include_properties, limit }
    });
    return resultResponse("TouchDesigner Nodes", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}

