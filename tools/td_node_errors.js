import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Inspect TouchDesigner Node Errors",
  description: "Collect errors for a node and optionally its descendants",
  inputSchema: {
    path: z.string().describe("Operator path"),
    include_children: z.boolean().optional().describe("Also inspect child operators"),
    limit: z.number().int().positive().max(500).optional().describe("Maximum errors returned")
  }
};

export async function handler({ path, include_children = true, limit = 200 }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "node_errors",
      data: { path, include_children, limit }
    });
    return resultResponse("TouchDesigner Node Errors", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}

