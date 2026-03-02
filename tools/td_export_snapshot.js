import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Export TouchDesigner Snapshot",
  description: "Export a normalized snapshot of one or more node paths for deterministic verification",
  inputSchema: {
    paths: z.array(z.string()).min(1).max(500).describe("Node paths to snapshot"),
    include_params: z.boolean().optional().describe("Include parameter previews"),
    include_children: z.boolean().optional().describe("Include descendants recursively")
  }
};

export async function handler({
  paths,
  include_params = true,
  include_children = false
}, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "export_snapshot",
      data: {
        paths,
        include_params,
        include_children
      }
    });
    return resultResponse("TouchDesigner Snapshot", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}

